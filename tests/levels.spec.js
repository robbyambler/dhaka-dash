// Every level loads and renders without console errors, gets a mid-play
// screenshot, and can be completed by the seeded autoplay bot.
import { test, expect } from '@playwright/test';
import { boot, shot, LEVEL_IDS } from './helpers.js';

for (let n = 1; n <= 10; n++) {
  test(`level ${n} (${LEVEL_IDS[n - 1]}) loads, renders and is screenshotted mid-play`, async ({ page }) => {
    const errors = await boot(page);
    // let the bot play until Rupa is well into the level, so the shot shows
    // both traffic and the landmark backdrop
    const s = await page.evaluate((n) => {
      __dhaka.startLevel(n, { seed: 42 });
      __dhaka.autoplay(true);
      let st = __dhaka.stepFrames(60);
      const target = st.rows.length - 6;
      for (let i = 0; i < 60 * 60 && st.player.row < target && st.phase === 'playing'; i += 5) st = __dhaka.stepFrames(5);
      __dhaka.grant({ hp: 100 });
      return __dhaka.stepFrames(20);
    }, n);
    expect(s.level).toBe(n);
    expect(s.levelId).toBe(LEVEL_IDS[n - 1]);
    expect(s.vehicles.length).toBeGreaterThan(5);
    // canvas really drew something varied (not a blank / single colour frame)
    await page.waitForTimeout(150);
    const variety = await page.evaluate(() => {
      const c = document.getElementById('game');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
      return seen.size;
    });
    expect(variety).toBeGreaterThan(60);
    await page.evaluate(() => __dhaka.autoplay(false));
    await shot(page, `level-${String(n).padStart(2, '0')}-${LEVEL_IDS[n - 1]}`);
    expect(errors).toEqual([]);
  });
}

test('the autoplay bot completes every level (seeded) — with balance stats', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page);
  const results = [];
  for (let n = 1; n <= 10; n++) {
    for (const seed of [11, 22]) {
      const r = await page.evaluate(([n, seed]) => {
        __dhaka.startLevel(n, { seed });
        __dhaka.autoplay(true);
        const s = __dhaka.runUntil(['levelClear', 'gameOver'], 60 * 240);
        return { n, seed, phase: s.phase, secs: +(s.frames / 60).toFixed(1), hits: s.stats.hits, damage: s.stats.damage, falls: s.stats.falls, livesLost: s.stats.livesLost };
      }, [n, seed]);
      results.push(r);
    }
  }
  console.log('BOT STATS\n' + results.map((r) => `L${r.n} seed ${r.seed}: ${r.phase} in ${r.secs}s, hits ${r.hits}, damage ${r.damage}, falls ${r.falls}, lives lost ${r.livesLost}`).join('\n'));
  for (const r of results) expect(r.phase, `level ${r.n} seed ${r.seed}`).toBe('levelClear');
  expect(errors).toEqual([]);
});
