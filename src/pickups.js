// Pickups: cha (tea) → Perception XP, biscuit → Speed XP, daab (green coconut) → +30 HP.
// They appear on road tiles, bob gently, blink before expiring.

import { TILE, COLS } from './config.js';
import { makeCanvas, rect, circle } from './gfx.js';
import { colX } from './player.js';

export const PICKUP_LIFE = 9;

export function spawnPickup(game, rng, forced = null) {
  const roads = [];
  game.level.rows.forEach((r, i) => { if (r.type === 'road') roads.push(i); });
  if (!roads.length) return null;
  const row = forced?.row ?? rng.pick(roads);
  const col = forced?.col ?? rng.int(1, COLS - 2);
  const type = forced?.type ?? (rng() < 0.1 ? 'daab' : rng() < 0.5 ? 'tea' : 'cookie');
  if (game.pickups.some((p) => p.row === row && p.col === col)) return null;
  const p = { type, row, col, x: colX(col), t: 0, life: forced?.life ?? PICKUP_LIFE };
  game.pickups.push(p);
  return p;
}

export function updatePickups(game, dt) {
  for (const p of game.pickups) p.t += dt;
  game.pickups = game.pickups.filter((p) => p.t < p.life);
}

// ---- sprites (16×16) ---------------------------------------------------------

function paintTea() {
  const c = makeCanvas(16, 16), g = c.getContext('2d');
  // glass cup of milky cha on a saucer, steam on top
  rect(g, 2, 13, 12, 2, '#f2f2f2'); rect(g, 3, 14, 10, 1, '#c8c8d0');
  rect(g, 4, 6, 8, 7, '#e8eef2'); rect(g, 5, 7, 6, 5, '#c8864a'); rect(g, 5, 7, 6, 1, '#e8b47a');
  rect(g, 12, 8, 2, 3, '#e8eef2');
  rect(g, 6, 1, 1, 3, 'rgba(255,255,255,0.8)'); rect(g, 9, 0, 1, 4, 'rgba(255,255,255,0.7)');
  return c;
}
function paintCookie() {
  const c = makeCanvas(16, 16), g = c.getContext('2d');
  circle(g, 8, 8, 6, '#c8862a'); circle(g, 8, 8, 5, '#e0a448');
  rect(g, 5, 5, 2, 2, '#7a4a1a'); rect(g, 9, 7, 2, 2, '#7a4a1a'); rect(g, 6, 10, 2, 2, '#7a4a1a');
  rect(g, 6, 3, 4, 1, '#f2c878');
  return c;
}
function paintDaab() {
  const c = makeCanvas(16, 16), g = c.getContext('2d');
  circle(g, 8, 9, 6, '#3f9a2f'); circle(g, 7, 8, 4, '#5ab83a');
  rect(g, 5, 5, 2, 2, '#8ad85a');
  rect(g, 7, 3, 3, 2, '#d8e8b0'); // cut top
  rect(g, 9, 0, 1, 4, '#ff4a7a'); rect(g, 9, 0, 3, 1, '#ff4a7a'); // straw
  return c;
}

let SPR = null;
export function pickupSprites() {
  if (!SPR) SPR = { tea: paintTea(), cookie: paintCookie(), daab: paintDaab() };
  return SPR;
}

export const PICKUP_COLORS = { tea: '#ffcf8a', cookie: '#ffd27a', daab: '#9af07a' };
