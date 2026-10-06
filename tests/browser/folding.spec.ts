import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { exampleRecording, INITIAL_VIEW } from '../../apps/web/src/folding/model';
import { PerspectiveCamera, Vector3 } from 'three';

async function menu(page: Page) {
  if (!(await page.locator('.fold-method-menu').isVisible()))
    await page.getByRole('button', { name: 'Methods and exports', exact: true }).click();
}
async function advanced(page: Page) {
  if (!(await page.getByLabel('Crease', { exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Advanced folding controls', exact: true }).click();
}
async function steps(page: Page) {
  if (!(await page.locator('.fold-timeline').isVisible()))
    await page.getByRole('button', { name: 'Recorded steps', exact: true }).click();
}
async function paperPoint(page: Page, x: number, y: number, z = 0) {
  const b = (await page.locator('.fold-stage canvas').boundingBox())!;
  const camera = new PerspectiveCamera(38, b.width / b.height, 0.05, 200);
  camera.position.fromArray(INITIAL_VIEW.position);
  camera.lookAt(...INITIAL_VIEW.target);
  camera.updateMatrixWorld();
  const p = new Vector3((x - 2) * 2.125, (y - 2) * 2.75, z).project(camera);
  return { x: b.x + ((p.x + 1) * b.width) / 2, y: b.y + ((1 - p.y) * b.height) / 2 };
}

async function openSimulator(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Folding simulator', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Folding simulator/ })).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.fold-stage canvas').evaluate((el: HTMLCanvasElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(el, 0, 0, 100, 100);
        const data = ctx.getImageData(0, 0, 100, 100).data;
        let light = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 100 && data[i + 1] > 100) light++;
        return light;
      }),
    )
    .toBeGreaterThan(100);
}
test('folds, previews without committing, undoes, saves and restores a draft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const renderRequests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/renders')) renderRequests.push(r.url());
  });
  await openSimulator(page);
  await menu(page);
  await page.getByLabel('Method title', { exact: true }).fill('My paper method');
  await page.getByRole('button', { name: 'Close methods', exact: true }).click();
  await advanced(page);
  await page.getByLabel('Crease', { exact: true }).selectOption('y:2');
  await page.getByLabel('Flap or packet', { exact: true }).selectOption('0');
  await page.getByRole('slider', { name: 'Preview angle', exact: true }).fill('90');
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 4');
  await steps(page);
  await page.getByLabel('Note for next step', { exact: true }).fill('Bring the bottom half up.');
  await page.getByRole('button', { name: 'Fold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 4');
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  await menu(page);
  await page.getByRole('button', { name: 'Save method', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Method saved');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Folding simulator', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: 'Folding simulator', exact: true }).click();
  await menu(page);
  await expect(page.getByLabel('Method title', { exact: true })).toHaveValue('My paper method');
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  await page.getByRole('button', { name: 'Close methods', exact: true }).click();
  await steps(page);
  await expect(page.getByLabel('Current step note', { exact: true })).toHaveValue(
    'Bring the bottom half up.',
  );
  expect(errors).toEqual([]);
  expect(renderRequests).toEqual([]);
});
test('example timeline can replay, pause, branch, and undo the branch', async ({ page }) => {
  await openSimulator(page);
  await menu(page);
  await page.getByRole('button', { name: 'Try example', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('2 × 1');
  await page.getByRole('slider', { name: 'Timeline position', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('slider', { name: 'Timeline position', exact: true }).fill('1');
  await page.getByRole('button', { name: 'Add view without folding', exact: true }).click();
  await expect(page.locator('.fold-timeline li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await expect(page.locator('.fold-timeline li')).toHaveCount(4);
});
test('recording import stays separate from book settings and rejects invalid folds', async ({ page }) => {
  await openSimulator(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') requests.push(r.url());
  });
  await page.getByLabel('Import folding recording', { exact: true }).setInputFiles({
    name: 'test.microbook-fold.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exampleRecording())),
  });
  await expect(page.locator('.fold-paper-status strong')).toHaveText('2 × 1');
  const download = page.waitForEvent('download');
  await menu(page);
  await page.getByRole('button', { name: 'Export recording', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.microbook-fold\.json$/);
  expect(JSON.parse(await readFile((await file.path())!, 'utf8'))).toEqual(exampleRecording());
  const bad = exampleRecording();
  bad.steps[0].fold!.moving = [999];
  await page.getByLabel('Import folding recording', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByRole('alert')).toContainText('Select a flap');
  await expect(page.locator('.fold-paper-status strong')).toHaveText('2 × 1');
  expect(requests).toEqual([]);
});
test('exports a decodable video with actual paper frames', async ({ page }) => {
  await openSimulator(page);
  const method = exampleRecording();
  method.steps = method.steps.slice(0, 1);
  await page.getByLabel('Import folding recording', { exact: true }).setInputFiles({
    name: 'fold.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(method)),
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await menu(page);
  await page.getByRole('button', { name: 'Export video', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(10000);
  const metadata = await page.evaluate(
    async (data) => {
      const video = document.createElement('video');
      video.src = `data:video/${data.ext};base64,${data.base64}`;
      video.muted = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(Error('Video cannot be decoded'));
      });
      video.currentTime = 0.15;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, 100, 100);
      const pixels = ctx.getImageData(0, 0, 100, 100).data;
      let light = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 100 && pixels[i + 1] > 100) light++;
      return { width: video.videoWidth, height: video.videoHeight, light };
    },
    { ext: download.suggestedFilename().split('.').pop(), base64: bytes.toString('base64') },
  );
  expect(metadata.width).toBe(1280);
  expect(metadata.height).toBe(720);
  expect(metadata.light).toBeGreaterThan(100);
});
test('mobile controls fit, reduced motion works, and keyboard can leave the dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSimulator(page);
  expect(await page.locator('.fold-workspace').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await advanced(page);
  await page.getByLabel('Crease', { exact: true }).selectOption('x:2');
  await page.getByLabel('Flap or packet', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Fold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('2 × 4');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('opening the simulator preserves the loaded PDF and unapplied layout settings', async ({ page }) => {
  const { upload, ready, preview } = await import('./helpers');
  await page.goto('/');
  await upload(page);
  const renderId = await ready(page);
  await page.getByLabel('Text size in CSS pixels').fill('8');
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') calls.push(r.url());
  });
  await page.getByRole('button', { name: 'Folding simulator', exact: true }).click();
  // A portalled recording drop must not reach the book/settings importer.
  await page.locator('.fold-workspace').evaluate((element, recording) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([recording], 'method.json', { type: 'application/json' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  }, JSON.stringify(exampleRecording()));
  await expect(page.locator('.fold-paper-status strong')).toHaveText('2 × 1');
  await page.keyboard.press('Control+f');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('8');
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await expect(preview(page)).toHaveAttribute('data-render-id', renderId as string);
  expect(calls).toEqual([]);
});

test('cancelling export releases the busy state and graphics failure keeps recordings available', async ({
  page,
}) => {
  await openSimulator(page);
  await menu(page);
  await page.getByRole('button', { name: 'Try example', exact: true }).click();
  await menu(page);
  await page.getByRole('button', { name: 'Export video', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
  await menu(page);
  await expect(page.getByRole('button', { name: 'Export video', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close methods', exact: true }).click();
  await page.locator('.fold-stage canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  await expect(page.getByRole('alert')).toContainText('graphics context was lost');
  await menu(page);
  await expect(page.getByRole('button', { name: 'Export recording', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close methods', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('paper drag previews a fold without orbiting or committing, and a folded edge unfolds', async ({
  page,
}) => {
  await openSimulator(page);
  await expect(page.locator('.fold-controls')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Preview angle', exact: true })).toHaveCount(0);
  let p = await paperPoint(page, 0.75, 2, 0.16);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByText('Choose a side', { exact: true })).toBeVisible();
  p = await paperPoint(page, 1.25, 0.75);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let angle = 10; angle <= 110; angle += 10) {
    const r = (angle * Math.PI) / 180;
    p = await paperPoint(page, 1.25, 2 - 1.25 * Math.cos(r), 1.25 * 2.75 * Math.sin(r));
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 4');
  await expect(page.getByRole('button', { name: 'Recorded steps', exact: true })).toContainText('0');
  await advanced(page);
  expect(
    Number(await page.getByRole('slider', { name: 'Preview angle', exact: true }).inputValue()),
  ).toBeGreaterThan(80);
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'Fold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  p = await paperPoint(page, 0.75, 2, 0.16);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole('button', { name: 'Unfold', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unfold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 4');
  await expect(page.getByRole('button', { name: 'Recorded steps', exact: true })).toContainText('2');
  await page.getByRole('button', { name: 'Turn over', exact: true }).click();
  await page.getByRole('button', { name: 'Recorded steps', exact: true }).click();
  await page.getByRole('button', { name: 'Add view without folding', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('microbook-folding-draft-v1')!).steps.at(-1).view.position[2],
      ),
    )
    .toBeLessThan(0);
});

test.describe('touch folding', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('tap a crease and side, preview with a finger, then confirm', async ({ page }) => {
    await openSimulator(page);
    let p = await paperPoint(page, 0.75, 2, 0.16);
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.getByRole('button', { name: 'Lower side', exact: true })).toBeVisible();
    p = await paperPoint(page, 1.25, 0.75);
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.getByRole('button', { name: 'Fold', exact: true })).toBeVisible();
    const touch = await page.context().newCDPSession(page);
    p = await paperPoint(page, 1.25, 0.75);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
    for (let a = 10; a <= 110; a += 10) {
      const r = (a * Math.PI) / 180;
      p = await paperPoint(page, 1.25, 2 - 1.25 * Math.cos(r), 1.25 * 2.75 * Math.sin(r));
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await advanced(page);
    expect(
      Number(await page.getByRole('slider', { name: 'Preview angle', exact: true }).inputValue()),
    ).toBeGreaterThan(80);
    await page.getByRole('button', { name: 'Close panel', exact: true }).tap();
    await page.getByRole('button', { name: 'Fold', exact: true }).tap();
    await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
    expect(await page.locator('.fold-workspace').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  });
});

test('rotates the same face, restores orientation and continues folding', async ({ page }) => {
  await openSimulator(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const pixels = () =>
    page.locator('.fold-stage canvas').evaluate((el: HTMLCanvasElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(el, 0, 0, 100, 100);
      return Array.from(ctx.getImageData(0, 0, 100, 100).data);
    });
  const difference = (a: number[], b: number[]) =>
    a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0) / a.length;
  const original = await pixels();
  await page.getByRole('button', { name: 'Rotate right 90°', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate right 90°', exact: true }).click();
  const rotated = await pixels();
  expect(difference(original, rotated)).toBeGreaterThan(2);
  const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('microbook-folding-draft-v1')!));
  await expect.poll(async () => (await draft())?.steps.length).toBe(2);
  const recorded = await draft();
  const view = recorded.steps[1].view;
  expect(view.position[2]).toBeGreaterThan(0);
  expect(view.up[1]).toBeLessThan(-0.9);
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  expect(difference(original, await pixels())).toBeLessThan(0.2);
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  await expect.poll(async () => (await draft())?.steps.length).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Folding simulator', exact: true }).click();
  expect(difference(rotated, await pixels())).toBeLessThan(0.2);
  await page.getByRole('button', { name: 'Rotate left 90°', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate left 90°', exact: true }).click();
  expect(difference(original, await pixels())).toBeLessThan(0.2);
  await advanced(page);
  await page.getByLabel('Crease', { exact: true }).selectOption('y:2');
  await page.getByLabel('Flap or packet', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Fold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 2');
  expect(errors).toEqual([]);
});

test.describe('camera panning', () => {
  for (const touch of [false, true]) {
    test.describe(touch ? 'touch' : 'mouse', () => {
      test.use({ hasTouch: touch });
      test('moves the paper without folding or orbiting', async ({ page }) => {
        await openSimulator(page);
        const p = await paperPoint(page, 2, 2, 0.16);
        if (touch) {
          await page.getByRole('button', { name: 'Pan', exact: true }).tap();
          await expect(page.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          const input = await page.context().newCDPSession(page);
          await input.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ ...p, id: 1 }],
          });
          for (let i = 1; i <= 5; i++)
            await input.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: p.x + i * 20, y: p.y + i * 10, id: 1 }],
            });
          await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.keyboard.down('Shift');
          await page.mouse.move(p.x, p.y);
          await page.mouse.down();
          await page.mouse.move(p.x + 100, p.y + 50, { steps: 5 });
          await page.mouse.up();
          await page.keyboard.up('Shift');
        }
        await expect(page.getByRole('button', { name: 'Recorded steps', exact: true })).toContainText('0');
        await steps(page);
        await page.getByRole('button', { name: 'Add view without folding', exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(
              () => JSON.parse(localStorage.getItem('microbook-folding-draft-v1') || 'null')?.steps.length,
            ),
          )
          .toBe(1);
        const view = await page.evaluate(
          () => JSON.parse(localStorage.getItem('microbook-folding-draft-v1')!).steps[0].view,
        );
        expect(Math.hypot(...view.target)).toBeGreaterThan(0.5);
        for (let i = 0; i < 3; i++)
          expect(view.position[i] - view.target[i]).toBeCloseTo(INITIAL_VIEW.position[i], 6);
        await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 4');
      });
    });
  }
});

test('makes folded layers visible and offers both accessible sides of a folded edge', async ({ page }) => {
  await openSimulator(page);
  await menu(page);
  await page.getByRole('button', { name: 'Try example', exact: true }).click();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const before = await page.locator('.fold-stage canvas').screenshot();
  await page.getByRole('button', { name: 'Spread layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spread layers', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await page.locator('.fold-stage canvas').screenshot()).equals(before)).toBe(false);
  await expect(page.getByRole('button', { name: 'Recorded steps', exact: true })).toContainText('3');
  await advanced(page);
  await page.getByLabel('Crease', { exact: true }).selectOption('x:2');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const options = page.getByRole('group', { name: 'Paper to move', exact: true });
  await expect(options.getByRole('button')).toHaveCount(2);
  await expect(options.getByRole('button', { name: /near side/ })).toBeVisible();
  await options.getByRole('button', { name: /far side/ }).click();
  await expect(options.getByRole('button', { name: /far side/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Unfold', exact: true }).click();
  await expect(page.locator('.fold-paper-status strong')).toHaveText('4 × 1');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('microbook-folding-draft-v1') || 'null')?.steps.length,
      ),
    )
    .toBe(4);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('microbook-folding-draft-v1')!).steps[3].fold.direction,
    ),
  ).toBe(-1);
});
