// Re-run with:  node scripts/make-assets.mjs   (needs the dev server: npm run dev, on port 5173)
// Or point it elsewhere:  BASE_URL=http://localhost:4173/ node scripts/make-assets.mjs
// Writes public/screenshot.png, public/og-image.png, public/favicon.svg and the PNG icons.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const LEVEL = Number(process.env.LEVEL || 8); // 8 = Gulshan-2 Circle at night
const out = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => localStorage.setItem('dhakaDash.v1', JSON.stringify({ lang: 'en' })));
await page.goto(BASE);
await page.waitForFunction(() => window.__dhakaReady === true, null, { timeout: 20000 });

// ---- 1. gameplay screenshot (clean, no overlay) ----
await page.evaluate((n) => {
  __dhaka.freeze(true);
  __dhaka.startLevel(n, { seed: 7 });
  __dhaka.stepFrames(240);
}, LEVEL);
await page.waitForTimeout(300);
await page.locator('#game').screenshot({ path: out('screenshot.png') });

// ---- 2. share image: the screenshot + title, composed in the game's own page so it has the game's fonts ----
const shot = fs.readFileSync(out('screenshot.png')).toString('base64');
await page.setViewportSize({ width: 1200, height: 630 });
await page.evaluate((b64) => {
  document.body.style.cssText = 'margin:0;display:block;overflow:hidden;';
  for (const el of document.body.children) el.style.display = 'none';
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;inset:0;width:1200px;height:630px;background:#0e0818;overflow:hidden;';
  card.innerHTML = `
    <img src="data:image/png;base64,${b64}" style="position:absolute;left:0;top:-22px;width:1200px;height:675px;image-rendering:auto;">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,8,24,.92) 0%,rgba(14,8,24,.78) 38%,rgba(14,8,24,0) 70%),linear-gradient(0deg,rgba(14,8,24,.85) 0%,rgba(14,8,24,0) 35%);"></div>
    <div style="position:absolute;left:64px;top:150px;">
      <div style="font:400 78px/1.15 'Press Start 2P';color:#ffd23a;text-shadow:6px 6px 0 #b54f00,0 0 30px rgba(255,210,58,.35);">DHAKA<br>DASH</div>
      <div style="margin-top:34px;font:800 92px/1.1 'Baloo Da 2';color:#ffe9c8;text-shadow:4px 4px 0 #064a46;">ঢাকা দৌড়</div>
    </div>
    <div style="position:absolute;left:64px;bottom:40px;font:700 30px 'Hind Siliguri';color:#ffe9c8;">Help Rupa cross ten Dhaka roads · বাংলা ও English</div>`;
  document.body.appendChild(card);
}, shot);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: out('og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });

// Shrink the share image: round colours to a coarser step so the PNG compresses to well under 400KB.
{
  const b64 = fs.readFileSync(out('og-image.png')).toString('base64');
  const small = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 1200, 630);
    for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, Math.round(d.data[i + k] / 5) * 5);
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, b64);
  fs.writeFileSync(out('og-image.png'), Buffer.from(small, 'base64'));
}

// ---- 3. icons: Rupa's face, drawn as a 16x16 pixel grid ----
const C = { bg: '#0e0818', skin: '#b07850', hair: '#141018', hairH: '#3a2a3a', eye: '#1a1014', lip: '#a83a3a', orna: '#ff8a1e', ornaH: '#ffc070', ornaD: '#d8620a', kam: '#11a39a', red: '#c8302a', white: '#ffffff' };
const px = []; // [x, y, w, h, color] on a 16x16 grid
const r = (x, y, w, h, c) => px.push([x, y, w, h, c]);
r(0, 0, 16, 16, C.bg);
r(3, 11, 10, 5, C.orna); r(4, 11, 8, 1, C.ornaH); r(3, 14, 3, 2, C.ornaD); // scarf
r(1, 14, 2, 2, C.kam); r(13, 14, 2, 2, C.kam);                              // shoulders
r(4, 2, 8, 9, C.skin);                                                      // face
r(3, 1, 10, 3, C.hair); r(3, 4, 2, 6, C.hair); r(11, 4, 2, 6, C.hair); r(5, 1, 6, 1, C.hairH); // hair
r(5, 6, 2, 2, C.eye); r(9, 6, 2, 2, C.eye); r(5, 6, 1, 1, C.white); r(9, 6, 1, 1, C.white);    // eyes
r(7, 4, 2, 1, C.red); r(7, 9, 2, 1, C.lip);                                // teep + smile
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">\n` +
  px.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('\n') + `\n</svg>\n`;
fs.writeFileSync(out('favicon.svg'), svg);

const sizes = { 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
for (const [file, s] of Object.entries(sizes)) {
  const b64 = await page.evaluate(([grid, s]) => {
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    for (const [x, y, w, h, col] of grid) { g.fillStyle = col; g.fillRect(x * s / 16, y * s / 16, Math.ceil(w * s / 16), Math.ceil(h * s / 16)); }
    return c.toDataURL('image/png').split(',')[1];
  }, [px, s]);
  fs.writeFileSync(out(file), Buffer.from(b64, 'base64'));
}
await browser.close();
console.log('done');
