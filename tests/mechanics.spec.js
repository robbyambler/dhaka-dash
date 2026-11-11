// Core rules: damage by vehicle, lives, upgrades, extra lives, wrong-way
// drivers, trains, water, New Game+.
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test.describe('mechanics', () => {
  let errors;
  test.beforeEach(async ({ page }) => { errors = await boot(page); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('HP damage differs by vehicle type and matches the spec table', async ({ page }) => {
    const expected = { bicycle: 8, rickshaw: 12, moto: 18, cng: 22, car: 30, leguna: 35, pickup: 40, microbus: 45, bus: 65, truck: 80 };
    const got = {};
    for (const type of Object.keys(expected)) {
      got[type] = await page.evaluate((type) => {
        __dhaka.startLevel(1, { seed: 3 });
        const r = __dhaka.hitPlayerWith(type);
        return r.before - r.after;
      }, type);
    }
    expect(got).toEqual(expected);
    expect(new Set(Object.values(got)).size).toBeGreaterThan(8);
  });

  test('NG+ multiplies damage', async ({ page }) => {
    const d = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 3, ngPlus: 2 });
      const r = __dhaka.hitPlayerWith('car');
      return r.before - r.after;
    });
    expect(d).toBe(36); // 30 × 1.2
  });

  test('losing all HP costs a life; 0 lives gives game over', async ({ page }) => {
    let s = await page.evaluate(() => {
      __dhaka.startLevel(2, { seed: 3, lives: 2 });
      __dhaka.grant({ hp: 20 });
      __dhaka.hitPlayerWith('truck');
      return __dhaka.state();
    });
    expect(s.lives).toBe(1);
    expect(s.player.dead).toBe(true);
    s = await page.evaluate(() => __dhaka.stepFrames(120));
    expect(s.player.dead).toBe(false);
    expect(s.hp).toBe(100);
    expect(s.player.row).toBe(0);           // respawned at the level start
    expect(s.phase).toBe('playing');
    s = await page.evaluate(() => { __dhaka.grant({ hp: 10 }); __dhaka.hitPlayerWith('bus'); return __dhaka.stepFrames(120); });
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('gameOver');
  });

  test('tea raises Perception and measurably slows fast vehicles', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 9 });
      __dhaka.placePlayer(1, 10);
      __dhaka.spawnPickup('tea', 1, 10);
      __dhaka.stepFrames(2);
      const perc = __dhaka.state().upgrades.perception.lvl;
      // mean speed of fast vehicles on Gulshan with Perception 0 vs 5 (same seed)
      const meanFast = (p) => {
        __dhaka.startLevel(8, { seed: 5 });
        __dhaka.grant({ perception: p, hp: 100 });
        __dhaka.placePlayer(0, 10);
        let sum = 0, n = 0, slowSum = 0, slowN = 0;
        for (let i = 0; i < 20; i++) {
          const s = __dhaka.stepFrames(15);
          for (const v of s.vehicles) {
            if (v.warn) continue;
            if (v.base > 85) { sum += v.speed; n++; } else { slowSum += v.speed / v.base; slowN++; }
          }
        }
        return { fast: sum / n, slowRatio: slowSum / slowN };
      };
      return { perc, p0: meanFast(0), p5: meanFast(5) };
    });
    expect(r.perc).toBe(1);
    expect(r.p5.fast).toBeLessThan(r.p0.fast * 0.8);       // ~35% slower at level 5
    expect(Math.abs(r.p5.slowRatio - r.p0.slowRatio)).toBeLessThan(0.1); // slow vehicles unaffected
  });

  test('biscuits raise Speed and shorten hop time', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 9 });
      __dhaka.placePlayer(3, 5); // a safe median row
      __dhaka.hop('left');
      __dhaka.stepFrames(1);
      const before = __dhaka.state().player.hopDur;
      __dhaka.stepFrames(30);
      __dhaka.placePlayer(3, 10);
      __dhaka.spawnPickup('cookie', 3, 10);
      __dhaka.stepFrames(2);
      const lvl1 = __dhaka.state().upgrades.speed.lvl;
      __dhaka.grant({ speed: 2 });
      __dhaka.hop('right');
      __dhaka.stepFrames(1);
      const after = __dhaka.state().player.hopDur;
      return { before, after, lvl1, lvl: __dhaka.state().upgrades.speed.lvl };
    });
    expect(r.lvl1).toBe(1);
    expect(r.lvl).toBe(3);
    expect(r.after).toBeLessThan(r.before * 0.8);
    expect(r.after).toBeCloseTo(r.before * Math.pow(0.92, 3), 5);
  });

  test('upgrades need a rising number of pickups (1, 2, 2, 3, 3) and cap at 5', async ({ page }) => {
    const levels = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 9 });
      const out = [];
      for (let i = 0; i < 14; i++) {
        __dhaka.placePlayer(3, 10);
        __dhaka.spawnPickup('tea', 3, 10);
        __dhaka.stepFrames(1);
        out.push(__dhaka.state().upgrades.perception.lvl);
      }
      return out;
    });
    expect(levels).toEqual([1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5]);
  });

  test('extra life at 5,000 points, capped at 3 lives (full heal + 250 instead)', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 1, lives: 2 });
      const a = __dhaka.grant({ score: 4990 });
      const b = __dhaka.grant({ score: 10 });
      __dhaka.grant({ hp: 40 });
      const c = __dhaka.grant({ score: 5000 });
      return { a: a.lives, b: b.lives, c: c.lives, cHp: c.hp, cScore: c.score };
    });
    expect(r.a).toBe(2);
    expect(r.b).toBe(3);
    expect(r.c).toBe(3);
    expect(r.cHp).toBe(100);
    expect(r.cScore).toBe(10250);
  });

  test('wrong-way vehicles actually spawn and drive against their lane', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(10, { seed: 4 });
      __dhaka.placePlayer(0, 10);
      const seen = new Map();
      for (let i = 0; i < 60 * 40; i += 10) {
        const s = __dhaka.stepFrames(10);
        __dhaka.grant({ hp: 100 });
        for (const v of s.vehicles) if (v.wrongWay) seen.set(`${v.row}:${v.type}:${v.dir}`, v);
      }
      const s = __dhaka.state();
      return { count: seen.size, sample: [...seen.values()].slice(0, 3), laneDirs: s.rows };
    });
    expect(r.count).toBeGreaterThan(2);
  });

  test('wrong-way drivers go against the lane direction', async ({ page }) => {
    const ok = await page.evaluate(() => {
      __dhaka.startLevel(9, { seed: 8 });
      for (let i = 0; i < 400; i++) {
        const s = __dhaka.stepFrames(10);
        const ww = s.vehicles.find((v) => v.wrongWay && !v.warn);
        if (ww) {
          const others = s.vehicles.filter((v) => v.row === ww.row && !v.wrongWay);
          if (others.length) return others.every((o) => o.dir === -ww.dir);
        }
      }
      return false;
    });
    expect(ok).toBe(true);
  });

  test('train rows: warning, gate, a fast train, and 100 damage', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(5, { seed: 2 });
      const railRow = __dhaka.state().rows.indexOf('rail');
      const states = new Set();
      let gateDuringWarn = 0, train = null;
      for (let i = 0; i < 60 * 20; i++) {
        const s = __dhaka.stepFrames(1);
        __dhaka.grant({ hp: 100 });
        const rl = s.rail[0];
        states.add(rl.state);
        if (rl.state === 'warn') gateDuringWarn = Math.max(gateDuringWarn, rl.gate);
        if (rl.state === 'pass') { train = s.vehicles.find((v) => v.type === 'train'); if (train) break; }
      }
      // stand on the tracks while it passes
      __dhaka.placePlayer(railRow, 10);
      const before = __dhaka.state();
      let after = before;
      for (let i = 0; i < 180 && !after.player.dead; i++) after = __dhaka.stepFrames(1);
      return { railRow, states: [...states], gateDuringWarn, train, livesBefore: before.lives, livesAfter: after.lives, dead: after.player.dead };
    });
    expect(r.railRow).toBeGreaterThan(0);
    expect(r.states).toEqual(expect.arrayContaining(['idle', 'warn', 'pass']));
    expect(r.gateDuringWarn).toBeGreaterThan(0.9);
    expect(r.train.w).toBeGreaterThanOrEqual(14 * 32);
    expect(r.train.speed).toBeGreaterThan(400);
    expect(r.dead).toBe(true);
    expect(r.livesAfter).toBe(r.livesBefore - 1);
  });

  test('water rows: riding boats carries Rupa; missing a boat costs 40 HP and returns her', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(6, { seed: 3 });
      const s0 = __dhaka.state();
      const wRow = s0.rows.indexOf('water');
      // find a boat in that row and put Rupa on it
      const boat = s0.vehicles.find((v) => v.row === wRow && v.x > 64 && v.x + v.w < 560);
      __dhaka.placePlayer(wRow - 1, 10);
      // stand on the boat's centre
      __dhaka.placePlayer(wRow, 0);
      __dhaka.setPlayerX(boat.x + boat.w / 2);
      const x0 = __dhaka.state().player.x;
      const s1 = __dhaka.stepFrames(30);
      const ride = { dx: s1.player.x - x0, dir: boat.dir, hp: s1.hp, row: s1.player.row };
      // now drop her into open water
      __dhaka.placePlayer(wRow - 1, 10);
      __dhaka.stepFrames(2);
      let gapX = null;
      const sv = __dhaka.state();
      for (let x = 40; x < 600; x += 8) {
        if (!sv.vehicles.some((v) => v.row === wRow && x > v.x - 12 && x < v.x + v.w + 12)) { gapX = x; break; }
      }
      __dhaka.placePlayer(wRow, 0);
      __dhaka.setPlayerX(gapX);
      const s2 = __dhaka.stepFrames(2);
      return { wRow, ride, fall: { hp: s2.hp, row: s2.player.row } };
    });
    expect(r.ride.row).toBe(r.wRow);
    expect(Math.sign(r.ride.dx)).toBe(r.ride.dir);
    expect(Math.abs(r.ride.dx)).toBeGreaterThan(5);
    expect(r.ride.hp).toBe(100);
    expect(r.fall.hp).toBe(60);
    expect(r.fall.row).toBe(r.wRow - 1);
  });

  test('New Game+ starts after level 10 with harder parameters and carried-over upgrades', async ({ page }) => {
    const r = await page.evaluate(() => {
      __dhaka.startLevel(1, { seed: 6 });
      const base = __dhaka.state().params;
      __dhaka.startLevel(10, { seed: 6, score: 1234 });
      __dhaka.grant({ perception: 2, speed: 3 });
      __dhaka.autoplay(true);
      const clear = __dhaka.runUntil(['levelClear', 'gameOver'], 60 * 240);
      const vic = __dhaka.runUntil(['victory'], 60 * 10);
      __dhaka.autoplay(false);
      const ng = __dhaka.action('ngplus');
      return { base, clear: clear.phase, vic: vic.phase, ng };
    });
    expect(r.clear).toBe('levelClear');
    expect(r.vic).toBe('victory');
    expect(r.ng.level).toBe(1);
    expect(r.ng.ngPlus).toBe(1);
    expect(r.ng.phase).toBe('levelIntro');
    expect(r.ng.upgrades.perception.lvl).toBe(2);
    expect(r.ng.upgrades.speed.lvl).toBe(3);
    expect(r.ng.upgradeCap).toBe(6);
    expect(r.ng.score).toBeGreaterThan(1234);
    expect(r.ng.params.speedMul).toBeCloseTo(r.base.speedMul * 1.12, 5);
    expect(r.ng.params.dmgMul).toBeCloseTo(1.1, 5);
    expect(r.ng.params.scoreMul).toBeCloseTo(1.5, 5);
    expect(r.ng.params.wrongChance).toBeGreaterThan(r.base.wrongChance);
    expect(r.ng.params.gapMul).toBeLessThan(1);
  });
});
