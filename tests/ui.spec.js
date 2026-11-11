// Screens in English and Bengali, language toggle + persistence, fonts.
import { test, expect } from '@playwright/test';
import { boot, shot } from './helpers.js';
import { STRINGS_FOR_TEST } from '../src/i18n.js';
import { LEVELS } from '../src/levels.js';

for (const lang of ['en', 'bn']) {
  test(`screens render in ${lang.toUpperCase()}: title, HUD, pause, game over, victory`, async ({ page }) => {
    const errors = await boot(page, { lang });
    expect(await page.evaluate(() => __dhaka.fontsOk())).toBe(true);
    expect(await page.evaluate(() => __dhaka.state().lang)).toBe(lang);

    // title (attract mode running behind)
    await page.evaluate(() => __dhaka.stepFrames(150));
    await shot(page, `title-${lang}`);

    // HUD mid-play with some upgrades, a pickup and NG+ badge
    await page.evaluate(() => {
      __dhaka.startLevel(3, { seed: 21, ngPlus: 1, score: 3450, lives: 2 });
      __dhaka.grant({ perception: 2, speed: 1, hp: 72 });
      __dhaka.autoplay(true);
      __dhaka.stepFrames(200);
      __dhaka.autoplay(false);
      __dhaka.spawnPickup('tea', 2, 6);
      __dhaka.spawnPickup('cookie', 4, 13);
      __dhaka.stepFrames(1);
    });
    await shot(page, `hud-${lang}`);

    // pause menu
    await page.evaluate(() => __dhaka.action('pause'));
    await shot(page, `pause-${lang}`);
    await page.evaluate(() => __dhaka.action('resume'));

    // level intro card + tutorial hints
    await page.evaluate(() => { __dhaka.startLevel(1, { seed: 2, intro: true, ngPlus: 0 }); __dhaka.stepFrames(40); });
    await shot(page, `intro-${lang}`);

    // game over
    const go = await page.evaluate(() => {
      __dhaka.startLevel(4, { seed: 5, lives: 1, score: 2100, ngPlus: 0 });
      __dhaka.stepFrames(30);
      __dhaka.grant({ hp: 5 });
      __dhaka.hitPlayerWith('bus');
      return __dhaka.stepFrames(150).phase;
    });
    expect(go).toBe('gameOver');
    await page.evaluate(() => __dhaka.stepFrames(60));
    await shot(page, `gameover-${lang}`);

    // victory (bot clears level 10)
    const vic = await page.evaluate(() => {
      __dhaka.startLevel(10, { seed: 6, score: 48210, ngPlus: 0 });
      __dhaka.autoplay(true);
      __dhaka.runUntil(['levelClear', 'gameOver'], 60 * 240);
      const s = __dhaka.runUntil(['victory'], 60 * 10);
      __dhaka.autoplay(false);
      __dhaka.stepFrames(70);
      return s.phase;
    });
    expect(vic).toBe('victory');
    await shot(page, `victory-${lang}`);
    expect(errors).toEqual([]);
  });
}

test('language toggle (L key) switches strings instantly and persists across reload', async ({ page }) => {
  const errors = await boot(page, { lang: 'en' });
  expect(await page.evaluate(() => __dhaka.t('score'))).toBe('SCORE');
  await page.keyboard.press('KeyL');
  const s = await page.evaluate(() => { __dhaka.stepFrames(1); return { lang: __dhaka.state().lang, score: __dhaka.t('score'), pause: __dhaka.t('paused') }; });
  expect(s.lang).toBe('bn');
  expect(s.score).toBe('স্কোর');
  expect(s.pause).toBe('বিরতি');
  await page.reload();
  await page.waitForFunction(() => window.__dhakaReady === true);
  expect(await page.evaluate(() => __dhaka.state().lang)).toBe('bn');
  expect(await page.evaluate(() => __dhaka.t('gameOver'))).toBe('খেলা শেষ');
  // and back again via the pause-menu action
  await page.evaluate(() => { __dhaka.freeze(true); __dhaka.startLevel(1); __dhaka.action('pause'); __dhaka.action('lang'); });
  expect(await page.evaluate(() => __dhaka.state().lang)).toBe('en');
  await page.reload();
  await page.waitForFunction(() => window.__dhakaReady === true);
  expect(await page.evaluate(() => __dhaka.state().lang)).toBe('en');
  expect(errors).toEqual([]);
});

test('every UI string and level text has a real Bengali translation', () => {
  const { en, bn } = STRINGS_FOR_TEST;
  expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
  const sameOk = new Set(['titleAlt', 'langButton', 'title']); // swapped by design
  for (const k of Object.keys(en)) {
    if (sameOk.has(k)) continue;
    expect(bn[k], k).not.toBe(en[k]);
    // must contain Bengali script (except pure symbols)
    if (/[A-Za-z]{3,}/.test(en[k])) expect(/[ঀ-৿]/.test(bn[k]), `${k}: ${bn[k]}`).toBe(true);
  }
  for (const L of LEVELS) {
    expect(/[ঀ-৿]/.test(L.name.bn)).toBe(true);
    expect(/[ঀ-৿]/.test(L.tagline.bn)).toBe(true);
  }
});
