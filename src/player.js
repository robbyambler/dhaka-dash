// Rupa: the player. Grid hops with input buffering, HP, i-frames, sprites.
//
// Position model: `row` is the grid row (0 = start footpath), `x` is her
// centre in pixels. On land x snaps to column centres; on water she drifts
// with the boat she's standing on.

import { TILE, COLS, HOP_TIME, HOP_COOLDOWN, MAX_HP } from './config.js';
import { makeCanvas, rect, mirror } from './gfx.js';

export const colX = (c) => c * TILE + TILE / 2;
export const xToCol = (x) => Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE)));

export function createPlayer(startCol = 10) {
  return {
    row: 0, x: colX(startCol),
    fromRow: 0, toRow: 0, fromX: colX(startCol), toX: colX(startCol),
    hopping: false, hopT: 0, hopDur: HOP_TIME, cooldown: 0,
    facing: 'up', buffered: null,
    hp: MAX_HP, iframes: 0,
    lastSafeRow: 0, lastSafeX: colX(startCol),
    drift: 0,                // boat velocity carried during a hop
    knock: false,            // current hop is a knockback (not player-initiated)
    // for render interpolation
    pvx: colX(startCol), pRowF: 0, vRowF: 0, lift: 0,
    squash: 0,
    dead: false,
  };
}

// Hop timing after Speed upgrades (~8% faster per level)
export function hopTiming(speedLevel) {
  const f = Math.pow(0.92, speedLevel);
  return { dur: HOP_TIME * f, cool: HOP_COOLDOWN * f };
}

// Start a hop if possible; otherwise buffer it.
export function requestHop(p, dir, game) {
  if (p.dead) return false;
  if (p.hopping || p.cooldown > 0) { p.buffered = dir; return false; }
  return startHop(p, dir, game);
}

export function startHop(p, dir, game, opts = {}) {
  const dRow = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
  const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const toRow = p.row + dRow;
  if (toRow < 0 || toRow >= game.level.rows.length) return false;
  let toX = p.x + dCol * TILE;
  if (toX < TILE / 2 - 1 || toX > COLS * TILE - TILE / 2 + 1) {
    if (dCol !== 0) return false;
  }
  const targetType = game.level.rows[toRow].type;
  // Landing on solid ground snaps back onto the grid
  if (targetType !== 'water') toX = colX(xToCol(toX));
  const { dur, cool } = hopTiming(game.upgrades.speed.lvl);
  p.fromRow = p.row; p.toRow = toRow;
  p.fromX = p.x; p.toX = toX;
  p.hopDur = opts.dur || dur;
  p.cooldownAfter = cool;
  p.hopT = 0;
  p.hopping = true;
  p.knock = !!opts.knock;
  p.facing = opts.keepFacing ? p.facing : dir;
  // carry the boat's drift through the hop (classic lane-crossing arcade feel)
  p.drift = game.boatUnder ? game.boatUnder.speed * game.boatUnder.dir : 0;
  if (targetType !== 'water') p.drift = 0;
  return true;
}

// Advance hop animation; returns true on the step she lands.
export function updatePlayer(p, dt) {
  p.iframes = Math.max(0, p.iframes - dt);
  p.squash *= Math.pow(0.0005, dt);
  let landed = false;
  if (p.hopping) {
    p.hopT += dt / p.hopDur;
    p.fromX += p.drift * dt;
    p.toX += p.drift * dt;
    const t = Math.min(1, p.hopT);
    const e = t * (2 - t); // ease-out
    p.x = p.fromX + (p.toX - p.fromX) * e;
    // she "belongs" to the target row from halfway through the hop
    p.row = t >= 0.5 ? p.toRow : p.fromRow;
    p.lift = Math.sin(Math.PI * t) * (p.knock ? 6 : 9);
    p.vRowF = p.fromRow + (p.toRow - p.fromRow) * e;
    if (p.hopT >= 1) {
      p.hopping = false;
      p.x = p.toX;
      p.row = p.toRow;
      p.lift = 0;
      p.vRowF = p.row;
      p.cooldown = p.cooldownAfter || HOP_COOLDOWN;
      p.squash = 1;
      landed = true;
    }
  } else {
    p.vRowF = p.row;
    if (p.cooldown > 0) p.cooldown -= dt;
  }
  return landed;
}

// ---- sprites ------------------------------------------------------------------
// 20×30 frames. Teal salwar kameez, orange orna (scarf), black braid, backpack.

const C = {
  skin: '#b07850', skinD: '#8a5a38', hair: '#141018', hairH: '#3a2a3a',
  kameez: '#11a39a', kameezD: '#0b7a72', kameezH: '#4fd6c8', trim: '#f2c23a',
  salwar: '#e8f4f0', salwarD: '#b8d0ca', orna: '#ff8a1e', ornaD: '#d8620a', ornaH: '#ffc070',
  bag: '#3a3f8a', bagD: '#262a60', bagH: '#6a70c8', sandal: '#5a2a1a', eye: '#1a1014', lip: '#a83a3a',
};

function paintRupa(dir, frame) {
  const c = makeCanvas(20, 30);
  const g = c.getContext('2d');
  const tuck = frame === 1 ? 2 : 0; // legs tucked mid-hop
  // legs (salwar) + sandals
  if (dir === 'up' || dir === 'down') {
    rect(g, 6, 21, 3, 6 - tuck, C.salwar); rect(g, 11, 21, 3, 6 - tuck, C.salwar);
    rect(g, 6, 21, 1, 6 - tuck, C.salwarD); rect(g, 11, 21, 1, 6 - tuck, C.salwarD);
    rect(g, 6, 27 - tuck, 3, 2, C.sandal); rect(g, 11, 27 - tuck, 3, 2, C.sandal);
  } else {
    rect(g, 8, 21, 4, 6 - tuck, C.salwar);
    rect(g, 8, 21, 1, 6 - tuck, C.salwarD);
    rect(g, frame === 1 ? 6 : 7, 27 - tuck, 4, 2, C.sandal); rect(g, frame === 1 ? 11 : 10, 27 - tuck, 3, 2, C.sandal);
  }
  // kameez (long tunic) with side slits and gold trim
  rect(g, 4, 10, 12, 12, C.kameez);
  rect(g, 4, 10, 2, 12, C.kameezD);
  rect(g, 14, 10, 2, 12, C.kameezD);
  rect(g, 4, 21, 12, 1, C.trim);
  rect(g, 6, 11, 8, 1, C.kameezH);
  if (dir === 'down') {
    // face, front view
    rect(g, 6, 2, 8, 8, C.skin);
    rect(g, 5, 1, 10, 3, C.hair); rect(g, 5, 4, 2, 5, C.hair); rect(g, 13, 4, 2, 5, C.hair);
    rect(g, 7, 1, 6, 1, C.hairH);
    rect(g, 7, 5, 2, 2, C.eye); rect(g, 11, 5, 2, 2, C.eye);
    rect(g, 7, 5, 1, 1, '#ffffff'); rect(g, 11, 5, 1, 1, '#ffffff');
    rect(g, 9, 4, 2, 1, '#c8302a'); // small red teep
    rect(g, 9, 8, 2, 1, C.lip);
    // orna draped over both shoulders, ends hanging in front
    rect(g, 4, 10, 12, 3, C.orna); rect(g, 4, 12, 3, 8, C.orna); rect(g, 13, 12, 3, 7, C.ornaD);
    rect(g, 5, 10, 10, 1, C.ornaH);
    // backpack straps
    rect(g, 7, 13, 1, 6, C.bagD); rect(g, 12, 13, 1, 6, C.bagD);
    // arms
    rect(g, 2, 12, 2, 7, C.kameez); rect(g, 16, 12, 2, 7, C.kameez);
    rect(g, 2, 19, 2, 2, C.skin); rect(g, 16, 19, 2, 2, C.skin);
  } else if (dir === 'up') {
    // back view: hair, long braid, big backpack, orna streaming
    rect(g, 6, 2, 8, 8, C.hair); rect(g, 5, 2, 10, 4, C.hair);
    rect(g, 7, 2, 4, 1, C.hairH);
    rect(g, 5, 6, 1, 3, C.skin); rect(g, 14, 6, 1, 3, C.skin);
    rect(g, 4, 9, 12, 3, C.orna); rect(g, 5, 9, 10, 1, C.ornaH);
    rect(g, 2, 11, 2, 7, C.kameez); rect(g, 16, 11, 2, 7, C.kameez);
    rect(g, 2, 18, 2, 2, C.skin); rect(g, 16, 18, 2, 2, C.skin);
    // backpack
    rect(g, 5, 11, 10, 10, C.bag); rect(g, 5, 11, 10, 2, C.bagH); rect(g, 5, 19, 10, 2, C.bagD);
    rect(g, 7, 15, 6, 3, C.bagD); rect(g, 9, 15, 2, 1, '#d8d8e8');
    rect(g, 12, 13, 2, 2, '#ff5a8a'); // keychain charm
    // braid falls over the backpack
    rect(g, 9, 10, 2, 2, C.hair); rect(g, 9, 12, 2, 1, '#ff3a6a');
    // orna tail fluttering
    rect(g, 15, 10, 3, 2, C.orna); rect(g, 17, 11, 2, 4, C.ornaD);
  } else {
    // side view facing right (left is mirrored)
    rect(g, 7, 2, 7, 8, C.skin);
    rect(g, 6, 1, 8, 3, C.hair); rect(g, 6, 3, 3, 6, C.hair);
    rect(g, 7, 1, 5, 1, C.hairH);
    rect(g, 11, 5, 2, 2, C.eye); rect(g, 12, 5, 1, 1, '#fff');
    rect(g, 13, 7, 1, 1, C.skinD);
    rect(g, 12, 8, 1, 1, C.lip);
    // braid swinging behind
    rect(g, 5, 8, 2, 6, C.hair); rect(g, 5, 14, 2, 1, '#ff3a6a');
    // backpack on the back (left side)
    rect(g, 1, 11, 5, 9, C.bag); rect(g, 1, 11, 5, 2, C.bagH); rect(g, 1, 18, 5, 2, C.bagD);
    // orna across the shoulder, tail streaming back
    rect(g, 6, 10, 9, 3, C.orna); rect(g, 6, 10, 9, 1, C.ornaH);
    rect(g, 2, 9, 4, 2, C.orna); rect(g, 0, 10, 3, 2, C.ornaD);
    // arm swinging
    const ax = frame === 1 ? 13 : 11;
    rect(g, ax, 12, 3, 6, C.kameez); rect(g, ax, 18, 3, 2, C.skin);
  }
  // dark outline for readability
  outline1(c);
  return c;
}

function outline1(c) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const d = g.getImageData(0, 0, w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d.data[(y * w + x) * 4 + 3];
  g.fillStyle = '#120a18';
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a(x, y)) continue;
    if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) pts.push([x, y]);
  }
  for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
}

let RUPA = null;
export function rupaSprites() {
  if (RUPA) return RUPA;
  RUPA = {};
  for (const d of ['up', 'down', 'right']) RUPA[d] = [paintRupa(d, 0), paintRupa(d, 1)];
  RUPA.left = RUPA.right.map(mirror);
  // white silhouette for the hit flash
  RUPA.flash = {};
  for (const d of ['up', 'down', 'left', 'right']) {
    RUPA.flash[d] = RUPA[d].map((s) => {
      const c = makeCanvas(s.width, s.height);
      const g = c.getContext('2d');
      g.drawImage(s, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  // teal silhouette shown "through" vehicles that hide her
  RUPA.ghost = {};
  for (const d of ['up', 'down', 'left', 'right']) {
    const src = RUPA[d][0];
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#7affea';
    g.fillRect(0, 0, c.width, c.height);
    RUPA.ghost[d] = c;
  }
  return RUPA;
}

