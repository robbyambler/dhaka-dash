// Boot: load fonts, size the canvas, run the fixed-timestep loop, expose test hooks.

import '@fontsource/press-start-2p/400.css';
import '@fontsource/baloo-da-2/800.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';

import { W, H, STEP } from './config.js';
import { G, update, loadSave, goTitle, enterLevel, params, addScore, upgradeCap, playerWorldY, doAction, honk } from './game.js';
import { render } from './render.js';
import { initInput } from './input.js';
import { unlockAudio } from './audio.js';
import { setLang, t } from './i18n.js';
import { makeRng } from './rng.js';
import { buildVehicleSprites, VEHICLES } from './vehicles.js';
import { rupaSprites } from './player.js';
import { spawnPickup } from './pickups.js';
import { rowTop } from './scenery/index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let k = 1;             // backing-store pixels per logical pixel
let cssScale = 1;

// ---- responsive, DPR-aware scaling ------------------------------------------------------
// Integer CSS scaling when the window is big enough (crisp pixels), fractional
// on small phone screens. The backing store is rendered at k× so text and
// Bengali signboards stay sharp.
function resize() {
  const touch = document.documentElement.classList.contains('touch-device');
  const pad = document.getElementById('touch');
  const landscapePhone = window.innerHeight < 500 && window.innerWidth > window.innerHeight;
  const portrait = window.innerHeight > window.innerWidth;
  // touch layouts reserve room for the on-screen pads so they never cover the road
  const reservedH = touch && portrait ? pad.offsetHeight + 60 : 0;
  const reservedW = touch && landscapePhone ? 2 * 158 : 0;
  const availW = window.innerWidth - reservedW;
  const availH = window.innerHeight - reservedH;
  let s = Math.min(availW / W, availH / H);
  if (s >= 1) s = Math.floor(s); // integer scaling when possible
  cssScale = s;
  const dpr = window.devicePixelRatio || 1;
  k = Math.max(1, Math.min(3, Math.ceil(s * dpr - 0.01))); // capped: beyond 3× the browser upscales crisply anyway
  canvas.width = W * k;
  canvas.height = H * k;
  canvas.style.width = `${Math.round(W * s)}px`;
  canvas.style.height = `${Math.round(H * s)}px`;
  canvas.classList.toggle('smooth', Math.abs(s * dpr - k) > 0.01);
}

function mapToLogical(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
}

// ---- main loop: fixed 60 Hz simulation, render with interpolation -----------------------
let acc = 0;
let last = performance.now();
let frozen = false; // tests can freeze real-time simulation and step manually

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!frozen) {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  }
  render(ctx, k, frozen ? 1 : acc / STEP);
  requestAnimationFrame(frame);
}

// ---- test hooks (§11) -------------------------------------------------------------------

function vehicleList() {
  const out = [];
  for (const lane of G.lanes) {
    if (!lane) continue;
    for (const v of lane.vehicles) {
      out.push({ type: v.type, row: v.row, x: Math.round(v.x * 10) / 10, w: v.w, dir: v.dir, wrongWay: v.wrongWay, speed: Math.round(v.speed * 100) / 100, base: Math.round(v.base * 100) / 100, warn: v.warnT > 0 });
    }
  }
  return out;
}

window.__dhaka = {
  state() {
    const p = G.player;
    const rail = G.lanes.filter((l) => l && l.kind === 'rail').map((l) => ({ row: l.row, state: l.rail.state, gate: l.rail.gate }));
    return {
      phase: G.phase, paused: G.paused, level: G.levelIndex + 1, levelId: G.level?.id, ngPlus: G.ngPlus,
      hp: p ? p.hp : 0, lives: G.lives, score: G.score, highScore: G.highScore, nextLifeAt: G.nextLifeAt,
      upgrades: JSON.parse(JSON.stringify(G.upgrades)), upgradeCap: upgradeCap(),
      player: p ? { row: p.row, col: Math.floor(p.x / 32), x: p.x, hopping: p.hopping, hopDur: p.hopDur, dead: !!p.dead, iframes: p.iframes, facing: p.facing } : null,
      rows: G.level ? G.level.rows.map((r) => r.type) : [],
      vehicles: G.level ? vehicleList() : [],
      rail, pickups: G.pickups.map((pk) => ({ type: pk.type, row: pk.row, col: pk.col })),
      params: G.level ? params() : null,
      timeLeft: G.timeLeft, lang: G.lang, muted: G.muted, autoplay: G.autoplay,
      stats: { ...G.stats }, levelT: G.levelT, cam: G.cam, k,
    };
  },
  // n is 1-based. opts: { seed, ngPlus, intro, keep }
  startLevel(n, opts = {}) {
    G.demo = false;
    G.paused = false;
    if (opts.ngPlus !== undefined) G.ngPlus = opts.ngPlus;
    if (!opts.keep) {
      G.score = opts.score ?? 0;
      G.lives = opts.lives ?? 3;
      G.nextLifeAt = 5000 * (Math.floor(G.score / 5000) + 1);
      if (!opts.keepUpgrades) G.upgrades = { perception: { lvl: 0, xp: 0 }, speed: { lvl: 0, xp: 0 } };
    }
    G.autoplay = !!opts.autoplay;
    enterLevel(n - 1, { intro: !!opts.intro, seed: opts.seed ?? 1234 });
    return this.state();
  },
  setNgPlus(n) { G.ngPlus = n; return this.state(); },
  grant({ speed = 0, perception = 0, lives = null, hp = null, score = 0 } = {}) {
    G.upgrades.speed.lvl = Math.min(upgradeCap(), G.upgrades.speed.lvl + speed);
    G.upgrades.perception.lvl = Math.min(upgradeCap(), G.upgrades.perception.lvl + perception);
    if (lives !== null) G.lives = lives;
    if (hp !== null) G.player.hp = hp;
    if (score) addScore(score, { mult: false });
    return this.state();
  },
  setLang(l) { G.lang = l === 'bn' ? 'bn' : 'en'; setLang(G.lang); try { const s = JSON.parse(localStorage.getItem('dhakaDash.v1') || '{}'); s.lang = G.lang; localStorage.setItem('dhakaDash.v1', JSON.stringify(s)); } catch { /* ignore */ } return G.lang; },
  autoplay(on) { G.autoplay = !!on; return G.autoplay; },
  freeze(on) { frozen = !!on; acc = 0; return frozen; },
  stepFrames(n) {
    for (let i = 0; i < n; i++) update(STEP);
    return this.state();
  },
  // Run until a phase is reached (or a frame budget runs out) — fast, synchronous
  runUntil(phases, maxFrames = 60 * 300) {
    const want = Array.isArray(phases) ? phases : [phases];
    let f = 0;
    for (; f < maxFrames; f++) {
      update(STEP);
      if (want.includes(G.phase)) break;
    }
    return { frames: f, ...this.state() };
  },
  seed(n) { G.seed = n; G.rng = makeRng(n); return n; },
  // extra helpers for tests
  spawnPickup(type, row, col) { return spawnPickup(G, G.rng, { type, row, col, life: 30 }); },
  placePlayer(row, col) {
    const p = G.player;
    p.row = p.toRow = p.fromRow = row;
    p.x = p.fromX = p.toX = p.pvx = col * 32 + 16;
    p.vRowF = p.pRowF = row; p.hopping = false; p.cooldown = 0;
    if (G.level.rows[row].type !== 'water') { p.lastSafeRow = row; p.lastSafeX = p.x; }
    return this.state();
  },
  setPlayerX(x) { const p = G.player; p.x = p.fromX = p.toX = p.pvx = x; return this.state(); },
  hop(dir) { window.dispatchEvent(new KeyboardEvent('keydown', { code: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir] })); },
  hitPlayerWith(type) {
    // put a vehicle of `type` right on top of Rupa (for damage tests)
    const p = G.player;
    const lane = G.lanes.find((l) => l && l.kind === 'road');
    if (!lane) return null;
    this.placePlayer(lane.row, 10);
    lane.vehicles.length = 0;
    const info = { bicycle: 1, rickshaw: 1.5, van: 1.5, moto: 1, cng: 1.5, car: 2, leguna: 2, pickup: 2, microbus: 2.5, bus: 3.5, truck: 4 }[type];
    const w = Math.round(info * 32);
    lane.vehicles.push({ id: -1, type, info: window.__dhakaVehicles[type], w, dir: 1, wrongWay: false, row: lane.row, variant: 0, x: p.x - w / 2, prevX: p.x - w / 2, base: 0.001, speed: 0.001, swerve: 0, swerveTarget: 0, prevSwerve: 0, warnT: 0, honkT: 99, hornCd: 99, honkFlash: 0, bob: 0 });
    p.iframes = 0;
    const before = p.hp;
    update(STEP);
    return { before, after: G.player.hp, lives: G.lives, dead: !!G.player.dead };
  },
  // average milliseconds to render one frame (perf sanity check)
  benchRender(n = 60) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { update(STEP); render(ctx, k, 1); }
    return (performance.now() - t0) / n;
  },
  action(name) { doAction(name); return this.state(); },
  // horn counters since the level started: events (honks shown), played (sent to
  // the synth — 0 when muted), dropped (voice cap), maxVoices, byClass, byReason
  hornStats() { return JSON.parse(JSON.stringify(G.horn.stats)); },
  // stress test: every on-screen vehicle tries to honk at once → returns how many got a voice
  honkAll(reason = 'warn') { return G.lanes.flatMap((l) => (l ? l.vehicles : [])).filter((v) => { v.hornCd = 0; return honk(v, reason); }).length; },
  t(key) { return t(key); },
  fontsOk() {
    return document.fonts.check('700 12px "Hind Siliguri"', 'স্কোর ক্ষ') && document.fonts.check('800 20px "Baloo Da 2"', 'ঢাকা দৌড়') && document.fonts.check('8px "Press Start 2P"', 'SCORE');
  },
  playerScreenY() { return playerWorldY() - G.cam; },
  rowScreenY(r) { return rowTop(G.level, r) - G.cam; },
};

// ---- boot -----------------------------------------------------------------------------------

async function boot() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.documentElement.classList.add('touch-device');
  loadSave();
  // Wait for the fonts (including the Bengali subsets) before the first paint — no tofu.
  try {
    await Promise.all([
      document.fonts.load('8px "Press Start 2P"', 'DHAKA 0123'),
      document.fonts.load('800 20px "Baloo Da 2"', 'ঢাকা দৌড় ক্ষ ন্ত্র'),
      document.fonts.load('800 20px "Baloo Da 2"', 'ABC'),
      document.fonts.load('700 12px "Hind Siliguri"', 'স্কোর সময় শক্তি ০১২৩'),
      document.fonts.load('600 12px "Hind Siliguri"', 'স্কোর'),
    ]);
    await document.fonts.ready;
  } catch { /* fall back to whatever is available */ }

  window.__dhakaVehicles = VEHICLES;
  buildVehicleSprites();
  rupaSprites();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  initInput({ canvas, mapToLogical, firstGesture: unlockAudio });
  goTitle();
  document.getElementById('loading').remove();
  window.__dhakaReady = true;
  requestAnimationFrame((t) => { last = t; frame(t); });
}

boot();
