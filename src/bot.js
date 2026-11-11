// Autoplay bot: a simple gap-finder used by tests (to prove every level can be
// completed) and by the title screen's attract mode.
//
// Each time Rupa can act, it predicts where every vehicle will be over the next
// fraction of a second (assuming constant speed) and picks the first safe move:
// up → wait → sideways → down.

import { TILE, COLS } from './config.js';
import { hopTiming } from './player.js';
import { effectiveSpeed } from './traffic.js';

const HALF = 7;     // Rupa's half-width for prediction
const MARGIN = 7;   // extra safety margin (px)

// Predicted left edge of a vehicle t seconds from now (held wrong-way drivers
// start moving once their warning ends). Uses the larger of current and
// cruising speed so the bot stays on the cautious side.
function vehiclePosAt(v, t, P) {
  const remaining = Math.max(0, t - v.warnT);
  const speed = Math.max(v.speed, v.info.ride ? 0 : effectiveSpeed(v.base, P) * 0.9);
  return v.x + v.dir * speed * remaining;
}

function roadSafe(lane, x, t0, t1, P) {
  for (const v of lane.vehicles) {
    if (v.info.ride) continue;
    for (let t = t0; t <= t1 + 1e-6; t += 1 / 30) {
      const vx = vehiclePosAt(v, t, P, lane.kind);
      if (x + HALF + MARGIN > vx && x - HALF - MARGIN < vx + v.w) return false;
    }
  }
  return true;
}

function boatUnderAt(lane, x, t) {
  for (const v of lane.vehicles) {
    const bx = v.x + v.dir * v.speed * t;
    if (x > bx + 9 && x < bx + v.w - 9) return v;
  }
  return null;
}

// Is it safe to be in `row` at horizontal position x during [t0, t1]?
function safe(G, row, x, t0, t1, P) {
  const rows = G.level.rows;
  if (row < 0 || row >= rows.length) return false;
  if (x < TILE / 2 - 1 || x > COLS * TILE - TILE / 2 + 1) return false;
  const type = rows[row].type;
  const lane = G.lanes[row];
  if (type === 'foot' || type === 'goal' || type === 'median') return true;
  if (type === 'rail') {
    const r = lane.rail;
    if (lane.vehicles.length) return roadSafe(lane, x, t0, t1, P) && r.state !== 'warn';
    return r.state === 'idle' ? r.t > t1 + 0.5 : r.state === 'clear';
  }
  if (type === 'road') return roadSafe(lane, x, t0, t1, P);
  if (type === 'water') {
    // must land on a boat and stay on it (not drift off-screen) for a while
    const b = boatUnderAt(lane, x, t0);
    if (!b) return false;
    const drift = b.dir * b.speed * (t1 - t0 + 0.6);
    const endX = x + drift;
    if (endX < 24 || endX > COLS * TILE - 24) return false;
    return true;
  }
  return true;
}

export function botDecide(G) {
  const p = G.player;
  const P = {
    perception: G.upgrades.perception.lvl,
  };
  const { dur, cool } = hopTiming(G.upgrades.speed.lvl);
  const hop = dur + cool;
  const rows = G.level.rows;
  const curType = rows[p.row].type;
  const onWater = curType === 'water';
  const boat = G.boatUnder;
  const drift = onWater && boat ? boat.dir * boat.speed : 0;
  const landX = (dx) => {
    const x = p.x + dx + drift * dur;
    return x;
  };
  const snap = (x, row) => (rows[row] && rows[row].type !== 'water') ? Math.floor(x / TILE) * TILE + TILE / 2 : x;
  const stay = 0.5;   // how long we need to survive after landing before acting again

  // 1. forward
  const upRow = p.row + 1;
  if (upRow < rows.length) {
    const ux = snap(landX(0), upRow);
    if (safe(G, upRow, ux, dur * 0.45, hop + stay, P)) return 'up';
  }
  // 2. stay put (only if the current spot stays safe)
  const stayOk = onWater
    ? (boat && p.x + drift * 0.8 > 28 && p.x + drift * 0.8 < COLS * TILE - 28)
    : safe(G, p.row, p.x, 0, 0.5, P);
  // on water (or waiting to board a boat) drift toward the centre — boats
  // carry you sideways, so waiting at the edge never works out
  const nextIsWater = rows[p.row + 1] && rows[p.row + 1].type === 'water';
  const nearEdge = p.x < 120 || p.x > COLS * TILE - 120;
  if (stayOk && !((onWater || nextIsWater) && nearEdge)) return null;

  // 3. sideways — prefer the direction toward the centre
  const sides = p.x < COLS * TILE / 2 ? [['right', TILE], ['left', -TILE]] : [['left', -TILE], ['right', TILE]];
  for (const [dir, dx] of sides) {
    const sx = snap(landX(dx), p.row);
    if (safe(G, p.row, sx, dur * 0.45, hop + 0.3, P)) return dir;
  }
  if (stayOk) return null;
  // 4. retreat
  const dn = p.row - 1;
  if (dn >= 0) {
    const dx = snap(landX(0), dn);
    if (safe(G, dn, dx, dur * 0.45, hop + 0.3, P)) return 'down';
  }
  // 5. on water with nowhere to go: try any hop forward rather than drift off
  if (onWater) return 'up';
  return null;
}
