// The far-side backdrop of each level: its landmark, buildings and signboards.
// Each painter draws in world coordinates onto the static ground canvas.
// `base` is the y of the goal footpath's back edge — buildings stand on it.
// Each level also has a distant `skyline` painted to a separate parallax layer.

import { W } from '../config.js';
import { rect, shade, circle, signboard, drawSign, rgba, mix } from '../gfx.js';
import { building, signStack, wires, pole, treeSprite, palmSprite } from './common.js';

// Draw a sprite object returned by common.js at a ground anchor
function put(g, s, x, y) { g.drawImage(s.spr, Math.round(x - s.ox), Math.round(y - s.oy)); }

function sign(g, text, x, y, o = {}) {
  const s = signboard(text, { size: 10, padX: 3, ...o });
  const sx = Math.round(x - (o.center === false ? 0 : s.logicalW / 2));
  drawSign(g, s, sx, Math.round(y));
  if (o.eg) drawSign(o.eg, s, sx, Math.round(y)); // neon / lit signs glow through the night
  return s;
}

// A run of ordinary Dhaka buildings between x0 and x1 with stacked signboards
function cityBlock(g, x0, x1, base, r, o = {}) {
  let x = x0;
  const texts = o.signs || [];
  let ti = 0;
  while (x < x1) {
    const w = Math.min(x1 - x, 40 + Math.floor(r() * 46));
    const h = (o.minH || 60) + Math.floor(r() * ((o.maxH || 120) - (o.minH || 60)));
    const color = o.colors ? o.colors[Math.floor(r() * o.colors.length)] : ['#e6dcc4', '#d8c08a', '#b8c9a5', '#e0b8b0', '#c8c8c0', '#e8e4d8'][Math.floor(r() * 6)];
    building(g, x, base, w, h, { color, r, lit: o.lit, glass: o.glass, balcony: true, eg: o.eg });
    if (ti < texts.length && w > 34) {
      const n = Math.min(2, texts.length - ti);
      signStack(g, x + 2, base - h + 6 + Math.floor(r() * 10), w - 4, texts.slice(ti, ti + n), r, { size: 10, minW: w - 6 });
      ti += n;
    }
    x += w + (r() < 0.3 ? 2 : 0);
  }
}

function clouds(g, r, y0, n, col = '#f2f4f8') {
  for (let i = 0; i < n; i++) {
    const cx = r() * W, cy = y0 + r() * 30;
    for (let k = 0; k < 6; k++) circle(g, cx + k * 7 - 18, cy - Math.sin(k / 5 * Math.PI) * 6, 6 + r() * 4, col);
  }
}

function hazeBand(g, y, h, col, a) {
  for (let i = 0; i < h; i++) { g.fillStyle = rgba(col, a * (1 - i / h)); g.fillRect(0, y + i, W, 1); }
}

// ---- distant skylines (parallax layer, transparent above) ---------------------

export function skyline(g, levelId, h, r) {
  const far = {
    dhanmondi: '#a8b8b0', newmarket: '#a8b4c8', shahbagh: '#a8b8c8', farmgate: '#6a7480', karwanbazar: '#b8b4a8',
    hatirjheel: '#c89a8a', mohakhali: '#5a4a7a', gulshan: '#1a1a3a', motijheel: '#c8c8c8', sadarghat: '#8a4a6a',
  }[levelId];
  let x = -10;
  while (x < W) {
    const w = 20 + Math.floor(r() * 40);
    const bh = 30 + Math.floor(r() * (levelId === 'gulshan' || levelId === 'karwanbazar' ? 90 : 60));
    rect(g, x, h - bh, w, bh, far);
    rect(g, x, h - bh, w, 1, shade(far, 0.1));
    if (r() < 0.4) rect(g, x + 4, h - bh - 6, 2, 6, far); // antenna / tank
    if (levelId === 'gulshan' || levelId === 'mohakhali') {
      for (let wy = h - bh + 4; wy < h - 4; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r() < 0.3) rect(g, wx, wy, 2, 2, r() < 0.6 ? '#ffd97a' : '#9fd8ff');
    }
    x += w - 2;
  }
  if (levelId === 'dhanmondi' || levelId === 'shahbagh' || levelId === 'hatirjheel') {
    for (let i = 0; i < 18; i++) circle(g, r() * W, h - 6, 10 + r() * 10, mix(far, '#2f5a2a', 0.5));
  }
}

// ---- the ten landmarks ------------------------------------------------------------------

export const LANDMARKS = {
  dhanmondi(g, base, r, out) {
    clouds(g, r, 20, 3, 'rgba(255,255,255,0.55)');
    // far bank: cream apartment blocks + tree tops
    cityBlock(g, 0, W, base - 74, r, { minH: 40, maxH: 78, colors: ['#e8e4d8', '#e6dcc4', '#d8d0bc', '#efe4d0'], signs: ['ডাক্তারের চেম্বার', 'কোচিং সেন্টার', 'বই ঘর'] });
    for (let i = 0; i < 16; i++) put(g, treeSprite(100 + i, { w: 40, h: 46, flame: i % 5 === 2 }), i * 42 + r() * 10, base - 66);
    // the lake: dark bottle-green, nearly opaque, reflecting trees
    rect(g, 0, base - 70, W, 48, '#2e5b3a');
    for (let y = base - 70; y < base - 22; y += 3) rect(g, 0, y, W, 1, rgba('#4b6b35', 0.5));
    for (let i = 0; i < 40; i++) rect(g, r() * W, base - 66 + r() * 42, 6 + r() * 14, 1, rgba('#9fc8b0', 0.35));
    for (let i = 0; i < 14; i++) { const lx = r() * W, ly = base - 40 + r() * 16; circle(g, lx, ly, 3, '#7ca83a'); rect(g, lx, ly - 1, 2, 1, '#2e5b3a'); if (i % 3 === 0) rect(g, lx + 1, ly - 2, 2, 2, '#f2a6c8'); }
    // low footbridge across the lake (concrete deck, white railing, red-white kerb)
    const fx = 300, fw = 200;
    rect(g, fx, base - 56, fw, 6, '#c8c0b4');
    rect(g, fx, base - 50, fw, 4, '#9a9286');
    for (let x = fx; x < fx + fw; x += 8) rect(g, x, base - 50, 4, 2, (x / 8) % 2 ? '#d8282a' : '#f0f0f0');
    rect(g, fx, base - 62, fw, 1, '#e6d3cf'); rect(g, fx, base - 59, fw, 1, '#e6d3cf');
    for (let x = fx; x < fx + fw; x += 10) rect(g, x, base - 62, 1, 6, '#e6d3cf');
    for (let x = fx + 20; x < fx + fw; x += 60) rect(g, x, base - 46, 6, 24, '#8a8276');
    // lakeside walkway, white spear fence + hedge
    rect(g, 0, base - 22, W, 12, '#b9afa2');
    for (let x = 0; x < W; x += 8) rect(g, x, base - 22, 1, 12, '#a39888');
    rect(g, 0, base - 10, W, 10, '#3f7a33');
    for (let x = 0; x < W; x += 4) { rect(g, x, base - 16, 1, 8, '#e8e8e4'); rect(g, x, base - 17, 1, 1, '#ffffff'); }
    rect(g, 0, base - 12, W, 1, '#e8e8e4');
    for (let x = 0; x < W; x += 5) rect(g, x, base - 10 + (x % 10 ? 0 : 1), 4, 3, '#4e8a3a');
    // big lake sign
    const s = sign(g, 'ধানমন্ডি লেক', 140, base - 104, { bg: '#1b6a3a', fg: '#ffffff', size: 13, sub: 'রবীন্দ্র সরোবর', subSize: 7 });
    rect(g, 140 - 1, base - 104 + s.logicalH, 2, 82 - s.logicalH, '#4a4a4a');
    sign(g, 'ধানমন্ডি ২৭', 540, base - 92, { bg: '#1e5bb8', fg: '#fff', size: 9 });
    rect(g, 539, base - 78, 2, 56, '#4a4a4a');
  },

  newmarket(g, base, r) {
    clouds(g, r, 14, 4);
    // wide stone wall wings (3 storeys) + a giant pointed arch in the centre
    const stone = '#d9b8a4', stoneD = '#c79c86';
    const wallTop = base - 92;
    building(g, 0, base, 236, 92, { color: stone, r, floorH: 24, winW: 10, shopH: 20, tank: false, grill: false });
    building(g, 404, base, 236, 92, { color: stone, r, floorH: 24, winW: 10, shopH: 20, tank: false, grill: false });
    // terracotta mini-roofs over windows
    for (let x = 12; x < 230; x += 56) { rect(g, x, wallTop + 22, 24, 3, '#b8553a'); rect(g, x + 2, wallTop + 20, 20, 2, '#d8754a'); }
    for (let x = 416; x < 634; x += 56) { rect(g, x, wallTop + 22, 24, 3, '#b8553a'); rect(g, x + 2, wallTop + 20, 20, 2, '#d8754a'); }
    // the arch: thick grey-white shell, pointed (ogee) top
    const ax = 236, aw = 168, cx = ax + aw / 2;
    rect(g, ax, base - 92, aw, 92, stoneD);
    for (let y = 0; y < 150; y++) {
      // outer shell profile
      const t = y / 150;
      const half = y < 30 ? (y / 30) * 40 : 40 + Math.sin(((y - 30) / 120) * Math.PI / 2) * 44;
      rect(g, cx - half, base - 150 + y, half * 2, 1, y < 4 ? '#fafaf6' : '#e8e6e0');
    }
    for (let y = 0; y < 118; y++) {
      const half = y < 26 ? (y / 26) * 26 : 26 + Math.sin(((y - 26) / 92) * Math.PI / 2) * 28;
      rect(g, cx - half, base - 118 + y, half * 2, 1, mix('#3a2a24', '#5a4438', y / 118));
    }
    rect(g, cx - 1, base - 160, 2, 12, '#e8e6e0'); circle(g, cx, base - 161, 2, '#f2c21a');
    // four slim red pillars with cream onion caps
    for (const px of [ax + 6, ax + 22, ax + aw - 28, ax + aw - 12]) {
      rect(g, px, base - 118, 6, 118, '#a64b34'); rect(g, px, base - 118, 2, 118, '#c8644a');
      circle(g, px + 3, base - 122, 4, '#e6d6c0'); rect(g, px + 2, base - 130, 2, 5, '#e6d6c0');
    }
    // white minaret far right
    rect(g, 600, base - 168, 12, 76, '#f0ece4'); rect(g, 596, base - 140, 20, 4, '#d8d4cc'); circle(g, 606, base - 172, 6, '#f0ece4'); rect(g, 605, base - 184, 2, 8, '#d8d4cc');
    // banners and signboards
    sign(g, 'নিউ মার্কেট', cx, base - 140, { bg: '#c62828', fg: '#fff7d6', size: 13 });
    signStack(g, 10, wallTop + 30, 100, ['জুতার দোকান', 'কসমেটিকস'], r, { size: 10 });
    signStack(g, 120, wallTop + 30, 100, ['শাড়ি ও থ্রি-পিস', 'ঈদ কালেকশন'], r, { size: 10 });
    signStack(g, 420, wallTop + 30, 100, ['বাচ্চাদের পোশাক', 'বইয়ের দোকান'], r, { size: 10 });
    signStack(g, 528, wallTop + 30, 100, ['নিলক্ষেত বই বাজার', 'ফটোকপি ও প্রিন্ট'], r, { size: 10 });
    wires(g, 0, base - 70, 236, base - 64, 4, 8);
    wires(g, 404, base - 64, W, base - 70, 4, 8);
  },

  shahbagh(g, base, r) {
    // trees behind, National Museum (cream modernist block with portico)
    for (let i = 0; i < 16; i++) put(g, treeSprite(200 + i, { w: 46, h: 60, flame: i % 4 === 1 }), i * 42, base - 70);
    const mx = 160, mw = 300, mh = 108;
    building(g, mx, base, mw, mh, { color: '#e8dcc0', r, floorH: 20, winW: 8, shopH: 0, tank: false, grill: false });
    // portico: tall rectangular frame with columns
    rect(g, mx + 90, base - mh - 8, 120, 10, '#f2ead6');
    for (let c = 0; c < 7; c++) rect(g, mx + 94 + c * 18, base - mh + 2, 6, mh - 2, '#f6efe0');
    rect(g, mx + 90, base - 16, 120, 16, '#c8b898');
    for (let s = 0; s < 4; s++) rect(g, mx + 96 + s * 4, base - 16 + s * 4, 108 - s * 8, 2, '#a89878'); // steps
    sign(g, 'জাতীয় জাদুঘর', mx + 150, base - mh - 26, { bg: '#7a2a1a', fg: '#f6efe0', size: 12 });
    // metro station: brick-red block with curved grey roof + green gutter (left)
    building(g, 0, base, 150, 84, { color: '#a5432f', r, floorH: 16, winW: 8, shopH: 0, tank: false, grill: false });
    for (let y = 0; y < 84; y += 8) rect(g, 0, base - 84 + y, 150, 1, '#c9714b');
    for (let x = 0; x < 150; x++) rect(g, x, base - 98 + Math.round(Math.pow((x - 75) / 75, 2) * 8), 1, 14 - Math.round(Math.pow((x - 75) / 75, 2) * 8), x % 6 ? '#9a9a94' : '#b4b2aa');
    rect(g, 0, base - 86, 150, 3, '#1f8f58'); rect(g, 0, base - 83, 150, 1, '#c0262d');
    sign(g, 'ঢাকা মেট্রোরেল', 75, base - 70, { bg: '#1f8f58', fg: '#ffffff', size: 10 });
    sign(g, 'শাহবাগ', 75, base - 50, { bg: '#ffffff', fg: '#1f8f58', size: 11 });
    // right: public library + university
    building(g, 470, base, 170, 76, { color: '#e8e4d8', r, floorH: 14, shopH: 14 });
    signStack(g, 476, base - 70, 158, ['পাবলিক লাইব্রেরি', 'ঢাকা বিশ্ববিদ্যালয়'], r, { size: 10 });
    sign(g, 'শাহবাগ মোড়', 330, base - 12, { bg: '#1e5bb8', fg: '#fff', size: 9 });
  },

  farmgate(g, base, r) {
    // monsoon-dark high-rises with stacked signs, metro station head
    cityBlock(g, 0, 250, base, r, { minH: 90, maxH: 150, colors: ['#b5c9a5', '#a8b4a0', '#c8c8c0', '#9aa8b0'], signs: ['শাপলা ব্যাংক', 'ফার্মেসি', 'মোবাইল রিচার্জ', 'আজকের অফার ৫০%', 'কৃষি বীজ ভান্ডার', 'পানির জার'] });
    // metro station: terracotta block with sloped green roof
    building(g, 250, base, 200, 96, { color: '#a9482f', r, floorH: 16, shopH: 18, grill: false, tank: false });
    for (let x = 0; x < 200; x++) rect(g, 250 + x, base - 112 + Math.floor(x / 25), 1, 16 - Math.floor(x / 25), x % 5 ? '#1b9a5b' : '#16804a');
    sign(g, 'ফার্মগেট', 350, base - 88, { bg: '#ffffff', fg: '#1b9a5b', size: 13 });
    sign(g, 'ঢাকা মেট্রোরেল', 350, base - 64, { bg: '#1b9a5b', fg: '#ffffff', size: 10 });
    cityBlock(g, 450, W, base, r, { minH: 100, maxH: 160, colors: ['#c8c0b0', '#b5c9a5', '#d8d0c0'], signs: ['টাকা পে', 'সাবধানে রাস্তা পার হোন', 'ফার্মেসি', 'মোবাইল রিচার্জ'] });
    sign(g, 'টাকা পে', 548, base - 30, { bg: '#e2136e', fg: '#ffffff', size: 11 });
    wires(g, 0, base - 60, W, base - 66, 5, 12);
    // elevated expressway beam far behind
    rect(g, 0, base - 168, W, 8, '#7a8088'); rect(g, 0, base - 168, W, 1, '#9aa0a8');
  },

  karwanbazar(g, base, r) {
    // glass towers + green scaffold tower + cream mid-rise
    building(g, 20, base, 90, 170, { color: '#4c7da0', r, floorH: 8, winW: 4, shopH: 0, glass: '#6f8fa8', grill: false, tank: false });
    building(g, 120, base, 70, 150, { color: '#2d4a33', r, floorH: 6, winW: 3, shopH: 0, glass: '#3a5a40', grill: false });
    for (let y = base - 150; y < base; y += 6) rect(g, 120, y, 70, 1, '#5a7a5a');
    for (let x = 120; x < 190; x += 8) rect(g, x, base - 150, 1, 150, '#8a7a4a'); // bamboo scaffold
    building(g, 196, base, 130, 80, { color: '#e9e3ce', r, floorH: 14 });
    sign(g, 'দৈনিক ঢাকার আলো', 261, base - 110, { bg: '#ffffff', fg: '#d32b1f', size: 13 });
    building(g, 340, base, 110, 140, { color: '#6f8fa8', r, floorH: 8, winW: 5, shopH: 0, glass: '#4c7da0', grill: false });
    sign(g, 'দৈনিক বুড়িগঙ্গা বার্তা', 395, base - 152, { bg: '#0d3b66', fg: '#ffffff', size: 10 });
    building(g, 460, base, 180, 70, { color: '#d8c8a8', r, floorH: 14 });
    signStack(g, 470, base - 66, 160, ['কারওয়ান বাজার', 'পাইকারি সবজি'], r, { size: 11 });
    // market sheds on the far footpath edge
    for (let x = 0; x < W; x += 80) {
      rect(g, x, base - 24, 76, 4, ['#2d6fb5', '#26a69a', '#d87c6b'][(x / 80) % 3]);
      rect(g, x + 2, base - 20, 2, 20, '#8a6a4a'); rect(g, x + 72, base - 20, 2, 20, '#8a6a4a');
    }
    signStack(g, 210, base - 76, 100, ['আড়ত', 'তাজা মাছ'], r, { size: 10 });
    sign(g, 'পেঁয়াজ, আলু, রসুন', 560, base - 40, { bg: '#f2c21a', fg: '#1a1a1a', size: 9 });
    sign(g, 'ফলের আড়ত', 80, base - 40, { bg: '#1b8a4a', fg: '#ffffff', size: 9 });
    wires(g, 0, base - 50, W, base - 56, 5, 10);
  },

  hatirjheel(g, base, r) {
    // far shore: pale towers
    cityBlock(g, 0, W, base - 66, r, { minH: 30, maxH: 90, colors: ['#cfcfcb', '#d8d0c8', '#e0d4c0'], signs: [] });
    // wide flat water, golden reflections
    rect(g, 0, base - 70, W, 58, '#5e7e75');
    for (let y = base - 70; y < base - 12; y += 2) rect(g, 0, y, W, 1, rgba(y % 4 ? '#7a7a3c' : '#9ab0a0', 0.25));
    for (let i = 0; i < 50; i++) rect(g, r() * W, base - 66 + r() * 52, 4 + r() * 18, 1, rgba('#ffcf7a', 0.5));
    // transmission pylons standing in the water
    for (const px of [70, 560]) {
      for (let y = 0; y < 120; y++) { const hw = 2 + (y / 120) * 12; rect(g, px - hw, base - 140 + y, 1, 1, '#5b5e63'); rect(g, px + hw, base - 140 + y, 1, 1, '#5b5e63'); if (y % 12 === 0) rect(g, px - hw, base - 140 + y, hw * 2, 1, '#5b5e63'); }
      rect(g, px - 16, base - 128, 32, 2, '#5b5e63');
    }
    wires(g, 70, base - 128, 560, base - 128, 3, 16, '#3a3c40');
    // the three white arches of descending size with hangers
    const deckY = base - 40;
    rect(g, 40, deckY, 560, 5, '#e4e6e8'); rect(g, 40, deckY + 5, 560, 2, '#a8aab0');
    const arches = [[200, 150, 66], [380, 110, 48], [520, 80, 34]];
    for (const [cx, span, hgt] of arches) {
      for (let x = -span / 2; x <= span / 2; x++) {
        const y = deckY - Math.round(hgt * (1 - Math.pow((2 * x) / span, 2)));
        rect(g, cx + x, y, 1, 4, '#f4f6f8');
        rect(g, cx + x, y + 4, 1, 1, '#b8bcc4');
        if (Math.round(x) % 8 === 0) rect(g, cx + x, y + 4, 1, deckY - y - 4, '#d0d4d8');
      }
    }
    for (let x = 60; x < 600; x += 70) rect(g, x, deckY + 7, 6, 20, '#c8ccd0');
    // paver walkway + bollards
    rect(g, 0, base - 12, W, 12, '#b7a79a');
    for (let x = 0; x < W; x += 6) rect(g, x, base - 12, 1, 12, '#a39385');
    sign(g, 'হাতিরঝিল', 120, base - 96, { bg: '#1e5bb8', fg: '#ffffff', size: 13 });
    sign(g, 'ওয়াটার ট্যাক্সি', 330, base - 30, { bg: '#f9a825', fg: '#1a1a1a', size: 9 });
    sign(g, 'টিকিট কাউন্টার', 470, base - 30, { bg: '#ffffff', fg: '#1e5bb8', size: 9 });
  },

  mohakhali(g, base, r, out) {
    const eg = out.eg;
    // inter-district bus terminal with bus-company boards, grey buildings, neon coming on
    cityBlock(g, 0, 200, base, r, { minH: 80, maxH: 130, colors: ['#9a9890', '#b0aca0', '#8a8a84'], lit: 0.35, eg, signs: ['আইসিডিডিআর,বি', 'চা, সিগারেট, পান', 'টিকিট কাউন্টার'] });
    building(g, 200, base, 260, 74, { color: '#c8c0b0', r, floorH: 18, winW: 12, shopH: 22, lit: 0.6, grill: false, eg });
    rect(g, 200, base - 80, 260, 6, '#2a6fce');
    sign(g, 'আন্তঃজেলা বাস টার্মিনাল', 330, base - 106, { bg: '#c8322b', fg: '#ffffff', size: 12, eg });
    const cos = [['বুড়িগঙ্গা পরিবহন', '#f2c417', '#1a1a1a'], ['সবুজ ছায়া এন্টারপ্রাইজ', '#1e9e8e', '#ffffff'], ['তারাবাতি পরিবহন', '#7b3fa0', '#ffffff']];
    cos.forEach(([t, bg, fg], i) => sign(g, t, 248 + i * 84, base - 64, { bg, fg, size: 9, eg }));
    sign(g, 'ঢাকা থেকে সিলেট', 290, base - 40, { bg: '#ffffff', fg: '#c8322b', size: 8 });
    sign(g, 'কক্সবাজার', 400, base - 40, { bg: '#ffffff', fg: '#2a6fce', size: 8 });
    cityBlock(g, 460, W, base, r, { minH: 90, maxH: 140, colors: ['#9a9890', '#a8a49c'], lit: 0.4, eg, signs: ['মহাখালী', 'মহাখালী রেলগেট', 'সাবধান! ট্রেন আসছে'] });
    wires(g, 0, base - 70, W, base - 60, 6, 14);
    out.glows.push({ x: 330, y: base - 100, r: 40, color: '#ff4a3a', a: 0.35 });
    out.glows.push({ x: 248, y: base - 58, r: 26, color: '#ffd23a', a: 0.3 });
  },

  gulshan(g, base, r, out) {
    const eg = out.eg;
    // stars
    for (let i = 0; i < 60; i++) rect(g, r() * W, r() * (base - 160), 1, 1, r() < 0.5 ? '#ffffff' : '#9fd8ff');
    // dense glass towers, one cylindrical, LED billboards
    const towers = [[0, 70, 180, '#2a3a5a'], [72, 60, 150, '#1f3f4a'], [134, 80, 190, '#2a3050'], [380, 70, 170, '#203a48'], [452, 90, 196, '#2a2a4a'], [544, 96, 160, '#1f3f4a']];
    for (const [x, w, h, c] of towers) building(g, x, base, w, h, { color: c, r, floorH: 8, winW: 4, shopH: 16, lit: 0.45, glass: '#1a2238', grill: false, tank: false, eg });
    // cylindrical tower with horizontal banding
    const cx = 300, cr = 50, ch = 200;
    for (let x = -cr; x < cr; x++) {
      const sh = Math.cos((x / cr) * Math.PI / 2);
      rect(g, cx + x, base - ch, 1, ch, mix('#0f1a2a', '#3a6a8a', sh * 0.8));
    }
    for (let y = base - ch + 4; y < base - 10; y += 7) for (let x = -cr + 3; x < cr - 3; x += 3) if (r() < 0.55) { const c = r() < 0.7 ? '#ffd97a' : '#9fd8ff'; rect(g, cx + x, y, 2, 3, c); rect(eg, cx + x, y, 2, 3, c); }
    rect(g, cx - cr, base - ch - 6, cr * 2, 6, '#2a3a5a');
    // neon & LED signs
    const neon = [['ডেল্টা টাওয়ার', '#28e0ff', 30, 70], ['পলাশ ব্যাংক', '#ff3d9a', 112, 112], ['রেস্টুরেন্ট ও ক্যাফে', '#3dff8a', 420, 96], ['পিৎজা, বার্গার', '#f26b1d', 500, 60], ['ডায়মন্ড ও গহনা', '#ffd23a', 590, 120]];
    for (const [t, col, x, y] of neon) {
      sign(g, t, x, base - y, { bg: '#0b1030', fg: col, size: 10, border: col, eg });
      out.glows.push({ x, y: base - y + 7, r: 26, color: col, a: 0.3 });
    }
    // LED screen on a pole
    rect(g, 236, base - 120, 3, 120, '#3a3a40');
    for (const gg of [g, eg]) { rect(gg, 212, base - 150, 52, 30, '#d8ecff'); rect(gg, 214, base - 148, 48, 26, '#1ca9e3'); rect(gg, 220, base - 140, 20, 10, '#f26b1d'); rect(gg, 244, base - 144, 14, 18, '#ffffff'); }
    out.glows.push({ x: 238, y: base - 135, r: 40, color: '#1ca9e3', a: 0.3 });
    sign(g, 'গুলশান ২', 300, base - 226, { bg: '#0b1030', fg: '#ffffff', size: 12, border: '#ffffff', eg });
    // Gulshan Lake glimpse (left) with reflected light spots
    rect(g, 0, base - 20, 130, 14, '#0a1428');
    for (let i = 0; i < 20; i++) { const c = r() < 0.5 ? '#ffd97a' : '#ff3d9a'; const lx = r() * 130, ly = base - 18 + r() * 10; rect(g, lx, ly, 4, 1, c); rect(eg, lx, ly, 4, 1, c); }
    sign(g, 'গুলশান লেক', 64, base - 34, { bg: '#0b1030', fg: '#9fd8ff', size: 8, eg });
    sign(g, 'স্বাগতম গুলশানে', 470, base - 30, { bg: '#0b1030', fg: '#ffffff', size: 8, border: '#ffffff', eg });
  },

  motijheel(g, base, r) {
    // boxy 1960s office blocks: horizontal window rows with vertical fins
    const blocks = [[0, 130, 150, '#e9e7df', 'বাংলাদেশ ব্যাংক'], [134, 120, 120, '#c8c0b4', 'শালুক ব্যাংক লিমিটেড'], [380, 120, 140, '#e9e7df', 'জীবন বীমা ভবন'], [504, 136, 110, '#8b7f72', 'স্টক এক্সচেঞ্জ']];
    for (const [x, w, h, c, label] of blocks) {
      building(g, x, base, w, h, { color: c, r, floorH: 12, winW: 10, shopH: 16, grill: false });
      for (let fx = x + 2; fx < x + w; fx += 7) rect(g, fx, base - h, 2, h - 16, shade(c, 0.12)); // fins
      sign(g, label, x + w / 2, base - h + 8, { bg: '#1b3e7a', fg: '#ffffff', size: 10 });
    }
    // metro terminus (centre back)
    building(g, 254, base, 126, 70, { color: '#9a9a94', r, floorH: 14, shopH: 0, tank: false, grill: false });
    for (let x = 0; x < 126; x++) rect(g, 254 + x, base - 82 + Math.round(Math.pow((x - 63) / 63, 2) * 6), 1, 12, x % 6 ? '#9a9a94' : '#b4b2aa');
    rect(g, 254, base - 72, 126, 3, '#1f8f58');
    sign(g, 'মতিঝিল', 317, base - 62, { bg: '#1f8f58', fg: '#ffffff', size: 12 });
    sign(g, 'ঢাকা মেট্রোরেল', 317, base - 40, { bg: '#ffffff', fg: '#1f8f58', size: 9 });
    sign(g, 'মতিঝিল বাণিজ্যিক এলাকা', 160, base - 12, { bg: '#1e5bb8', fg: '#ffffff', size: 8 });
    sign(g, 'গরম চা, পিঠা', 520, base - 12, { bg: '#c62828', fg: '#fff7d6', size: 8 });
    wires(g, 0, base - 60, W, base - 54, 4, 10);
  },

  sadarghat(g, base, r) {
    // Ahsan Manzil: long salmon-pink 2-storey palace, central dome, grand staircase
    const px = 150, pw = 340, ph = 70;
    // palms behind
    for (const x of [100, 130, 510, 540]) put(g, palmSprite(x), x, base - 10);
    rect(g, px, base - ph, pw, ph, '#e7967f');
    rect(g, px, base - ph - 6, pw, 6, '#f2b6a2');
    for (let x = px; x < px + pw; x += 8) rect(g, x + 2, base - ph - 10, 4, 4, '#f2b6a2'); // parapet finials
    rect(g, px, base - 36, pw, 3, '#f2b6a2');
    for (let fl = 0; fl < 2; fl++) {
      for (let x = px + 8; x < px + pw - 10; x += 14) {
        if (Math.abs(x - (px + pw / 2)) < 40) continue;
        const wy = base - ph + 6 + fl * 34;
        rect(g, x, wy + 3, 8, 22, '#b8672f'); circle(g, x + 4, wy + 3, 4, '#b8672f');
        rect(g, x, wy + 10, 8, 1, '#8a4a20');
      }
    }
    rect(g, px + pw - 4, base - ph, 4, ph, '#b2685a');
    // central portico with paired columns
    const cx = px + pw / 2;
    rect(g, cx - 40, base - ph - 14, 80, ph + 14, '#f2b6a2');
    for (const dx of [-36, -28, 24, 32]) rect(g, cx + dx, base - ph - 8, 5, ph + 8, '#fff0e8');
    // octagonal drum + big pale-rose dome + spire
    rect(g, cx - 22, base - ph - 34, 44, 20, '#e7967f');
    for (let x = -20; x < 20; x += 6) rect(g, cx + x, base - ph - 30, 3, 10, '#b8672f');
    for (let y = 0; y < 30; y++) { const hw = Math.sqrt(Math.max(0, 900 - (30 - y) * (30 - y))) * 0.9; rect(g, cx - hw, base - ph - 64 + y, hw * 2, 1, y < 4 ? '#f2b6a2' : '#d49a84'); }
    rect(g, cx - 1, base - ph - 76, 2, 12, '#c8a24e'); circle(g, cx, base - ph - 76, 2, '#c8a24e');
    // grand staircase
    for (let s = 0; s < 8; s++) rect(g, cx - 30 - s * 4, base - 34 + s * 4, 60 + s * 8, 4, s % 2 ? '#6a6460' : '#7a7470');
    // flag pole with Bangladesh flag
    rect(g, px - 20, base - 120, 2, 120, '#d8d8d8'); rect(g, px - 18, base - 120, 18, 11, '#006a4e'); circle(g, px - 10, base - 115, 3, '#f42a41');
    sign(g, 'আহসান মঞ্জিল', cx - 110, base - ph - 30, { bg: '#7a2a3a', fg: '#fff0e8', size: 12 });
    // riverside old buildings left/right
    cityBlock(g, 0, 90, base, r, { minH: 60, maxH: 100, colors: ['#c9536a', '#c8a24e', '#b8a58f'], signs: ['ইসলামপুর কাপড়ের হাট', 'বাহারি বিরিয়ানি'] });
    cityBlock(g, 560, W, base, r, { minH: 60, maxH: 100, colors: ['#c8a24e', '#c9536a'], signs: ['লঞ্চ টার্মিনাল'] });
    // shore: dirt + sacks + boat landing signs
    rect(g, 0, base - 8, W, 8, '#b8a58f');
    sign(g, 'নৌকা ঘাট', 70, base - 24, { bg: '#1b8a4a', fg: '#ffffff', size: 9 });
    sign(g, 'পার ২ টাকা', 580, base - 24, { bg: '#f2c21a', fg: '#1a1a1a', size: 9 });
  },
};

export { put, sign, hazeBand };
