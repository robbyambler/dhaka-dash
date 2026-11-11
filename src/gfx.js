// Low-level drawing helpers shared by all the art code.
// Pixel art is painted once into small offscreen canvases ("sprites") and then
// blitted every frame — we never redraw vector shapes per frame.

import { FONTS } from './i18n.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

// Paint into a new canvas with a painter function: sprite(w, h, (g) => {...})
export function sprite(w, h, paint) {
  const c = makeCanvas(w, h);
  paint(c.getContext('2d'), w, h);
  return c;
}

// Horizontally mirrored copy of a sprite (for left-facing vehicles)
export function mirror(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// ---- colour maths ----------------------------------------------------------

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
// amt > 0 lightens towards white, < 0 darkens towards black
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---- primitive painters ----------------------------------------------------

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// A box seen from the ¾ view: a top face and a front (south) face.
export function box(g, x, y, w, topH, frontH, color, opts = {}) {
  const top = opts.top || shade(color, 0.22);
  const front = opts.front || color;
  rect(g, x, y, w, topH, top);
  rect(g, x, y + topH, w, frontH, front);
  if (opts.edge !== false) {
    rect(g, x, y + topH, w, 1, shade(color, 0.4)); // highlight on the edge
    rect(g, x, y + topH + frontH - 1, w, 1, shade(color, -0.35));
  }
}

// Soft elliptical drop shadow (pixel-stepped)
export function shadow(g, cx, cy, rx, ry, alpha = 0.35) {
  g.fillStyle = `rgba(10,8,20,${alpha})`;
  for (let yy = -ry; yy <= ry; yy++) {
    const w = Math.round(rx * Math.sqrt(1 - (yy * yy) / (ry * ry + 0.01)));
    g.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2, 1);
  }
}

export function circle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let yy = -r; yy <= r; yy++) {
    const w = Math.round(Math.sqrt(r * r - yy * yy));
    g.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2 + 1, 1);
  }
}

// Wheel with a hub highlight
export function wheel(g, cx, cy, r, tyre = '#1b1b22', hub = '#9aa0ad') {
  circle(g, cx, cy, r, tyre);
  if (r >= 2) rect(g, cx - 1, cy - 1, 2, 2, hub);
}

// Dithered vertical gradient band (gives that 16-bit sky look)
export function ditherGradient(g, x, y, w, h, c1, c2, steps = 8) {
  for (let i = 0; i < steps; i++) {
    const y0 = y + Math.floor((h * i) / steps);
    const y1 = y + Math.floor((h * (i + 1)) / steps);
    rect(g, x, y0, w, y1 - y0, mix(c1, c2, i / (steps - 1)));
    if (i < steps - 1) {
      // checker dither on the boundary row
      g.fillStyle = mix(c1, c2, (i + 1) / (steps - 1));
      for (let xx = x + (i % 2); xx < x + w; xx += 2) g.fillRect(xx, y1 - 1, 1, 1);
    }
  }
}

// ---- Bengali signboards ---------------------------------------------------
// Signs carry real text, so they are rendered at a higher resolution
// (SIGN_RES × logical) and drawn with smoothing so the conjuncts stay crisp.

export const SIGN_RES = 4;

export function signboard(text, opts = {}) {
  const {
    bg = '#c62828', fg = '#fff7d6', border = null, size = 11, font = FONTS.bnDisplay,
    weight = 800, padX = 4, padY = 1, minW = 0, sub = null, subSize = 6, stripe = null,
  } = opts;
  const meas = makeCanvas(4, 4).getContext('2d');
  meas.font = `${weight} ${size * SIGN_RES}px ${font}`;
  const tw = meas.measureText(text).width / SIGN_RES;
  let sw = 0;
  if (sub) { meas.font = `700 ${subSize * SIGN_RES}px ${FONTS.bnBody}`; sw = meas.measureText(sub).width / SIGN_RES; }
  const w = Math.ceil(Math.max(minW, tw + padX * 2, sw + padX * 2));
  const h = Math.ceil(size * 1.25 + padY * 2 + (sub ? subSize * 1.1 : 0));
  const c = makeCanvas(w * SIGN_RES, h * SIGN_RES);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.scale(SIGN_RES, SIGN_RES);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (stripe) { g.fillStyle = stripe; g.fillRect(0, h - 2, w, 2); g.fillRect(0, 0, w, 1); }
  // light grime at the bottom edge
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 1, w, 1);
  if (border) { g.strokeStyle = border; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1); }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${weight} ${size}px ${font}`;
  const ty = padY + size * 0.68;
  // drop shadow for punch
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText(text, w / 2 + 0.5, ty + 0.6);
  g.fillStyle = fg;
  g.fillText(text, w / 2, ty);
  if (sub) {
    g.font = `700 ${subSize}px ${FONTS.bnBody}`;
    g.fillText(sub, w / 2, padY + size * 1.25 + subSize * 0.5);
  }
  c.logicalW = w;
  c.logicalH = h;
  return c;
}

// Draw a high-res sign canvas at logical coordinates
export function drawSign(g, sign, x, y) {
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true;
  g.drawImage(sign, Math.round(x), Math.round(y), sign.logicalW, sign.logicalH);
  g.imageSmoothingEnabled = prev;
}
