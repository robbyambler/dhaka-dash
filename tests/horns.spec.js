// Horns: density-scaled ambient honking, reactive warnings, a voice cap, and
// silence when muted. Counted through window.__dhaka.hornStats() — we can't
// listen in a headless browser, but every honk goes through one counted gate.
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test.describe('horns', () => {
  test('honk rate scales with traffic density (level 1 vs level 8), by class', async ({ page }) => {
    const errors = await boot(page);
    const r = await page.evaluate(() => {
      // Rupa waits on the start footpath for one minute of play
      const run = (n) => { __dhaka.startLevel(n, { seed: 5 }); __dhaka.stepFrames(60 * 60); return __dhaka.hornStats(); };
      return { l1: run(1), l8: run(8) };
    });
    console.log(`HORNS / min — L1: ${r.l1.events} ${JSON.stringify(r.l1.byClass)} ${JSON.stringify(r.l1.byReason)}\n` +
      `HORNS / min — L8: ${r.l8.events} ${JSON.stringify(r.l8.byClass)} ${JSON.stringify(r.l8.byReason)}`);
    expect(r.l1.events).toBeGreaterThan(8);
    expect(r.l8.events).toBeGreaterThan(r.l1.events * 1.5);
    expect(r.l8.events).toBeLessThan(150);              // present, not a wall of noise
    // Dhanmondi is a rickshaw road: bells dominate. Gulshan is cars and motorbikes.
    const top = (s) => Object.entries(s.byClass).sort((a, b) => b[1] - a[1])[0][0];
    expect(top(r.l1)).toBe('bell');
    expect(['car', 'moto']).toContain(top(r.l8));
    expect(r.l1.played).toBe(r.l1.events);               // unmuted: every honk is sounded
    expect(errors).toEqual([]);
  });

  test('vehicles honk a warning when Rupa stands in their lane ahead of them', async ({ page }) => {
    const errors = await boot(page);
    const r = await page.evaluate(() => {
      __dhaka.startLevel(3, { seed: 8 });
      __dhaka.stepFrames(30 * 60);                       // 30 s on the footpath
      const footpath = __dhaka.hornStats().byReason.warn || 0;
      __dhaka.startLevel(3, { seed: 8 });
      const row = __dhaka.state().rows.indexOf('road');
      for (let f = 0; f < 30 * 60; f += 20) {            // 30 s standing in the first lane
        __dhaka.placePlayer(row, 10);
        __dhaka.grant({ hp: 100, lives: 3 });
        __dhaka.stepFrames(20);
      }
      return { footpath, lane: __dhaka.hornStats().byReason.warn || 0 };
    });
    console.log(`warning honks in 30 s — on the footpath: ${r.footpath}, standing in a lane: ${r.lane}`);
    expect(r.footpath).toBe(0);
    expect(r.lane).toBeGreaterThan(5);
    expect(errors).toEqual([]);
  });

  test('voice cap: at most 3 horns at once (4 with a wrong-way driver)', async ({ page }) => {
    const errors = await boot(page);
    const r = await page.evaluate(() => {
      __dhaka.startLevel(9, { seed: 3 });
      __dhaka.stepFrames(60);
      const normal = __dhaka.honkAll('warn');            // every vehicle on screen tries at once
      __dhaka.stepFrames(120);                            // let those voices finish
      const wrong = __dhaka.honkAll('wrong');
      __dhaka.stepFrames(120);
      __dhaka.stepFrames(60 * 60);                        // and a dense minute of natural play
      return { normal, wrong, stats: __dhaka.hornStats(), vehicles: __dhaka.state().vehicles.length };
    });
    expect(r.vehicles).toBeGreaterThan(8);
    expect(r.normal).toBe(3);
    expect(r.wrong).toBe(4);
    expect(r.stats.dropped).toBeGreaterThan(0);
    expect(r.stats.maxVoices).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
  });

  test('mute: honk arcs still show, but zero horn sounds are played', async ({ page }) => {
    const errors = await boot(page);
    const r = await page.evaluate(() => {
      __dhaka.startLevel(8, { seed: 5 });
      __dhaka.action('mute');
      __dhaka.stepFrames(30 * 60);
      const s = __dhaka.hornStats();
      __dhaka.action('mute');                             // restore
      return { muted: s, state: __dhaka.state().muted };
    });
    expect(r.muted.events).toBeGreaterThan(5);
    expect(r.muted.played).toBe(0);
    expect(r.state).toBe(false);
    expect(errors).toEqual([]);
  });

  test('audio is not started before the first user gesture', async ({ page }) => {
    await page.addInitScript(() => {
      window.__acCount = 0;
      const Orig = window.AudioContext;
      if (Orig) window.AudioContext = class extends Orig { constructor(...a) { super(...a); window.__acCount++; } };
    });
    const errors = await boot(page);
    const n = await page.evaluate(() => {
      __dhaka.startLevel(4, { seed: 1 });
      __dhaka.stepFrames(20 * 60);                        // plenty of honks, no gesture
      return { contexts: window.__acCount, honks: __dhaka.hornStats().events };
    });
    expect(n.honks).toBeGreaterThan(0);
    expect(n.contexts).toBe(0);
    expect(errors).toEqual([]);
  });
});
