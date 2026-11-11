// Shared helpers for the Playwright tests.
import fs from 'node:fs';
import path from 'node:path';

export const SHOTS = path.resolve('test-results/screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

// Load the game, collect console errors, wait for fonts + boot, freeze real-time
// simulation so tests drive it frame by frame (deterministic).
export async function boot(page, { lang = 'en', freeze = true } = {}) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript((l) => {
    if (!sessionStorage.getItem('dfInit')) {
      sessionStorage.setItem('dfInit', '1');
      localStorage.setItem('dhakaDash.v1', JSON.stringify({ lang: l }));
    }
  }, lang);
  await page.goto('/');
  await page.waitForFunction(() => window.__dhakaReady === true, null, { timeout: 20_000 });
  if (freeze) await page.evaluate(() => __dhaka.freeze(true));
  return errors;
}

export async function shot(page, name) {
  // let a couple of real frames render the current state
  await page.waitForTimeout(120);
  await page.locator('#game').screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

export const LEVEL_IDS = ['dhanmondi', 'newmarket', 'shahbagh', 'farmgate', 'karwanbazar', 'hatirjheel', 'mohakhali', 'gulshan', 'motijheel', 'sadarghat'];
