// Game state machine and rules.
// Phases: title → levelIntro → playing → levelClear → (next level | victory) ; gameOver.
// All gameplay randomness comes from G.rng (seedable) so runs are reproducible.

import {
  TILE, COLS, MAX_LIVES, START_LIVES, MAX_HP, LIFE_EVERY, IFRAMES, WATER_FALL_DMG,
  XP_STEPS, BASE_UPGRADE_CAP, SAVE_KEY,
} from './config.js';
import { makeRng } from './rng.js';
import { LEVELS, TOD } from './levels.js';
import { createLane, updateLane, vehicleAt, boatAt } from './traffic.js';
import { createPlayer, requestHop, startHop, updatePlayer, colX, xToCol } from './player.js';
import { spawnPickup, updatePickups } from './pickups.js';
import { createFx, updateFx, burst, floatText, addShake, hitFlash, puff } from './fx.js';
import { sfx, setMuted, setMusic } from './audio.js';
import { setLang, t, getLang } from './i18n.js';
import { worldHeight, rowTop } from './scenery/index.js';
import { botDecide } from './bot.js';
import { drainEvents } from './input.js';
import { H, W } from './config.js';

export const G = {
  phase: 'title', phaseT: 0,
  lang: 'en', muted: false, scanlines: false,
  highScore: 0, bestNg: 0,
  levelIndex: 0, ngPlus: 0, score: 0, lives: START_LIVES, nextLifeAt: LIFE_EVERY,
  upgrades: { perception: { lvl: 0, xp: 0 }, speed: { lvl: 0, xp: 0 } },
  level: null, lanes: [], player: null, pickups: [], fx: createFx(), tod: TOD.morning,
  timeLeft: 0, noDamage: true, furthest: 0, pickupT: 0,
  cam: 0, prevCam: 0, camTarget: 0,
  rng: makeRng(1), seed: 1,
  paused: false, autoplay: false, demo: false, attractT: 0,
  toasts: [], tally: null, frame: 0, levelT: 0,
  boatUnder: null, snapshot: null,
  stats: { hits: 0, damage: 0, falls: 0, livesLost: 0, time: 0 },
  sceneVersion: 0, menuIndex: 0, newHigh: false, horn: null,
};

// ---- persistence ---------------------------------------------------------------------

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    G.lang = s.lang === 'bn' ? 'bn' : 'en';
    G.muted = !!s.muted;
    G.scanlines = !!s.scanlines;
    G.highScore = s.highScore | 0;
    G.bestNg = s.bestNg | 0;
  } catch { /* storage unavailable — defaults are fine */ }
  setLang(G.lang);
  setMuted(G.muted);
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      lang: G.lang, muted: G.muted, scanlines: G.scanlines, highScore: G.highScore, bestNg: G.bestNg,
    }));
  } catch { /* ignore */ }
}

// ---- difficulty ----------------------------------------------------------------------------

export function upgradeCap() { return BASE_UPGRADE_CAP + G.ngPlus; }

export function params() {
  const lv = G.level;
  const N = G.ngPlus;
  return {
    speedMul: lv.speedMul * (1 + 0.12 * N),
    gapMul: 1 / (1 + 0.1 * N),
    wrongChance: Math.min(0.45, lv.wrongWay + 0.03 * N),
    dmgMul: 1 + 0.1 * N,
    scoreMul: 1 + 0.5 * N,
    perception: G.upgrades.perception.lvl,
  };
}

// ---- level setup --------------------------------------------------------------------------

export function enterLevel(index, { intro = true, seed = null } = {}) {
  G.levelIndex = index;
  G.level = LEVELS[index];
  G.tod = TOD[G.level.tod];
  if (seed !== null) { G.seed = seed; G.rng = makeRng(seed); }
  const P = params();
  G.lanes = G.level.rows.map((row, i) => (row.type === 'road' || row.type === 'water' || row.type === 'rail')
    ? createLane(i, row, G.level, P, G.rng) : null);
  G.player = createPlayer(10);
  G.player.iframes = 0.6;
  G.pickups = [];
  G.fx = createFx();
  G.timeLeft = G.level.time;
  G.noDamage = true;
  G.furthest = 0;
  G.pickupT = 2.5;
  G.levelT = 0;
  G.toasts = [];
  G.boatUnder = null;
  G.metroT = 3; G.metroX = null;
  resetHorns();
  G.stats = { hits: 0, damage: 0, falls: 0, livesLost: 0, time: 0 };
  G.snapshot = { score: G.score, upgrades: JSON.parse(JSON.stringify(G.upgrades)) };
  G.sceneVersion++;
  G.wipe = 1; // stripe-wipe transition into the new scene
  const wy = playerWorldY();
  G.cam = G.prevCam = G.camTarget = clampCam(wy - 252);
  setPhase(intro ? 'levelIntro' : 'playing');
}

function setPhase(p) { G.phase = p; G.phaseT = 0; G.menuIndex = 0; }

export function startRun() {
  G.demo = false;
  G.autoplay = false;
  G.ngPlus = 0;
  G.score = 0;
  G.lives = START_LIVES;
  G.nextLifeAt = LIFE_EVERY;
  G.upgrades = { perception: { lvl: 0, xp: 0 }, speed: { lvl: 0, xp: 0 } };
  G.newHigh = false;
  enterLevel(0, { seed: (Date.now() % 100000) + 1 });
  setMusic(true);
}

export function startNewGamePlus() {
  G.ngPlus += 1;
  if (G.ngPlus > G.bestNg) { G.bestNg = G.ngPlus; save(); }
  enterLevel(0);
}

export function goTitle() {
  G.paused = false;
  G.demo = true;
  G.autoplay = true;
  G.attractT = 0;
  G.ngPlus = 0;
  G.score = 0;
  G.lives = START_LIVES;
  G.upgrades = { perception: { lvl: 0, xp: 0 }, speed: { lvl: 0, xp: 0 } };
  enterLevel(G.attractLevel ?? 0, { intro: false, seed: 7 });
  setPhase('title');
}

function retryLevel() {
  G.score = 0;
  G.lives = START_LIVES;
  G.nextLifeAt = LIFE_EVERY;
  G.upgrades = JSON.parse(JSON.stringify(G.snapshot.upgrades));
  G.newHigh = false;
  enterLevel(G.levelIndex);
}

// ---- geometry helpers ---------------------------------------------------------------------

// Rupa's feet in world y. With `alpha`, interpolates between the last two steps.
export function playerWorldY(alpha = 1) {
  const p = G.player;
  const rf = p.vRowF ?? p.row;
  const prf = p.pRowF ?? rf;
  return rowTop(G.level, 0) - (prf + (rf - prf) * alpha) * TILE + 27;
}

function clampCam(y) {
  const max = worldHeight(G.level) - H;
  return Math.max(0, Math.min(max, y));
}

// ---- scoring --------------------------------------------------------------------------------

export function addScore(raw, { mult = true } = {}) {
  const pts = Math.round(raw * (mult ? params().scoreMul : 1));
  G.score += pts;
  while (G.score >= G.nextLifeAt) {
    G.nextLifeAt += LIFE_EVERY;
    if (G.lives < MAX_LIVES) {
      G.lives += 1;
      toast(t('extraLife'), '#7aff9a');
      sfx.extraLife();
    } else {
      G.player.hp = MAX_HP;
      G.score += 250;
      toast(t('fullHeal'), '#9af0ff');
      sfx.heal();
    }
  }
  if (!G.demo && G.score > G.highScore) { G.highScore = G.score; G.newHigh = true; }
  return pts;
}

export function toast(text, color = '#ffffff') {
  G.toasts.push({ text, color, t: 0, life: 2.2 });
  if (G.toasts.length > 4) G.toasts.shift();
}

// ---- upgrades ------------------------------------------------------------------------------

export function gainXp(stat) {
  const u = G.upgrades[stat];
  const cap = upgradeCap();
  if (u.lvl >= cap) { toast(`${stat === 'perception' ? t('perception') : t('speed')} ${t('maxed')}`, '#ffd27a'); return false; }
  u.xp += 1;
  const need = XP_STEPS[Math.min(u.lvl, XP_STEPS.length - 1)];
  if (u.xp >= need) {
    u.lvl += 1;
    u.xp = 0;
    toast(stat === 'perception' ? t('percUp') : t('speedUp'), '#ffe14a');
    sfx.levelUp();
    const p = G.player;
    burst(G.fx, p.x, playerWorldY() - 12, 40, { colors: ['#ffe14a', '#ff8a1e', '#ffffff', '#11a39a'], speed: 140, life: 1, up: 60, kind: 'star' });
    G.levelUpFlash = 1;
    return true;
  }
  return false;
}

// ---- damage, lives ----------------------------------------------------------------------

function hurt(amount, cause) {
  const p = G.player;
  const dmg = Math.round(amount * params().dmgMul);
  p.hp -= dmg;
  G.noDamage = false;
  G.stats.hits++;
  G.stats.damage += dmg;
  floatText(G.fx, `-${dmg}`, p.x, playerWorldY() - 30, '#ff5a4a', 10);
  return dmg;
}

function hitByVehicle(v) {
  const p = G.player;
  const weight = v.info.hitW ?? 0.5;
  hurt(v.info.dmg, v.type);
  (G.stats.hitLog ||= []).push(`${v.type}${v.wrongWay ? '(wrong-way)' : ''}${p.hopping ? '/hopping' : '/standing'}`);
  p.iframes = IFRAMES;
  sfx.hit(weight);
  addShake(G.fx, 2 + weight * 6);
  hitFlash(G.fx, '#ff3a2a', 0.25 + weight * 0.35);
  burst(G.fx, p.x, playerWorldY() - 10, 10 + Math.round(weight * 16), { colors: ['#ffffff', '#ffe14a', '#ff8a1e'], speed: 110, life: 0.5, kind: 'star' });
  if (p.hp <= 0) { loseLife(); return; }
  // Knockback: back toward the start if that row is solid ground, else shoved along with traffic
  p.hopping = false;
  p.toRow = p.row;
  const below = p.row - 1;
  const belowType = below >= 0 ? G.level.rows[below].type : null;
  if (belowType && belowType !== 'water') {
    startHop(p, 'down', G, { knock: true, dur: 0.16, keepFacing: true });
  } else {
    const dir = v.dir > 0 ? 'right' : 'left';
    if (!startHop(p, dir, G, { knock: true, dur: 0.16, keepFacing: true })) startHop(p, dir === 'right' ? 'left' : 'right', G, { knock: true, dur: 0.16, keepFacing: true });
  }
}

function fallInWater() {
  const p = G.player;
  sfx.splash();
  G.stats.falls++;
  burst(G.fx, p.x, playerWorldY() - 4, 26, { colors: ['#cfe8ff', '#8ac8f0', '#ffffff'], speed: 90, life: 0.7, up: 70, gravity: 220 });
  toast(t('splash'), '#9ad8ff');
  hurt(WATER_FALL_DMG, 'water');
  addShake(G.fx, 3);
  if (p.hp <= 0) { loseLife(); return; }
  // back to the last safe row
  p.hopping = false;
  p.row = p.fromRow = p.toRow = p.lastSafeRow;
  p.x = p.fromX = p.toX = colX(xToCol(p.lastSafeX));
  p.vRowF = p.row;
  p.pvx = p.x; p.pRowF = p.row;
  p.iframes = 1.0;
}

function loseLife() {
  const p = G.player;
  G.lives -= 1;
  G.stats.livesLost++;
  p.dead = true;
  p.deadT = 1.4;
  p.hp = 0;
  p.hopping = false;
  sfx.lifeLost();
  addShake(G.fx, 8);
  hitFlash(G.fx, '#ff2a2a', 0.7);
  toast(t('lifeLost'), '#ff7a6a');
}

function respawn() {
  const iframes = 1.6;
  G.player = createPlayer(10);
  G.player.iframes = iframes;
  G.furthestRespawn = true;
}

// ---- level clear ----------------------------------------------------------------------------

function levelCleared() {
  const P = params();
  const clear = 500, time = Math.floor(G.timeLeft) * 10, nodmg = G.noDamage ? 300 : 0;
  const before = G.score;
  addScore(clear + time + nodmg);
  G.tally = { clear: Math.round(clear * P.scoreMul), time: Math.round(time * P.scoreMul), nodmg: Math.round(nodmg * P.scoreMul), total: G.score - before };
  sfx.clear();
  burst(G.fx, G.player.x, playerWorldY() - 16, 60, { colors: ['#ffe14a', '#ff8a1e', '#11a39a', '#ff4a8a', '#ffffff'], speed: 160, life: 1.4, up: 90, kind: 'star' });
  if (G.demo) { save(); }
  save();
  setPhase('levelClear');
}

function nextAfterClear() {
  if (G.levelIndex >= LEVELS.length - 1) {
    if (G.ngPlus + 1 > G.bestNg) { /* recorded when NG+ starts */ }
    save();
    setPhase('victory');
    sfx.extraLife();
  } else {
    enterLevel(G.levelIndex + 1);
  }
}

// ---- main update (one fixed 1/60s step) ---------------------------------------------------

export function update(dt) {
  G.frame++;
  handleInput();
  for (const tt of G.toasts) tt.t += dt;
  G.toasts = G.toasts.filter((tt) => tt.t < tt.life);
  G.levelUpFlash = Math.max(0, (G.levelUpFlash || 0) - dt * 1.5);
  G.wipe = Math.max(0, (G.wipe || 0) - dt * 1.8);

  if (G.paused) return;
  G.phaseT += dt;

  switch (G.phase) {
    case 'title':
      G.attractT += dt;
      simulate(dt, true);
      // attract mode: cycle through the ten landmarks
      if (G.attractT > 11 || G.player.row === G.level.rows.length - 1) {
        G.attractLevel = ((G.attractLevel ?? 0) + 1) % LEVELS.length;
        G.attractT = 0;
        const keep = 'title';
        enterLevel(G.attractLevel, { intro: false, seed: 7 + G.attractLevel });
        G.phase = keep;
      }
      break;
    case 'levelIntro':
      simulate(dt, false);
      if (G.phaseT > 2.6) setPhase('playing');
      break;
    case 'playing':
      simulate(dt, true);
      break;
    case 'levelClear':
      simulateTraffic(dt);
      updateFx(G.fx, dt, G.level.weather, G.cam);
      if (G.phaseT > 3.4) nextAfterClear();
      break;
    default:
      simulateTraffic(dt);
      updateFx(G.fx, dt, G.level.weather, G.cam);
      break;
  }
}

function simulateTraffic(dt) {
  const P = params();
  const events = [];
  for (const lane of G.lanes) if (lane) updateLane(lane, dt, P, G.rng, events);
  G.horn.clock += dt;
  G.horn.gapT = Math.max(0, G.horn.gapT - dt);
  handleTrafficEvents(events);
  reactiveHorns();
  updateAmbient(dt);
}

function updateAmbient(dt) {
  // the metro train glides along the viaduct periodically
  G.metroT -= dt;
  if (G.metroT <= 0 && G.metroX === null) { G.metroX = -460; G.metroDir = 1; }
  if (G.metroX !== null) {
    G.metroX += 170 * dt;
    if (G.metroX > W + 20) { G.metroX = null; G.metroT = 7 + Math.random() * 5; }
  }
}

function simulate(dt, controllable) {
  const p = G.player;
  p.pvx = p.x;                 // remember last step's position for render interpolation
  p.pRowF = p.vRowF ?? p.row;
  const rows = G.level.rows;
  G.levelT += dt;
  if (!G.demo) G.stats.time += dt;

  // dead: wait, then respawn or game over
  if (p.dead) {
    p.deadT -= dt;

    if (p.deadT <= 0) {
      if (G.lives <= 0) {
        if (G.demo) { G.lives = START_LIVES; respawn(); }
        else { save(); setPhase('gameOver'); sfx.gameOver(); }
      } else respawn();
    }
    simulateTraffic(dt);
    updateFx(G.fx, dt, G.level.weather, G.cam);
    updateCamera(dt);
    return;
  }

  // the bot plays when autoplay is on
  if (controllable && G.autoplay && !p.hopping && p.cooldown <= 0) {
    const dir = botDecide(G);
    if (dir) requestHop(p, dir, G) && onHopStart();
  }
  // buffered input fires as soon as possible
  if (controllable && !p.hopping && p.cooldown <= 0 && p.buffered) {
    const d = p.buffered;
    p.buffered = null;
    if (requestHop(p, d, G)) onHopStart();
  }

  // the boat she stands on (if any) — remember it for hop drift
  const lane = G.lanes[p.row];
  G.boatUnder = (!p.hopping && lane && lane.kind === 'water') ? boatAt(lane, p.x) : null;

  const landed = updatePlayer(p, dt);
  simulateTraffic(dt);

  // ride boats: move with the boat under her
  const cur = G.lanes[p.row];
  if (landed) {
    onLand(); // landing does its own water check
  } else if (!p.hopping && cur && cur.kind === 'water') {
    const boat = boatAt(cur, p.x);
    if (boat) {
      p.x += boat.x - boat.prevX;
      // carried off-screen counts as falling in
      if (p.x < 6 || p.x > COLS * TILE - 6) fallInWater();
    } else {
      fallInWater();
    }
  }

  // collisions with traffic (row-based, fair hitboxes)
  if (!p.dead && p.iframes <= 0) {
    const ln = G.lanes[p.row];
    if (ln && (ln.kind === 'road' || ln.kind === 'rail')) {
      const v = vehicleAt(ln, p.x - 6, p.x + 6);
      if (v) hitByVehicle(v);
    }
  }

  // pickups
  if (!p.dead && !p.hopping) {
    for (const pk of G.pickups) {
      if (pk.row === p.row && Math.abs(pk.x - p.x) < 14) { collect(pk); pk.t = 999; }
    }
  }
  updatePickups(G, dt);
  G.pickupT -= dt;
  if (G.pickupT <= 0 && !G.demo) {
    G.pickupT = G.level.pickupEvery * (0.7 + G.rng() * 0.6);
    if (G.pickups.length < 3) spawnPickup(G, G.rng);
  }

  if (G.phase === 'playing') G.timeLeft = Math.max(0, G.timeLeft - dt);
  updateFx(G.fx, dt, G.level.weather, G.cam);
  if (G.level.weather === 'rain' && Math.random() < dt / 9) { G.fx.lightning = 1; sfx.thunder(); }
  // exhaust puffs from big vehicles
  if (G.frame % 6 === 0) {
    for (const ln of G.lanes) if (ln && ln.kind === 'road') for (const v of ln.vehicles) {
      if (v.info.len >= 1.5 && v.type !== 'rickshaw' && v.type !== 'van' && Math.random() < 0.25) {
        const ex = v.dir > 0 ? v.x : v.x + v.w;
        puff(G.fx, ex, rowTop(G.level, ln.row) + 24, v.type === 'truck' || v.type === 'bus' ? 'rgba(70,70,76,0.55)' : 'rgba(150,150,160,0.45)', 3);
      }
    }
  }
  ambientParticles();
  updateCamera(dt);
}

// Little bits of life in the air: krishnochura petals, market dust, monsoon mist
function ambientParticles() {
  const kind = { dhanmondi: 'petal', shahbagh: 'petal', karwanbazar: 'dust', sadarghat: 'dust', mohakhali: 'dust', hatirjheel: 'mote' }[G.level.id];
  if (!kind || G.frame % 7) return;
  const x = Math.random() * W;
  if (kind === 'petal') {
    G.fx.particles.push({ x, y: G.cam - 4, vx: 10 + Math.random() * 14, vy: 18 + Math.random() * 12, g: 0, life: 7, t: 0, size: 2, color: Math.random() < 0.6 ? '#e8442a' : '#f2a6c8', kind: 'square' });
  } else if (kind === 'dust') {
    G.fx.particles.push({ x: -4, y: G.cam + Math.random() * H, vx: 14 + Math.random() * 18, vy: -2 + Math.random() * 4, g: 0, life: 9, t: 0, size: 1, color: 'rgba(240,220,170,0.7)', kind: 'square' });
  } else {
    G.fx.particles.push({ x, y: G.cam + Math.random() * H, vx: 4, vy: -6, g: 0, life: 3, t: 0, size: 1, color: 'rgba(255,220,140,0.8)', kind: 'square' });
  }
}

function onHopStart() {
  sfx.hop();
  const p = G.player;
  puff(G.fx, p.x, playerWorldY() + 1, 'rgba(200,180,150,0.6)', 2);
}

function onLand() {
  const p = G.player;
  const type = G.level.rows[p.row].type;
  if (type !== 'water') { p.lastSafeRow = p.row; p.lastSafeX = p.x; }
  if (type === 'water') {
    const boat = boatAt(G.lanes[p.row], p.x);
    if (!boat || p.x < 6 || p.x > COLS * TILE - 6) { fallInWater(); return; }
  }
  if (p.row > G.furthest && !p.knock) {
    G.furthest = p.row;
    if (!G.demo) {
      const pts = addScore(10);
      floatText(G.fx, `+${pts}`, p.x + 12, playerWorldY() - 24, '#ffe14a', 6, 0.5);
    }
  }
  if (p.row === G.level.rows.length - 1 && G.phase === 'playing') levelCleared();
}

function collect(pk) {
  const p = G.player;
  sfx.pickup();
  const pts = G.demo ? 0 : addScore(50);
  floatText(G.fx, `+${pts}`, p.x, playerWorldY() - 30, '#ffe14a', 8);
  burst(G.fx, pk.x, playerWorldY() - 10, 14, { colors: ['#ffe14a', '#ffffff'], speed: 70, life: 0.5, kind: 'star' });
  if (pk.type === 'tea') { toast(t('tea'), '#ffcf8a'); gainXp('perception'); }
  else if (pk.type === 'cookie') { toast(t('cookie'), '#ffd27a'); gainXp('speed'); }
  else { p.hp = Math.min(MAX_HP, p.hp + 30); toast(t('daab'), '#9af07a'); sfx.heal(); }
}

function updateCamera(dt) {
  G.prevCam = G.cam;
  G.camTarget = clampCam(playerWorldY() - 252);
  G.cam += (G.camTarget - G.cam) * Math.min(1, dt * 5);
}

// ---- horns ---------------------------------------------------------------------------------
// Every honk goes through honk(): it applies the per-vehicle cooldown and the
// voice cap, lights the honk arcs over the vehicle, and plays the class sound
// panned by screen x and quieter the further it is from Rupa. Honks carry
// information: "I'm coming" when Rupa is in a vehicle's lane ahead of it, a
// frustrated blast when stuck in a queue, and an insistent stream from
// wrong-way drivers. A light random layer scales with the level's density.
// G.horn.stats feeds the tests (window.__dhaka.hornStats()).

const HORN_VOICES = 3;            // max horns sounding at once…
const HORN_VOICES_WRONG = 4;      // …wrong-way drivers may take one extra slot
const HORN_LEN = { bell: 0.3, moto: 0.15, cng: 0.27, car: 0.28, bus: 0.78, truck: 1.0, ship: 1.35, ambulance: 0.9 };
const HORN_CD = { ambient: 3, queue: 3, warn: 1.6, wrong: 1.0 };     // per-vehicle cooldown (s)
const WARN_TILES = 4;             // "I'm coming" range ahead of a vehicle

function resetHorns() {
  G.horn = {
    clock: 0, gapT: 0, voices: [], rng: makeRng((G.seed || 1) * 31 + 7),
    stats: { events: 0, played: 0, dropped: 0, maxVoices: 0, byClass: {}, byReason: {} },
  };
}

// Chance an idle "itch to honk" becomes a real honk: busier, faster levels honk more
function ambientHornChance(reason) {
  const lv = G.level;
  const density = lv.speedMul / lv.gap[0];          // ≈0.2 (Dhanmondi) … 0.48 (Sadarghat)
  return Math.min(0.6, (reason === 'queue' ? 0.3 : 0.4) * density);
}

export function honk(v, reason) {
  const H = G.horn;
  if (!(G.phase === 'playing' || G.phase === 'levelIntro')) return false;
  const kind = v.type === 'microbus' && v.variant === 4 ? 'ambulance' : v.info.horn;
  if (!kind || v.hornCd > 0 || !onScreenRow(v.row)) return false;
  H.voices = H.voices.filter((end) => end > H.clock);
  if (H.voices.length >= (reason === 'wrong' ? HORN_VOICES_WRONG : HORN_VOICES)) { H.stats.dropped++; return false; }
  v.hornCd = HORN_CD[reason];
  v.honkFlash = 0.6;
  H.voices.push(H.clock + HORN_LEN[kind]);
  const st = H.stats;
  st.events++;
  st.maxVoices = Math.max(st.maxVoices, H.voices.length);
  st.byClass[kind] = (st.byClass[kind] || 0) + 1;
  st.byReason[reason] = (st.byReason[reason] || 0) + 1;
  if (!G.muted) {
    // stereo position from screen x; volume falls off with distance from Rupa
    const cx = v.x + v.w / 2;
    const dy = rowTop(G.level, v.row) + 27 - playerWorldY();
    const dist = Math.hypot(cx - G.player.x, dy);
    sfx.horn(kind, { pan: ((cx - W / 2) / (W / 2)) * 0.85, vol: Math.max(0.35, Math.min(1, 1.15 - dist / 400)) });
    st.played++;
  }
  return true;
}

// Per-frame checks that make horns react to Rupa and to wrong-way drivers
function reactiveHorns() {
  const p = G.player;
  const rupaRow = p && !p.dead ? (p.hopping ? p.toRow : p.row) : -1;
  for (const lane of G.lanes) {
    if (!lane || lane.kind !== 'road') continue;
    for (const v of lane.vehicles) {
      if (v.wrongWay) {
        // telegraph as it appears at the edge (a double blast if it's near Rupa),
        // then insistent — every 1 s — while it is in Rupa's lane
        if (v.hornBurst > 0) { if (honk(v, 'wrong')) { v.hornBurst--; v.hornCd = 0.6; } continue; }
        if (v.warnT <= 0 && lane.row === rupaRow) honk(v, 'wrong');
        continue;
      }
      if (v.warnT > 0 || lane.row !== rupaRow) continue;
      const ahead = v.dir > 0 ? p.x - (v.x + v.w) : v.x - p.x;
      if (ahead > -4 && ahead < WARN_TILES * TILE) honk(v, 'warn');
    }
  }
}

function handleTrafficEvents(events) {
  const loud = G.phase === 'playing' || G.phase === 'levelIntro';
  for (const e of events) {
    switch (e.kind) {
      case 'honk':
        // light random honking; a short global gap keeps it from machine-gunning
        if (G.horn.gapT <= 0 && G.horn.rng() < ambientHornChance(e.reason) && honk(e.v, e.reason)) G.horn.gapT = 0.35;
        break;
      case 'wrongWayWarn': { // still off-screen: start the telegraph from the edge
        const p = G.player;
        e.v.hornBurst = Math.abs(e.v.row - (p.hopping ? p.toRow : p.row)) <= 1 ? 2 : 1;
        e.v.hornCd = 0;
        break;
      }
      case 'trainWarn':
        if (loud) toast(t('trainWarn'), '#ff5a4a');
        break;
      case 'trainBell':
        if (loud && onScreenRow(G.lanes.find((l) => l && l.kind === 'rail').row)) sfx.trainBell(G.frame);
        break;
      case 'trainPass':
        if (loud) { sfx.trainRumble(); addShake(G.fx, 2); }
        break;
      default: break;
    }
  }
}

function onScreenRow(row) {
  const y = rowTop(G.level, row) - G.cam;
  return y > -40 && y < H + 10;
}

// ---- input --------------------------------------------------------------------------------

export let buttons = []; // clickable rects registered by the HUD each frame
export function setButtons(b) { buttons = b; }

export function toggleLang() {
  G.lang = getLang() === 'en' ? 'bn' : 'en';
  setLang(G.lang);
  save();
}
export function toggleMute() { G.muted = !G.muted; setMuted(G.muted); save(); }
export function toggleScan() { G.scanlines = !G.scanlines; save(); }

export function doAction(name) {
  switch (name) {
    case 'lang': toggleLang(); sfx.menu(); break;
    case 'mute': toggleMute(); sfx.menu(); break;
    case 'scan': toggleScan(); sfx.menu(); break;
    case 'start': startRun(); sfx.menu(); break;
    case 'resume': G.paused = false; sfx.menu(); break;
    case 'quit': goTitle(); setMusic(false); break;
    case 'retry': retryLevel(); sfx.menu(); setMusic(true); break;
    case 'title': goTitle(); setMusic(false); break;
    case 'ngplus': startNewGamePlus(); sfx.menu(); break;
    case 'pause':
      if (G.phase === 'playing' || G.phase === 'levelIntro') { G.paused = !G.paused; sfx.menu(); }
      break;
    default: break;
  }
}

function handleInput() {
  for (const e of drainEvents()) {
    if (e.kind === 'action') {
      if (e.name === 'lang' || e.name === 'mute') { doAction(e.name); continue; }
      if (e.name === 'pause' || (e.name === 'back' && (G.phase === 'playing' || G.phase === 'levelIntro'))) { doAction('pause'); continue; }
      if (e.name === 'back' && (G.phase === 'gameOver' || G.phase === 'victory')) { doAction('title'); continue; }
      if (e.name === 'back' && G.paused) { doAction('resume'); continue; }
      if (e.name === 'confirm') confirm();
      continue;
    }
    if (e.kind === 'click') {
      const b = buttons.find((bb) => e.x >= bb.x && e.x <= bb.x + bb.w && e.y >= bb.y && e.y <= bb.y + bb.h);
      if (b) { doAction(b.action); continue; }
      // a tap anywhere else: confirm in menus, hop up while playing (touch only)
      if (G.phase === 'playing' && !G.paused) { if (e.touch) moveInput('up'); }
      else confirm();
      continue;
    }
    if (e.kind === 'move') {
      if (G.paused) continue;
      if (G.phase === 'playing') moveInput(e.dir);
      else if (G.phase === 'levelIntro' && G.phaseT > 0.4) { setPhase('playing'); moveInput(e.dir); }
    }
  }
}

function moveInput(dir) {
  if (G.autoplay && !G.demo) return;
  const p = G.player;
  if (!p || p.dead) return;
  if (requestHop(p, dir, G)) onHopStart();
}

function confirm() {
  switch (G.phase) {
    case 'title': doAction('start'); break;
    case 'levelIntro': if (G.phaseT > 0.3) setPhase('playing'); break;
    case 'levelClear': if (G.phaseT > 1.0) nextAfterClear(); break;
    case 'gameOver': if (G.phaseT > 0.8) doAction('retry'); break;
    case 'victory': if (G.phaseT > 1.0) doAction('ngplus'); break;
    default: if (G.paused) doAction('resume'); break;
  }
}

export { LEVELS, TOD };
