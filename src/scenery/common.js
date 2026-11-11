// Shared scenery painters: ground rows (road, footpath, median, rail, water),
// buildings with Bengali signboards, and small prop sprites (trees, lamps,
// people, stalls, dogs, crows…). Colours follow docs/dhaka-reference.md.

import { TILE, W } from '../config.js';
import { makeCanvas, rect, shade, mix, circle, signboard, drawSign, rgba } from '../gfx.js';
import { artRng } from '../rng.js';

// ---- ground rows ----------------------------------------------------------------

// Black-and-white painted kerb blocks — on every Dhaka median.
export function kerb(g, x, y, w, h = 4, a = '#1e1e22', b = '#dadad6') {
  for (let i = 0; i < w; i += 16) {
    rect(g, x + i, y, Math.min(16, w - i), h, (i / 16) % 2 ? a : b);
  }
  rect(g, x, y, w, 1, 'rgba(255,255,255,0.25)');
}

function speckle(g, x, y, w, h, colors, n, r) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(Math.floor(x + r() * w), Math.floor(y + r() * h), 1 + (r() < 0.2 ? 1 : 0), 1);
  }
}

export function paintRoad(g, y, P, r, o = {}) {
  const base = o.wet ? shade(P.asphalt, -0.3) : P.asphalt;
  rect(g, 0, y, W, TILE, base);
  speckle(g, 0, y, W, TILE, [shade(base, 0.12), shade(base, -0.15), shade(base, 0.05)], 380, r);
  // patches + potholes + oil stains
  for (let i = 0; i < 3; i++) {
    const px = Math.floor(r() * (W - 60));
    rect(g, px, y + 6 + Math.floor(r() * 14), 20 + Math.floor(r() * 40), 6 + Math.floor(r() * 6), shade(base, r() < 0.5 ? 0.08 : -0.1));
  }
  if (r() < 0.6) { const px = Math.floor(r() * W); rect(g, px, y + 12, 7, 4, shade(base, -0.35)); rect(g, px + 1, y + 12, 5, 1, shade(base, -0.5)); }
  if (r() < 0.3) { const px = Math.floor(r() * (W - 20)); circle(g, px, y + 16, 5, shade(base, -0.2)); circle(g, px, y + 16, 4, '#5a5a60'); rect(g, px - 3, y + 15, 7, 1, '#46464c'); rect(g, px - 3, y + 17, 7, 1, '#46464c'); }
  if (o.wet) {
    // puddles that reflect the sky
    for (let i = 0; i < 3; i++) {
      const px = Math.floor(r() * (W - 50)), py = y + 8 + Math.floor(r() * 14);
      const pw = 18 + Math.floor(r() * 30);
      rect(g, px, py, pw, 4, mix(base, P.sky1 || '#7e8a98', 0.55));
      rect(g, px + 2, py - 1, pw - 4, 1, mix(base, P.sky1 || '#7e8a98', 0.4));
      rect(g, px + 4, py + 1, pw - 10, 1, 'rgba(255,255,255,0.25)');
    }
  }
  // lane markings at the top edge of this lane
  if (o.line === 'dash') {
    for (let x = 6; x < W; x += 40) rect(g, x, y, 20, 2, rgba(P.line, 0.75));
  } else if (o.line === 'double') {
    rect(g, 0, y - 1, W, 1, P.yellow || '#d8b02a');
    rect(g, 0, y + 1, W, 1, P.yellow || '#d8b02a');
  }
  // faded wheel tracks
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(0, y + 21, W, 3);
  g.fillRect(0, y + 9, W, 2);
  // gutter along a kerb: dark grime + litter (chip packets, paper, a paan stain)
  if (o.gutterBottom || o.gutterTop) {
    const gy = o.gutterBottom ? y + TILE - 4 : y + 1;
    rect(g, 0, gy, W, 3, rgba('#1a1612', 0.45));
    for (let i = 0; i < 26; i++) {
      const lx = Math.floor(r() * W);
      rect(g, lx, gy + Math.floor(r() * 3), 2, 1, ['#e8e4d8', '#d23a2a', '#2a7ad2', '#f2c21a', '#3aa84a', '#8a2a2a'][Math.floor(r() * 6)]);
    }
  }
}

// Zebra crossing painted across a road row (x0..x0+w)
export function zebraOnRow(g, x0, w, y) {
  for (let x = x0; x < x0 + w; x += 6) rect(g, x, y + 3, 3, TILE - 6, 'rgba(232,230,220,0.62)');
}


export function paintFootpath(g, y, P, r, { kerbFace = false } = {}) {
  const tile = P.paver || '#8c5a47';
  rect(g, 0, y, W, TILE, tile);
  // paver grid
  for (let yy = y + 1; yy < y + TILE; yy += 8) rect(g, 0, yy, W, 1, shade(tile, -0.18));
  for (let yy = 0; yy < 4; yy++) {
    for (let x = (yy % 2) * 8; x < W; x += 16) rect(g, x, y + 1 + yy * 8, 1, 7, shade(tile, -0.18));
  }
  speckle(g, 0, y, W, TILE, [shade(tile, 0.15), shade(tile, -0.12)], 260, r);
  // yellow tactile strip
  rect(g, 0, y + 13, W, 5, P.tactile || '#c9a12e');
  for (let x = 1; x < W; x += 3) rect(g, x, y + 14, 1, 3, shade(P.tactile || '#c9a12e', 0.25));
  // broken tiles
  for (let i = 0; i < 6; i++) rect(g, Math.floor(r() * W), y + 2 + Math.floor(r() * 24), 6, 5, shade(tile, -0.28));
  if (kerbFace) kerb(g, 0, y + TILE - 5, W, 5);
  else rect(g, 0, y, W, 2, shade(tile, 0.25));
}

export function paintMedianBase(g, y, P, r, kind) {
  // Raised median: top surface + black/white kerb face along the bottom
  const top = P.medianTop || '#8a8a7a';
  rect(g, 0, y, W, TILE, P.asphalt);
  rect(g, 0, y + 3, W, TILE - 7, top);
  rect(g, 0, y + 3, W, 1, shade(top, 0.3));
  kerb(g, 0, y + TILE - 6, W, 5);
  kerb(g, 0, y + 1, W, 2);
  if (['trees', 'flowers', 'planter', 'circle', 'lakeside'].includes(kind)) {
    // grass + clipped hedge
    rect(g, 0, y + 5, W, TILE - 12, P.grass || '#4e7a32');
    speckle(g, 0, y + 5, W, TILE - 12, [shade(P.grass || '#4e7a32', 0.2), shade(P.grass || '#4e7a32', -0.2)], 300, r);
    for (let x = 0; x < W; x += 6) rect(g, x, y + 16 + (x % 12 ? 0 : 1), 5, 6, x % 12 ? '#3f7a33' : '#356a2c');
  } else if (kind === 'ghat') {
    // wooden pontoon jetty
    rect(g, 0, y + 3, W, TILE - 7, '#8a6a44');
    for (let x = 0; x < W; x += 10) rect(g, x, y + 3, 1, TILE - 7, '#5a4228');
    rect(g, 0, y + 3, W, 1, '#b8946a');
  } else {
    speckle(g, 0, y + 3, W, TILE - 9, [shade(top, 0.12), shade(top, -0.12)], 200, r);
  }
}

export function paintRail(g, y, P, r) {
  rect(g, 0, y, W, TILE, '#6b665e');
  speckle(g, 0, y, W, TILE, ['#7c766e', '#5a554e', '#8a847a', '#4a4640'], 900, r);
  // sleepers
  for (let x = 2; x < W; x += 9) rect(g, x, y + 8, 5, 18, '#4a3a2c');
  // two rails with shine
  for (const ry of [y + 10, y + 21]) {
    rect(g, 0, ry, W, 3, '#6b4430');
    rect(g, 0, ry, W, 1, '#c8c0b8');
  }
  // the road crossing plates
  rect(g, 0, y + 1, W, 2, '#4a4640');
}

export function paintWaterRow(g, y, P, r) {
  rect(g, 0, y, W, TILE, P.water);
  speckle(g, 0, y, W, TILE, [shade(P.water, 0.1), shade(P.water, -0.1)], 200, r);
}

// ---- buildings ---------------------------------------------------------------------

// A Dhaka building seen from the ¾ view: roof top face + front facade.
// (x, baseY) = bottom-left of the facade.
export function building(g, x, baseY, w, h, o = {}) {
  const r = o.r || artRng(x * 7 + h);
  const col = o.color || '#e6dcc4';
  const roofH = o.roofH ?? 6;
  const top = baseY - h;
  // roof (top face) with water tanks / clutter
  rect(g, x, top - roofH, w, roofH, shade(col, -0.1));
  rect(g, x, top - roofH, w, 1, shade(col, 0.2));
  if (o.tank !== false && w > 30) {
    const tx = x + 4 + Math.floor(r() * (w - 16));
    rect(g, tx, top - roofH - 6, 8, 7, r() < 0.5 ? '#1c1c22' : '#2a5ab0');
    rect(g, tx, top - roofH - 6, 8, 1, '#5a6a8a');
  }
  if (o.billboard) {
    const bx = x + 2, bw = Math.min(w - 4, 50);
    rect(g, bx + 4, top - roofH - 8, 1, 8, '#333'); rect(g, bx + bw - 5, top - roofH - 8, 1, 8, '#333');
  }
  // facade
  rect(g, x, top, w, h, col);
  // stains streaking down
  for (let i = 0; i < Math.floor(w / 10); i++) {
    const sx = x + Math.floor(r() * w);
    rect(g, sx, top + Math.floor(r() * 6), 1 + Math.floor(r() * 2), 6 + Math.floor(r() * h * 0.5), rgba('#3a2a1a', 0.12));
  }
  // side shading for depth
  rect(g, x + w - 3, top, 3, h, shade(col, -0.22));
  rect(g, x, top, 1, h, shade(col, 0.15));
  // windows
  const fh = o.floorH || 12;
  const floors = Math.floor((h - (o.shopH ?? 14)) / fh);
  const ww = o.winW || 6;
  for (let f = 0; f < floors; f++) {
    const wy = top + 3 + f * fh;
    rect(g, x, wy + fh - 3, w, 1, shade(col, -0.12)); // floor line
    for (let wx = x + 3; wx + ww < x + w - 3; wx += ww + 4) {
      const lit = o.lit && r() < o.lit;
      const glass = lit ? (r() < 0.5 ? '#ffd97a' : '#9fd8ff') : (o.glass || '#2a3440');
      rect(g, wx, wy, ww, fh - 5, glass);
      if (lit && o.eg) rect(o.eg, wx, wy, ww, fh - 5, glass); // stays bright at night
      if (!lit && o.grill !== false) {
        // grilled windows (dark grids)
        g.fillStyle = rgba('#000000', 0.35);
        for (let gx = wx + 2; gx < wx + ww; gx += 2) g.fillRect(gx, wy, 1, fh - 5);
      }
      rect(g, wx, wy + fh - 6, ww, 1, shade(col, -0.3));
      // AC boxes and balconies
      if (r() < 0.12) rect(g, wx + ww - 3, wy + fh - 8, 5, 3, '#d8d8d0');
      if (o.balcony && r() < 0.3) { rect(g, wx - 1, wy + fh - 6, ww + 2, 2, shade(col, -0.25)); rect(g, wx + 1, wy + fh - 8, 2, 2, ['#d23a2a', '#2a7ad2', '#e8c23a'][Math.floor(r() * 3)]); }
    }
  }
  // ground floor shops: rolling shutters + awnings
  if ((o.shopH ?? 14) > 0) {
    const sh = o.shopH ?? 14;
    const sy = baseY - sh;
    rect(g, x, sy, w, sh, shade(col, -0.35));
    for (let sx = x + 2; sx < x + w - 10; sx += 14) {
      const open = r() < 0.7;
      rect(g, sx, sy + 3, 11, sh - 3, open ? '#2a2018' : '#8a8f96');
      if (!open) for (let yy = sy + 4; yy < baseY; yy += 2) rect(g, sx, yy, 11, 1, '#6a6f76');
      else { rect(g, sx + 1, sy + 6, 9, 3, ['#d23a2a', '#e8c23a', '#2a7ad2', '#3aa84a', '#f06292'][Math.floor(r() * 5)]); rect(g, sx + 2, sy + 9, 2, 3, '#e8e0d0'); }
      // striped awning
      const ac = ['#d8282a', '#2a6ad8', '#2a9a4a', '#f2a01f'][Math.floor(r() * 4)];
      for (let ax = 0; ax < 13; ax++) rect(g, sx - 1 + ax, sy, 1, 3, ax % 4 < 2 ? ac : '#f0ece0');
    }
  }
}

// Stack of Bengali signboards on a facade. texts = ['…', '…']
const SIGN_COLORS = [
  ['#c62828', '#fff7d6'], ['#1e5bb8', '#ffffff'], ['#f2c21a', '#1a1a1a'], ['#1b8a4a', '#ffffff'],
  ['#ffffff', '#c62828'], ['#e2136e', '#ffffff'], ['#0d3b66', '#ffd23a'], ['#f26b1d', '#ffffff'],
];
export function signStack(g, x, y, w, texts, r, o = {}) {
  let yy = y;
  for (const t of texts) {
    const [bg, fg] = o.colors ? o.colors : SIGN_COLORS[Math.floor(r() * SIGN_COLORS.length)];
    const s = signboard(t, { bg, fg, size: o.size || 10, minW: Math.min(w, o.minW ?? w * 0.7), padX: 3 });
    const sx = x + Math.round((w - s.logicalW) / 2);
    drawSign(g, s, Math.max(x - 4, sx), yy);
    // little brackets/shadow
    rect(g, Math.max(x - 4, sx), yy + s.logicalH, s.logicalW, 1, 'rgba(0,0,0,0.3)');
    yy += s.logicalH + 2;
  }
  return yy;
}

// Sagging cable bundle between two points (drawn on the ground canvas or overhead)
export function wires(g, x0, y0, x1, y1, n = 4, sag = 10, color = '#1b1b1e') {
  g.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const s = sag + k * 2;
    const steps = Math.ceil(Math.abs(x1 - x0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * s + k * 1.2;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

export function pole(g, x, baseY, h = 64) {
  rect(g, x, baseY - h, 3, h, '#8a8a84');
  rect(g, x, baseY - h, 1, h, '#b0b0aa');
  rect(g, x - 5, baseY - h + 4, 13, 2, '#5a5a56');
  rect(g, x - 3, baseY - h + 7, 9, 4, '#1b1b1e'); // tangle
  rect(g, x - 6, baseY - h + 9, 4, 3, '#2a2a2e');
}

// ---- prop sprites ----------------------------------------------------------------
// Each returns { spr, ox, oy } where (ox, oy) is the sprite's ground anchor.

const SKIN = ['#8d5a3b', '#a8714a', '#6e4429', '#b98258'];

export function treeSprite(seed, o = {}) {
  const r = artRng(seed);
  const w = o.w || 44, h = o.h || 58;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const leaf = o.leaf || ['#2f5a2a', '#4e7f32', '#8cb33f'];
  // trunk
  rect(g, w / 2 - 2, h - 20, 5, 20, '#5a3e2a');
  rect(g, w / 2 - 2, h - 20, 1, 20, '#7a5a3e');
  rect(g, w / 2 - 6, h - 16, 4, 2, '#5a3e2a');
  // canopy: layered blobs dark → light
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([w / 2 + (r() - 0.5) * (w - 18), 14 + r() * (h - 40), 7 + r() * 7]);
  for (const [bx, by, br] of blobs) circle(g, bx, by + 2, br, leaf[0]);
  for (const [bx, by, br] of blobs) circle(g, bx - 1, by, br - 2, leaf[1]);
  for (const [bx, by, br] of blobs) if (r() < 0.6) circle(g, bx - 3, by - 3, Math.max(2, br - 6), leaf[2]);
  if (o.flame) for (let i = 0; i < 26; i++) rect(g, 4 + r() * (w - 8), 4 + r() * (h - 30), 2, 2, r() < 0.5 ? '#d9441e' : '#f26b1d'); // krishnochura
  return { spr: c, ox: w / 2, oy: h };
}

export function palmSprite(seed) {
  const r = artRng(seed);
  const c = makeCanvas(36, 64), g = c.getContext('2d');
  for (let y = 20; y < 64; y++) rect(g, 17 + Math.round(Math.sin(y / 10) * 2), y, 3, 1, y % 4 ? '#7a6248' : '#5a4632');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    for (let s = 0; s < 14; s++) rect(g, 18 + Math.cos(a) * s, 20 + Math.sin(a) * s * 0.5 + s * s * 0.04, 2, 2, s % 3 ? '#3a6e2e' : '#5a9a3a');
  }
  return { spr: c, ox: 18, oy: 64 };
}

export function lampSprite(o = {}) {
  const h = o.h || 56;
  const c = makeCanvas(30, h), g = c.getContext('2d');
  rect(g, 14, 6, 2, h - 6, '#4a4c52'); rect(g, 14, 6, 1, h - 6, '#6a6c72');
  rect(g, 12, h - 4, 6, 4, '#3a3c42');
  // double arm
  rect(g, 4, 5, 22, 2, '#4a4c52');
  rect(g, 2, 6, 6, 3, '#2a2c32'); rect(g, 22, 6, 6, 3, '#2a2c32');
  rect(g, 3, 9, 4, 1, '#fff2c0'); rect(g, 23, 9, 4, 1, '#fff2c0');
  return { spr: c, ox: 15, oy: h, light: [{ dx: -10, dy: -h + 10 }, { dx: 10, dy: -h + 10 }] };
}

// Pedestrian: two frames (idle sway / step). kind: man, woman, student, hijab
export function personSprite(seed, kind = null) {
  const r = artRng(seed);
  const k = kind || ['man', 'woman', 'student', 'hijab', 'man', 'lungi'][Math.floor(r() * 6)];
  const skin = SKIN[Math.floor(r() * 4)];
  const shirt = ['#f0f0f0', '#d23a2a', '#2a7ad2', '#e8c23a', '#3aa86a', '#7a3a9a', '#f06292', '#ff8a1e'][Math.floor(r() * 8)];
  const sari = ['#d81b60', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#9ba06a', '#111111', '#12a88f'][Math.floor(r() * 8)];
  const lungi = ['#2a6a4a', '#3a4a8a', '#6a3a2a'][Math.floor(r() * 3)];
  const cap = r() < 0.25;
  const frames = [0, 1].map((f) => {
    const c = makeCanvas(10, 22), g = c.getContext('2d');
    const legOff = f ? 1 : 0;
    if (k === 'woman' || k === 'hijab') {
      rect(g, 2, 9, 6, 11, sari); rect(g, 2, 9, 1, 11, shade(sari, -0.3));
      rect(g, 3, 20, 2, 2, '#3a2a1a'); rect(g, 6 - legOff, 20, 2, 2, '#3a2a1a');
      if (k === 'hijab') { rect(g, 2, 1, 6, 9, sari); rect(g, 3, 3, 4, 4, skin); }
      else { rect(g, 3, 2, 4, 5, skin); rect(g, 2, 1, 6, 3, '#141018'); rect(g, 7, 3, 1, 6, '#141018'); rect(g, 1, 8, 8, 2, shade(sari, 0.3)); }
    } else {
      const lower = k === 'lungi' ? lungi : (k === 'student' ? '#2a3a5a' : '#3a3a40');
      rect(g, 3, 15, 4, 5, lower);
      if (k === 'lungi') { rect(g, 2, 14, 6, 6, lower); rect(g, 2, 16, 6, 1, shade(lower, 0.3)); }
      else { rect(g, 3, 15, 2, 5 + legOff, lower); rect(g, 5, 15, 2, 5 - legOff, lower); }
      rect(g, 3, 20, 2, 2, '#2a1a10'); rect(g, 5, 20 - legOff, 2, 2, '#2a1a10');
      rect(g, 2, 8, 6, 8, shirt); rect(g, 2, 8, 1, 8, shade(shirt, -0.25));
      rect(g, 3, 2, 4, 6, skin); rect(g, 3, 1, 4, 2, '#141018');
      if (k === 'student') { rect(g, 6, 9, 3, 6, '#3a3f8a'); }
      if (cap) rect(g, 3, 0, 4, 2, '#f0ece0'); // tupi cap
      rect(g, 1 + legOff, 10, 1, 5, skin); rect(g, 8 - legOff, 10, 1, 5, skin);
    }
    return c;
  });
  return { frames, ox: 5, oy: 22, anim: 0.5 + r() * 0.5 };
}

export function dogSprite(seed) {
  const r = artRng(seed);
  const col = ['#c8a070', '#8a6a4a', '#e8d8c0', '#4a3a2a'][Math.floor(r() * 4)];
  const frames = [0, 1].map((f) => {
    const c = makeCanvas(16, 10), g = c.getContext('2d');
    if (f === 0) { // lying down, curled
      rect(g, 2, 5, 11, 4, col); rect(g, 11, 3, 4, 4, col); rect(g, 12, 2, 1, 2, shade(col, -0.3)); rect(g, 1, 6, 2, 2, col);
      rect(g, 13, 4, 1, 1, '#111');
    } else { // standing, tail up
      rect(g, 3, 3, 9, 4, col); rect(g, 11, 1, 4, 4, col); rect(g, 12, 0, 1, 2, shade(col, -0.3));
      rect(g, 3, 7, 1, 3, col); rect(g, 10, 7, 1, 3, col); rect(g, 1, 1, 2, 3, col);
      rect(g, 13, 2, 1, 1, '#111');
    }
    return c;
  });
  return { frames, ox: 8, oy: 10, anim: 2.5 };
}

export function crowFrames() {
  return [0, 1].map((f) => {
    const c = makeCanvas(12, 7), g = c.getContext('2d');
    rect(g, 4, 3, 5, 2, '#1a1a20'); rect(g, 9, 2, 2, 2, '#2a2a30'); rect(g, 11, 3, 1, 1, '#4a4a4a');
    if (f) { rect(g, 2, 0, 4, 3, '#1a1a20'); } else { rect(g, 2, 5, 4, 2, '#1a1a20'); }
    rect(g, 0, 3, 4, 1, '#1a1a20');
    return c;
  });
}

// Tea stall (tong): wooden box counter, kettle, glass jars, bench, sign "চা"
export function teaStall(seed, label = 'চা') {
  const r = artRng(seed);
  const c = makeCanvas(48, 44), g = c.getContext('2d');
  // canopy (blue tarp) on bamboo poles
  rect(g, 2, 4, 44, 5, '#2a6ad0'); rect(g, 2, 4, 44, 1, '#6a9af0');
  rect(g, 3, 9, 2, 33, '#a88a5a'); rect(g, 43, 9, 2, 33, '#a88a5a');
  // counter box
  rect(g, 8, 22, 32, 20, '#8a5a32'); rect(g, 8, 22, 32, 3, '#b07a48');
  rect(g, 10, 27, 28, 13, '#6a4428');
  // jars of biscuits, kettle, cups
  for (let i = 0; i < 4; i++) { rect(g, 10 + i * 7, 15, 5, 7, 'rgba(220,240,255,0.7)'); rect(g, 11 + i * 7, 17, 3, 4, ['#e0a448', '#d23a2a', '#e8c23a', '#c8862a'][i]); }
  rect(g, 34, 14, 6, 7, '#b8b8c0'); rect(g, 40, 16, 2, 2, '#b8b8c0'); rect(g, 35, 12, 4, 2, '#8a8a92');
  // hanging banana bunch + chips packets
  rect(g, 12, 9, 4, 5, '#e8d23a'); rect(g, 20, 9, 3, 6, '#d23a6a'); rect(g, 25, 9, 3, 6, '#2a9ad2'); rect(g, 30, 9, 3, 6, '#f2a01f');
  // vendor
  rect(g, 24, 14, 5, 2, '#141018'); rect(g, 24, 16, 5, 4, SKIN[2]); rect(g, 23, 20, 7, 3, '#f0f0f0');
  const sign = signboard(label, { bg: '#c62828', fg: '#fff7d6', size: 10, padX: 3 });
  return { spr: c, ox: 24, oy: 44, sign, signDx: -sign.logicalW / 2, signDy: -50 };
}

export function fruitCart(seed) {
  const r = artRng(seed);
  const c = makeCanvas(40, 30), g = c.getContext('2d');
  rect(g, 2, 14, 36, 4, '#8a5a32'); rect(g, 2, 18, 36, 3, '#6a4428');
  circle(g, 8, 25, 4, '#222'); circle(g, 32, 25, 4, '#222');
  const fruits = [['#e8d23a', '#c8b02a'], ['#e8642a', '#c84a1a'], ['#3a9a3a', '#2a7a2a'], ['#d23a3a', '#a82a2a']];
  for (let i = 0; i < 16; i++) { const [a, b] = fruits[Math.floor(r() * 4)]; circle(g, 6 + (i % 8) * 4, 12 - Math.floor(i / 8) * 3, 2, i % 3 ? a : b); }
  // umbrella
  rect(g, 19, 0, 2, 14, '#5a4a3a');
  for (let x = 0; x < 32; x++) rect(g, 4 + x, 1 + Math.abs(16 - x) / 6, 1, 3, x % 8 < 4 ? '#d8282a' : '#f0ece0');
  return { spr: c, ox: 20, oy: 30 };
}

export function bookStall(seed) {
  const r = artRng(seed);
  const c = makeCanvas(48, 34), g = c.getContext('2d');
  rect(g, 2, 2, 44, 4, '#c8c2b0'); rect(g, 4, 6, 2, 26, '#8a6a4a'); rect(g, 42, 6, 2, 26, '#8a6a4a');
  rect(g, 4, 22, 40, 4, '#8a5a32');
  const BOOK = ['#c2185b', '#8bc34a', '#1e4da1', '#f4c20d', '#f48fb1', '#ffffff', '#d84315', '#00897b'];
  for (let s = 0; s < 6; s++) {
    const sx = 6 + s * 6, n = 3 + Math.floor(r() * 6);
    for (let b = 0; b < n; b++) rect(g, sx, 21 - b * 2, 5, 2, BOOK[Math.floor(r() * BOOK.length)]);
  }
  for (let b = 0; b < 5; b++) rect(g, 8 + b * 7, 7, 5, 7, BOOK[Math.floor(r() * BOOK.length)]); // hanging magazines
  rect(g, 4, 26, 40, 6, '#5a3e2a');
  return { spr: c, ox: 24, oy: 34 };
}

export function flowerStall(seed) {
  const r = artRng(seed);
  const c = makeCanvas(44, 40), g = c.getContext('2d');
  // big umbrella
  rect(g, 21, 4, 2, 34, '#5a4a3a');
  for (let x = 0; x < 42; x++) rect(g, 1 + x, 2 + Math.abs(21 - x) / 5, 1, 4, x % 10 < 5 ? '#f2a900' : '#d8294b');
  // buckets of marigold, roses, tuberose
  for (let i = 0; i < 5; i++) {
    const bx = 3 + i * 8;
    rect(g, bx, 30, 7, 8, ['#2a6ad0', '#d23a2a', '#3a9a4a'][i % 3]);
    const fc = ['#f2a900', '#d8294b', '#f5f5f0', '#ff6a1a', '#d8294b'][i];
    for (let k = 0; k < 6; k++) circle(g, bx + 1 + (k % 3) * 2.5, 26 + Math.floor(k / 3) * 3 - (r() * 2), 1.6, fc);
  }
  // garlands hanging
  for (let i = 0; i < 4; i++) for (let y = 8; y < 22; y += 2) rect(g, 8 + i * 9, y, 2, 2, y % 4 ? '#f2a900' : '#ff6a1a');
  return { spr: c, ox: 22, oy: 40 };
}

export function cottonCandy(seed) {
  const c = makeCanvas(26, 50), g = c.getContext('2d');
  rect(g, 12, 14, 2, 30, '#a88a5a');
  const cols = ['#f2a6c8', '#fff3f6', '#f5e07a', '#f28ab0'];
  for (let i = 0; i < 18; i++) circle(g, 6 + (i % 5) * 4, 4 + Math.floor(i / 5) * 4, 3, cols[i % 4]);
  // vendor
  rect(g, 4, 30, 6, 12, '#2a7ad2'); rect(g, 5, 25, 4, 5, SKIN[1]); rect(g, 5, 24, 4, 2, '#141018');
  rect(g, 4, 42, 2, 6, '#3a3a40'); rect(g, 8, 42, 2, 6, '#3a3a40');
  return { spr: c, ox: 8, oy: 50 };
}

export function umbrellaPerson(seed) {
  const r = artRng(seed);
  const p = personSprite(seed + 3);
  const col = ['#d8282a', '#1a1a1a', '#2a6ad8', '#2a9a4a', '#7a3a9a'][Math.floor(r() * 5)];
  const frames = p.frames.map((f) => {
    const c = makeCanvas(22, 30), g = c.getContext('2d');
    g.drawImage(f, 6, 8);
    rect(g, 11, 2, 1, 12, '#333');
    for (let x = 0; x < 22; x++) rect(g, x, 1 + Math.abs(11 - x) / 4, 1, 3, x % 6 < 3 ? col : shade(col, -0.25));
    return c;
  });
  return { frames, ox: 11, oy: 30, anim: p.anim };
}

export function railGatePost(open = true) {
  const c = makeCanvas(12, 40), g = c.getContext('2d');
  rect(g, 4, 6, 4, 34, '#3a3a40'); rect(g, 4, 6, 1, 34, '#6a6a70');
  rect(g, 1, 4, 10, 6, '#1a1a1a');
  circle(g, 3, 7, 2, '#5a1010'); circle(g, 9, 7, 2, '#5a1010');
  rect(g, 2, 14, 8, 6, '#f2f2f2'); rect(g, 3, 15, 6, 1, '#d8282a'); rect(g, 3, 18, 6, 1, '#d8282a'); // crossbuck sign
  return { spr: c, ox: 6, oy: 40 };
}

export function bushSprite(seed, col = '#3f7a33') {
  const r = artRng(seed);
  const c = makeCanvas(20, 12), g = c.getContext('2d');
  for (let i = 0; i < 6; i++) circle(g, 4 + r() * 12, 6 + r() * 3, 3 + r() * 2, i % 2 ? col : shade(col, 0.15));
  if (r() < 0.5) for (let i = 0; i < 4; i++) rect(g, 3 + r() * 14, 3 + r() * 6, 1, 1, ['#f2a900', '#d8294b', '#ffffff'][i % 3]);
  return { spr: c, ox: 10, oy: 12 };
}

export function railingSprite(w = 64, col = '#c8ccd2') {
  const c = makeCanvas(w, 12), g = c.getContext('2d');
  rect(g, 0, 1, w, 2, col); rect(g, 0, 6, w, 1, shade(col, -0.2));
  for (let x = 0; x < w; x += 4) rect(g, x, 1, 1, 11, shade(col, -0.25));
  return { spr: c, ox: 0, oy: 12 };
}

export function stallTent(seed) {
  const r = artRng(seed);
  const col = ['#2d69c2', '#26a69a', '#e96fa0', '#f2a01f'][Math.floor(r() * 4)];
  const c = makeCanvas(40, 34), g = c.getContext('2d');
  for (let x = 0; x < 40; x++) rect(g, x, 2 + Math.abs(20 - x) / 5, 1, 6, x % 2 ? col : shade(col, 0.15));
  rect(g, 2, 8, 2, 26, '#a88a5a'); rect(g, 36, 8, 2, 26, '#a88a5a');
  rect(g, 4, 22, 32, 10, '#6a4428'); rect(g, 4, 22, 32, 2, '#8a5a32');
  for (let i = 0; i < 10; i++) circle(g, 7 + i * 3, 20, 2, ['#d87c6b', '#c84a3a', '#e8d23a', '#9a6e4a', '#7bb04f'][Math.floor(r() * 5)]);
  return { spr: c, ox: 20, oy: 34 };
}

export function sackPile(seed) {
  const r = artRng(seed);
  const c = makeCanvas(30, 18), g = c.getContext('2d');
  for (let i = 0; i < 5; i++) { const x = 1 + i * 5 + r() * 2, y = 8 - (i % 2) * 4; rect(g, x, y, 9, 9, '#9a6e4a'); rect(g, x, y, 9, 2, '#b88a5e'); rect(g, x + 4, y, 1, 9, '#7a5238'); }
  for (let i = 0; i < 6; i++) circle(g, 6 + i * 3, 14, 2, '#d87c6b');
  return { spr: c, ox: 15, oy: 18 };
}

// Bollard / concrete block
export function bollard() {
  const c = makeCanvas(8, 10), g = c.getContext('2d');
  rect(g, 1, 2, 6, 8, '#c8c2b8'); rect(g, 1, 2, 6, 2, '#e0dad0'); rect(g, 1, 5, 6, 1, '#d8282a');
  return { spr: c, ox: 4, oy: 10 };
}

export function trafficCone() {
  const c = makeCanvas(8, 10), g = c.getContext('2d');
  rect(g, 3, 0, 2, 3, '#f26b1d'); rect(g, 2, 3, 4, 2, '#f0f0f0'); rect(g, 2, 5, 4, 3, '#f26b1d'); rect(g, 0, 8, 8, 2, '#2a2a2a');
  return { spr: c, ox: 4, oy: 10 };
}
