// Phone-sized viewports: layout fits, touch D-pad shows and works.
import { test, expect } from '@playwright/test';
import { boot, SHOTS } from './helpers.js';
import path from 'node:path';

for (const [name, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
  test.describe(`phone ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

    test(`layout fits and the D-pad moves Rupa (${name})`, async ({ page }) => {
      const errors = await boot(page);
      await page.evaluate(() => { __dhaka.startLevel(1, { seed: 3 }); __dhaka.stepFrames(30); __dhaka.freeze(false); });
      const box = await page.locator('#game').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.y).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
      expect(box.width).toBeGreaterThanOrEqual(name === 'portrait' ? 380 : 500); // uses the screen well
      if (name === 'landscape') { const l = await page.locator('[data-dir="right"]').boundingBox(); expect(l.x + l.width).toBeLessThanOrEqual(box.x + 1); } // pads beside, not over, the road
      const up = page.locator('[data-dir="up"]');
      await expect(up).toBeVisible();
      const padBox = await up.boundingBox();
      expect(padBox.width).toBeGreaterThanOrEqual(44); // comfortable touch target
      if (name === 'portrait') expect(padBox.y).toBeGreaterThan(box.y + box.height - 1); // pad sits below the game
      // no horizontal scroll
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      const row0 = await page.evaluate(() => __dhaka.state().player.row);
      await up.tap();
      await page.waitForTimeout(400);
      const row1 = await page.evaluate(() => __dhaka.state().player.row);
      expect(row1).toBe(row0 + 1);
      await page.screenshot({ path: path.join(SHOTS, `phone-${name}.png`) });
      expect(errors).toEqual([]);
    });
  });
}

test.describe('phone swipe', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('a swipe up on the canvas hops', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { __dhaka.startLevel(1, { seed: 3 }); __dhaka.freeze(false); });
    const box = await page.locator('#game').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.evaluate(([cx, cy]) => {
      const c = document.getElementById('game');
      const ev = (type, y) => c.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: y, pointerType: 'touch', bubbles: true, pointerId: 1 }));
      ev('pointerdown', cy); ev('pointerup', cy - 60);
    }, [cx, cy]);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => __dhaka.state().player.row)).toBe(1);
  });
});
