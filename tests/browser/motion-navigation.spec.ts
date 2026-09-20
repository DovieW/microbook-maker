import { expect, test, type Page } from '@playwright/test';
import { ready, tab, upload } from './helpers';

async function indicatorCenter(page: Page) {
  return page.locator('.sidebar-tabs.motion-tabs').evaluate((tabs) => {
    const selected = tabs.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
    const tabRect = tabs.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const indicator = getComputedStyle(tabs, '::after');
    const matrix = new DOMMatrixReadOnly(indicator.transform);
    return {
      indicator:
        tabRect.left + Number.parseFloat(indicator.left) + matrix.e + Number.parseFloat(indicator.width) / 2,
      selected: selectedRect.left + selectedRect.width / 2,
      selectedBorder: getComputedStyle(selected).borderBottomColor,
      indicatorColor: indicator.backgroundColor,
    };
  });
}

async function installMotionProbe(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __contentMotion?: { tokens: string[]; cancels: number };
      __originalAnimate?: typeof Element.prototype.animate;
      __originalCancel?: typeof Animation.prototype.cancel;
    };
    state.__contentMotion = { tokens: [], cancels: 0 };
    state.__originalAnimate ||= Element.prototype.animate;
    state.__originalCancel ||= Animation.prototype.cancel;
    Element.prototype.animate = function (...args) {
      const token = this instanceof HTMLElement ? this.dataset.contentToken : undefined;
      if (token) state.__contentMotion!.tokens.push(token);
      return state.__originalAnimate!.apply(this, args);
    };
    Animation.prototype.cancel = function (...args) {
      state.__contentMotion!.cancels += 1;
      return state.__originalCancel!.apply(this, args);
    };
  });
}

async function resetMotionProbe(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __contentMotion: { tokens: string[]; cancels: number };
    };
    state.__contentMotion = { tokens: [], cancels: 0 };
  });
}

async function motionProbe(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __contentMotion: { tokens: string[]; cancels: number };
    };
    return state.__contentMotion;
  });
}

test('the tab accent follows keyboard selection without adding a second underline', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  await ready(page);

  const layout = page.getByRole('tab', { name: 'Layout', exact: true });
  const content = page.getByRole('tab', { name: 'Content', exact: true });
  await layout.focus();
  await layout.press('ArrowRight');

  await expect(content).toBeFocused();
  await expect(content).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Content', exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const positions = await indicatorCenter(page);
      return Math.abs(positions.indicator - positions.selected);
    })
    .toBeLessThan(1);

  const styles = await indicatorCenter(page);
  expect(styles.selectedBorder).toBe('rgba(0, 0, 0, 0)');
  expect(styles.indicatorColor).not.toBe('rgba(0, 0, 0, 0)');

  await content.press('ArrowLeft');
  await expect(layout).toBeFocused();
  await expect(layout).toHaveAttribute('aria-selected', 'true');
});

test('only committed reorders move rows, rapid moves cancel cleanly, and reduced motion is still immediate', async ({
  page,
}) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  await ready(page);
  await tab(page, 'Content');
  await page.locator('.content-filter-menu > summary').click();
  await page.getByRole('menuitemradio', { name: 'Sections', exact: true }).click();
  await installMotionProbe(page);

  const rows = page.locator('.contents-row');
  const original = await rows.evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-content-token')),
  );

  await resetMotionProbe(page);
  await page.getByLabel('Find content').fill('Home');
  expect((await motionProbe(page)).tokens).toEqual([]);
  await page.getByLabel('Find content').fill('');
  expect((await motionProbe(page)).tokens).toEqual([]);

  const firstHandle = rows.first().locator('.contents-drag');
  await firstHandle.hover();
  expect((await motionProbe(page)).tokens).toEqual([]);

  await firstHandle.focus();
  await firstHandle.press('ArrowUp');
  await page.getByLabel('Find content').fill('Home');
  await page.getByLabel('Find content').fill('');
  expect((await motionProbe(page)).tokens).toEqual([]);

  await resetMotionProbe(page);
  await firstHandle.press('ArrowDown');
  await expect(rows.nth(1)).toHaveAttribute('data-content-token', original[0]!);
  expect((await motionProbe(page)).tokens.length).toBeGreaterThan(0);

  await rows.nth(1).locator('.contents-drag').press('ArrowUp');
  await expect(rows.first()).toHaveAttribute('data-content-token', original[0]!);
  expect((await motionProbe(page)).cancels).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetMotionProbe(page);
  await rows.first().locator('.contents-drag').press('ArrowDown');
  await expect(rows.nth(1)).toHaveAttribute('data-content-token', original[0]!);
  expect((await motionProbe(page)).tokens).toEqual([]);
});
