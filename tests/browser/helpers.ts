import { expect, type Page, type APIRequestContext } from '@playwright/test';
export const preview = (page: Page) => page.locator('[aria-label="Print preview"]:visible');
export async function ready(page: Page, request?: APIRequestContext) {
  await expect(page.locator('.print-action')).toHaveAttribute('aria-label', 'Print', { timeout: 90000 });
  await expect(page.locator('.print-action')).toBeEnabled({ timeout: 90000 });
  await expect(preview(page)).toHaveAttribute('aria-busy', 'false');
  const id = (await preview(page).getAttribute('data-render-id'))!;
  return request ? (await request.get(`/api/renders/${id}`)).json() : id;
}
export async function tab(page: Page, name: string) {
  if (name === 'Books' || name === 'History') {
    await page.getByRole('button', { name: 'History', exact: true }).click();
    return;
  }
  if (await page.getByRole('button', { name: 'Back to layout', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Back to layout', exact: true }).click();
  }
  if (await page.getByRole('button', { name: 'Open tools', exact: true }).count()) {
    if (!(await page.getByRole('dialog').count()))
      await page.getByRole('button', { name: 'Open tools', exact: true }).click();
  } else if (await page.getByRole('button', { name: 'Expand sidebar' }).count()) {
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
  }
  await page.getByRole('tab', { name, exact: true }).click();
}
export async function upload(page: Page, fixture = 'classic.txt') {
  await page.getByLabel('Import book', { exact: true }).setInputFiles(`tests/fixtures/${fixture}`);
}
export async function jump(page: Page, side: number) {
  const input = page.getByLabel('Printed side', { exact: true });
  await input.fill(String(side));
  await input.press('Enter');
  await expect(input).toHaveValue(String(side));
}
export const applied = (page: Page) => page.getByRole('button', { name: 'Apply', exact: true }).click();
