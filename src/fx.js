// Visual effects: particles, floating numbers, screen shake, hit flash,
// weather (rain / fog / haze) and lighting (night darkness + light glows).
// Uses Math.random (cosmetic only, never affects gameplay).

import { W, H } from './config.js';
import { makeCanvas, rgba } from './gfx.js';

export function createFx() {
  return {
    particles: [],
    texts: [],
    shake: 0, shakeX: 0, shakeY: 0,
    flash: 0, flashColor: '#ffffff',
    rain: [], splashes: [],
    fog: [],
    lightning: 0,
  };
}

const rnd = (a, b) => a + Math.random() * (b - a);

// ---- emitters ------------------------------------------------------------------

export function burst(fx, x, y, n, opts = {}) {
  const { colors = ['#ffffff'], speed = 60, life = 0.6, size = 2, gravity = 120, up = 0, kind = 'square' } = opts;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rnd(speed * 0.3, speed);
    fx.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, g: gravity,
      life: rnd(life * 0.6, life), t: 0, size: Math.max(1, Math.round(rnd(size * 0.6, size))),
      color: colors[Math.floor(Math.random() * colors.length)], kind,
    });
  }
}

export function puff(fx, x, y, color = 'rgba(120,120,130,0.5)', size = 3) {
  fx.particles.push({ x, y, vx: rnd(-8, 8), vy: rnd(-14, -6), g: -4, life: rnd(0.5, 1.0), t: 0, size, color, kind: 'puff' });
}

export function floatText(fx, text, x, y, color = '#ffffff', size = 8, life = 1.1) {
  fx.texts.push({ text, x, y, t: 0, life, color, size });
}

export function addShake(fx, amt) { fx.shake = Math.min(10, fx.shake + amt); }
export function hitFlash(fx, color = '#ffffff', amt = 0.5) { fx.flash = amt; fx.flashColor = color; }

// ---- update ------------------------------------------------------------------------

export function updateFx(fx, dt, weather, cam) {
  for (const p of fx.particles) {
    p.t += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'puff') { p.size += dt * 4; p.vx *= 0.97; }
  }
  fx.particles = fx.particles.filter((p) => p.t < p.life);
  if (fx.particles.length > 500) fx.particles.splice(0, fx.particles.length - 500);
  for (const t of fx.texts) { t.t += dt; t.y -= dt * 22; }
  fx.texts = fx.texts.filter((t) => t.t < t.life);

  fx.shake = Math.max(0, fx.shake - dt * 18);
  fx.shakeX = (Math.random() * 2 - 1) * fx.shake;
  fx.shakeY = (Math.random() * 2 - 1) * fx.shake;
  fx.flash = Math.max(0, fx.flash - dt * 2.5);

  if (weather === 'rain') {
    // screen-space streaks
    while (fx.rain.length < 170) fx.rain.push({ x: rnd(-40, W + 40), y: rnd(-H, 0), v: rnd(380, 520), l: rnd(6, 12) });
    for (const d of fx.rain) {
      d.y += d.v * dt; d.x -= d.v * 0.18 * dt;
      if (d.y > H) {
        // world-space splash where the drop lands
        if (Math.random() < 0.5) fx.splashes.push({ x: d.x, y: d.y + cam, t: 0 });
        d.y = rnd(-40, 0); d.x = rnd(-40, W + 60);
      }
    }
    for (const s of fx.splashes) s.t += dt;
    fx.splashes = fx.splashes.filter((s) => s.t < 0.28);
    fx.lightning = Math.max(0, fx.lightning - dt * 2);
  }
  if (weather === 'fog') {
    while (fx.fog.length < 9) fx.fog.push({ x: rnd(-200, W), y: rnd(0, H), r: rnd(90, 170), v: rnd(6, 16), a: rnd(0.12, 0.24) });
    for (const f of fx.fog) { f.x += f.v * dt; if (f.x - f.r > W) { f.x = -f.r; f.y = rnd(0, H); } }
  }
}

// ---- draw (world-space; caller has translated by -camera) --------------------------

export function drawParticles(g, fx) {
  for (const p of fx.particles) {
    const a = 1 - p.t / p.life;
    if (p.kind === 'puff') {
      g.globalAlpha = a * 0.7;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.round(p.size), Math.round(p.size));
    } else if (p.kind === 'star') {
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
      g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
    } else {
      g.globalAlpha = Math.min(1, a * 1.5);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
  g.globalAlpha = 1;
}

export function drawSplashes(g, fx) {
  g.strokeStyle = 'rgba(200,220,255,0.7)';
  g.fillStyle = 'rgba(210,230,255,0.75)';
  for (const s of fx.splashes) {
    const r = 1 + s.t * 14;
    g.globalAlpha = 1 - s.t / 0.28;
    g.fillRect(Math.round(s.x - r), Math.round(s.y), Math.round(r * 2), 1);
    g.fillRect(Math.round(s.x) - 1, Math.round(s.y - 2 - s.t * 10), 1, 2);
    g.fillRect(Math.round(s.x) + 2, Math.round(s.y - 1 - s.t * 8), 1, 1);
  }
  g.globalAlpha = 1;
}

// ---- screen-space overlays --------------------------------------------------------

export function drawRain(g, fx) {
  g.strokeStyle = 'rgba(190,210,240,0.55)';
  g.lineWidth = 1;
  g.beginPath();
  for (const d of fx.rain) {
    g.moveTo(d.x, d.y);
    g.lineTo(d.x + d.l * 0.18, d.y - d.l);
  }
  g.stroke();
  if (fx.lightning > 0) {
    g.fillStyle = `rgba(230,240,255,${fx.lightning * 0.35})`;
    g.fillRect(0, 0, W, H);
  }
}

let fogBlob = null, fogWash = null, fogWashD = -1;
export function drawFog(g, fx, density = 0.3) {
  if (!fogBlob) {
    fogBlob = makeCanvas(128, 128);
    const bg = fogBlob.getContext('2d');
    const grd = bg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(235,238,242,1)');
    grd.addColorStop(1, 'rgba(235,238,242,0)');
    bg.fillStyle = grd;
    bg.fillRect(0, 0, 128, 128);
  }
  if (fogWashD !== density) {
    // denser at the top (distance fog), pre-rendered once
    fogWash = makeCanvas(32, H);
    const wg = fogWash.getContext('2d');
    const lg = wg.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, `rgba(228,232,236,${density * 1.4})`);
    lg.addColorStop(0.6, `rgba(228,232,236,${density * 0.45})`);
    lg.addColorStop(1, `rgba(228,232,236,${density * 0.2})`);
    wg.fillStyle = lg;
    wg.fillRect(0, 0, 32, H);
    fogWashD = density;
  }
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true;
  for (const f of fx.fog) {
    g.globalAlpha = f.a;
    g.drawImage(fogBlob, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  }
  g.globalAlpha = 1;
  g.drawImage(fogWash, 0, 0, W, H);
  g.imageSmoothingEnabled = prev;
}

// Night / dusk lighting: darkness with holes punched out for lights, then
// coloured additive glows. All gradients are pre-rendered sprites (cheap to blit).
let lightCanvas = null;
const glowCache = new Map();
let holeSpr = null, coneR = null, coneL = null;

function radialSprite(color) {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.35, rgba(color, 0.45));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}
function glowSprite(color) {
  if (!glowCache.has(color)) glowCache.set(color, radialSprite(color));
  return glowCache.get(color);
}
function coneSprite(dir) {
  const c = makeCanvas(96, 64), g = c.getContext('2d');
  const ax = dir > 0 ? 0 : 96;
  const grd = g.createRadialGradient(ax, 32, 0, ax, 32, 96);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(ax, 32); g.lineTo(96 - ax, 6); g.lineTo(96 - ax, 58); g.closePath();
  g.fill();
  return c;
}

export function drawLighting(g, tod, lights, glows) {
  if (tod.dark > 0) {
    if (!lightCanvas) { lightCanvas = makeCanvas(W / 2, H / 2); holeSpr = radialSprite('#000000'); coneR = coneSprite(1); coneL = coneSprite(-1); }
    const lc = lightCanvas.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.clearRect(0, 0, W / 2, H / 2);
    lc.fillStyle = rgba('#05040f', tod.dark);
    lc.fillRect(0, 0, W / 2, H / 2);
    lc.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      if (L.y < -L.r || L.y > H + L.r) continue;
      lc.globalAlpha = Math.min(1, L.a);
      if (L.cone) {
        const w = L.r / 2, h = (L.r * 0.6) / 2;
        const x = L.dir > 0 ? L.x / 2 : L.x / 2 - w;
        lc.drawImage(L.dir > 0 ? coneR : coneL, x, L.y / 2 - h / 2, w, h);
      } else {
        lc.drawImage(holeSpr, (L.x - L.r) / 2, (L.y - L.r) / 2, L.r, L.r);
      }
    }
    lc.globalAlpha = 1;
    const prev = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    g.drawImage(lightCanvas, 0, 0, W, H);
    g.imageSmoothingEnabled = prev;
  }
  if (glows.length) {
    const prev = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'lighter';
    for (const L of glows) {
      if (L.y < -L.r || L.y > H + L.r) continue;
      g.globalAlpha = Math.min(1, L.a);
      g.drawImage(glowSprite(L.color), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = prev;
  }
}

// Colour grade for time of day
export function drawTint(g, tod) {
  if (tod.tintA > 0) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = rgba(tod.tint, Math.min(1, tod.tintA * 2.2));
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  if (tod.haze > 0) {
    g.fillStyle = rgba(tod.sky[1], tod.haze);
    g.fillRect(0, 0, W, H);
  }
}

let vignette = null, scan = null;
export function drawVignette(g, scanlines) {
  if (!vignette) {
    vignette = makeCanvas(W, H);
    const v = vignette.getContext('2d');
    const grd = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(10,0,20,0.42)');
    v.fillStyle = grd;
    v.fillRect(0, 0, W, H);
  }
  g.drawImage(vignette, 0, 0);
  if (scanlines) {
    if (!scan) {
      scan = makeCanvas(W, H);
      const s = scan.getContext('2d');
      s.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < H; y += 2) s.fillRect(0, y, W, 1);
    }
    g.drawImage(scan, 0, 0);
  }
}

export function drawFlash(g, fx) {
  if (fx.flash > 0) {
    g.fillStyle = rgba(fx.flashColor, fx.flash * 0.45);
    g.fillRect(0, 0, W, H);
  }
}
