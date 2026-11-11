// Traffic: one Lane per road / water / rail row.
//
// Rules this file guarantees:
//  * Vehicles in the same direction never overlap — followers brake and queue.
//  * New vehicles are only spawned once the previous one has cleared a gap, so
//    there is always a crossable hole in each lane.
//  * Wrong-way drivers: telegraphed (held off-screen with a warning, then
//    flashing headlights + "!"), at most one per lane, and they swerve/brake
//    past oncoming traffic instead of driving through it.
//  * Rail rows run a warn → train → clear cycle.

import { W, TILE } from './config.js';
import { VEHICLES, variantCount } from './vehicles.js';

let nextId = 1;
const FOLLOW_GAP = 46;        // px kept between queued vehicles (≈1.4 tiles: still crossable)
const WRONG_WARN = 1.1;       // seconds a wrong-way driver is telegraphed before entering
const FAST_THRESHOLD = 85;    // px/s — Perception slows vehicles faster than this

export function createLane(rowIndex, def, level, P, rng) {
  const lane = {
    row: rowIndex,
    kind: def.type,                 // 'road' | 'water' | 'rail'
    dir: def.dir || (rng() < 0.5 ? 1 : -1),
    spd: def.spd || 1,
    mix: def.type === 'water' ? level.waterMix : (def.mix || level.mix),
    gap: def.gap || level.gap,
    vehicles: [],
    lastSpawn: null,                // most recent normal vehicle (for gap checks)
    needGap: 0,
    wrongCooldown: rng.range(2, 6),
    // rail state machine
    rail: def.type === 'rail' ? { state: 'idle', t: rng.range(2.5, 4), gate: 0, bell: 0, dir: 1 } : null,
    trainSpeed: level.train ? level.train.speed : 500,
    idleRange: level.train ? level.train.idle : [6, 9],
  };
  lane.needGap = nextGapPx(lane, P, rng);
  if (lane.kind !== 'rail') prefill(lane, P, rng);
  return lane;
}

function nextGapPx(lane, P, rng) {
  const [a, b] = lane.gap;
  if (lane.kind === 'water') return rng.range(a, b) * TILE; // boats keep a steady rhythm
  // Density rises in NG+ (smaller gaps), but never below 2 tiles.
  return Math.max(2 * TILE, rng.range(a, b) * TILE * P.gapMul);
}

// Base speed of a new vehicle in this lane (before Perception)
function baseSpeedFor(type, lane, P, rng) {
  const info = VEHICLES[type];
  if (info.ride) return 36 * lane.spd * P.speedMul; // all boats in a lane share one speed, so they never bunch up
  return info.speed * lane.spd * P.speedMul * rng.range(0.9, 1.1);
}

function makeVehicle(type, lane, P, rng, { x, dir, wrongWay = false }) {
  const info = VEHICLES[type];
  const w = Math.round(info.len * TILE);
  const base = baseSpeedFor(type, lane, P, rng) * (wrongWay ? 0.95 : 1);
  return {
    id: nextId++,
    type, info, w, dir, wrongWay,
    row: lane.row,
    variant: Math.floor(rng() * variantCount(type)),
    x, prevX: x,
    base, speed: base,
    swerve: 0, swerveTarget: 0, prevSwerve: 0,
    warnT: wrongWay ? WRONG_WARN : 0,
    honkT: rng.range(2, 8),         // idle "itch to honk" timer (game.js decides if it sounds)
    hornCd: 0,                      // per-vehicle horn cooldown (s)
    braking: false,                 // stuck behind a queue / squeezing past a wrong-way driver
    honkFlash: 0,
    bob: rng() * 10,
  };
}

// Fill a lane with vehicles at level start so it doesn't begin empty.
function prefill(lane, P, rng) {
  let pos = rng.range(0, 3) * TILE; // distance from the entry edge
  while (pos < W + 40) {
    const type = rng.weighted(lane.mix);
    const info = VEHICLES[type];
    const w = Math.round(info.len * TILE);
    const x = lane.dir > 0 ? W - pos - w : pos;   // place along the travel direction
    const v = makeVehicle(type, lane, P, rng, { x, dir: lane.dir });
    lane.vehicles.push(v);
    pos += w + nextGapPx(lane, P, rng);
  }
  // The vehicle nearest the entry edge is "last spawned"
  lane.lastSpawn = lane.dir > 0
    ? lane.vehicles.reduce((m, v) => (v.x < m.x ? v : m), lane.vehicles[0])
    : lane.vehicles.reduce((m, v) => (v.x > m.x ? v : m), lane.vehicles[0]);
}

// Effective speed after the Perception upgrade
export function effectiveSpeed(base, P) {
  return base > FAST_THRESHOLD ? base * (1 - 0.07 * P.perception) : base;
}

// ---- per-step update ---------------------------------------------------------

export function updateLane(lane, dt, P, rng, events) {
  if (lane.kind === 'rail') return updateRail(lane, dt, P, rng, events);

  const vs = lane.vehicles;
  for (const v of vs) { v.prevX = v.x; v.prevSwerve = v.swerve; }

  // 1. desired speeds + queueing behind slower vehicles in the same direction
  for (const v of vs) {
    if (v.warnT > 0) continue;
    v.braking = false;
    let target = lane.kind === 'water' ? v.base : effectiveSpeed(v.base, P);
    if (lane.kind === 'road') {
      const lead = leaderOf(v, vs);
      if (lead) {
        const gap = v.dir > 0 ? lead.x - (v.x + v.w) : v.x - (lead.x + lead.w);
        if (gap < FOLLOW_GAP) {
          target = Math.min(target, lead.speed * (gap < FOLLOW_GAP * 0.75 ? 0.7 : 1));
          if (gap < FOLLOW_GAP * 0.5) target = 0;
          // stuck behind someone slow? lean on the horn
          v.honkT -= dt * 2;
          v.braking = true;
        }
      }
      v.swerveTarget = 0;
    }
    v._target = target;
  }

  // 2. wrong-way drivers squeeze past oncoming traffic (cosmetic swerve + braking)
  if (lane.kind === 'road') {
    for (const ww of vs) {
      if (!ww.wrongWay || ww.warnT > 0) continue;
      for (const o of vs) {
        if (o === ww || o.wrongWay) continue;
        // distance between their facing fronts (positive = still approaching)
        const near = ww.x < o.x + o.w + 40 && ww.x + ww.w > o.x - 40;
        if (near) {
          ww.swerveTarget = -9;
          o.swerveTarget = 7;
          ww._target = Math.min(ww._target, ww.base * 0.55);
          o._target = Math.min(o._target, o.base * 0.55);
          o.honkT -= dt * 3;
          o.braking = true;
        }
      }
    }
  }

  // 3. integrate
  for (const v of vs) {
    if (v.warnT > 0) {
      v.warnT -= dt;
      if (v.warnT <= 0) events.push({ kind: 'wrongWayEnter', v });
      continue;
    }
    const accel = v.info.len > 3 ? 120 : 240;
    if (v.speed < v._target) v.speed = Math.min(v._target, v.speed + accel * dt);
    else v.speed = Math.max(v._target, v.speed - 420 * dt);
    v.x += v.speed * v.dir * dt;
    v.swerve += (v.swerveTarget - v.swerve) * Math.min(1, dt * 6);
    v.honkT -= dt;
    v.hornCd = Math.max(0, v.hornCd - dt);
    v.honkFlash = Math.max(0, v.honkFlash - dt);
    if (v.honkT <= 0) {
      v.honkT = rng.range(5, 14);
      events.push({ kind: 'honk', v, reason: v.braking ? 'queue' : 'ambient' });
    }
  }

  // 4. despawn off-screen vehicles
  for (let i = vs.length - 1; i >= 0; i--) {
    const v = vs[i];
    if (v.warnT > 0) continue;
    if ((v.dir > 0 && v.x > W + 60) || (v.dir < 0 && v.x + v.w < -60)) {
      if (lane.lastSpawn === v) lane.lastSpawn = null;
      vs.splice(i, 1);
    }
  }

  // 5. spawn
  lane.wrongCooldown -= dt;
  if (lane.lastSpawn && lane.lastSpawn.ghost) lane.lastSpawn.x += 60 * P.speedMul * lane.dir * dt;
  const last = lane.lastSpawn;
  const cleared = !last || (lane.dir > 0 ? last.x >= lane.needGap : last.x + last.w <= W - lane.needGap);
  if (cleared) spawn(lane, P, rng, events);
}

function leaderOf(v, vs) {
  let best = null, bestD = Infinity;
  for (const o of vs) {
    if (o === v || o.dir !== v.dir || o.wrongWay !== v.wrongWay || o.warnT > 0) continue;
    const d = v.dir > 0 ? o.x - v.x : v.x - o.x;
    if (d > 0 && d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function spawn(lane, P, rng, events) {
  const type = rng.weighted(lane.mix);
  const info = VEHICLES[type];
  const w = Math.round(info.len * TILE);

  // Roll for a wrong-way driver (roads only, one at a time per lane)
  if (lane.kind === 'road' && lane.wrongCooldown <= 0 && !lane.vehicles.some((v) => v.wrongWay)) {
    const p = Math.min(0.75, P.wrongChance * info.wrong);
    if (rng() < p) {
      const dir = -lane.dir;
      const x = dir > 0 ? -w - 4 : W + 4;
      const v = makeVehicle(type, lane, P, rng, { x, dir, wrongWay: true });
      lane.vehicles.push(v);
      lane.wrongCooldown = rng.range(4, 8);
      events.push({ kind: 'wrongWayWarn', v });
      // Also open an extra gap in the normal flow so the lane stays crossable:
      // a "ghost" marker drifts in from the entry edge and normal spawning
      // waits until it has cleared a full gap.
      lane.needGap = nextGapPx(lane, P, rng);
      lane.lastSpawn = { x: lane.dir > 0 ? 0 : W, w: 0, ghost: true };
      return;
    }
  }

  const dir = lane.dir;
  const x = dir > 0 ? -w - 2 : W + 2;
  const v = makeVehicle(type, lane, P, rng, { x, dir });
  lane.vehicles.push(v);
  lane.lastSpawn = v;
  lane.needGap = nextGapPx(lane, P, rng);
}

// ---- rail crossing -----------------------------------------------------------

const RAIL_WARN = 2.8;   // seconds of bells + gate before the train
const RAIL_CLEAR = 0.9;

function updateRail(lane, dt, P, rng, events) {
  const r = lane.rail;
  for (const v of lane.vehicles) v.prevX = v.x;
  r.t -= dt;
  if (r.state === 'idle') {
    r.gate = Math.max(0, r.gate - dt * 1.5);
    if (r.t <= 0) {
      r.state = 'warn';
      r.t = RAIL_WARN;
      r.dir = rng() < 0.5 ? 1 : -1;
      events.push({ kind: 'trainWarn', lane });
    }
  } else if (r.state === 'warn') {
    r.gate = Math.min(1, r.gate + dt / (RAIL_WARN * 0.7));
    r.bell -= dt;
    if (r.bell <= 0) { r.bell = 0.35; events.push({ kind: 'trainBell' }); }
    if (r.t <= 0) {
      r.state = 'pass';
      const w = Math.round(VEHICLES.train.len * TILE);
      const x = r.dir > 0 ? -w : W;
      const v = makeVehicle('train', lane, P, rng, { x, dir: r.dir });
      v.base = v.speed = lane.trainSpeed * P.speedMul;
      lane.vehicles.push(v);
      events.push({ kind: 'trainPass' });
    }
  } else if (r.state === 'pass') {
    r.bell -= dt;
    if (r.bell <= 0) { r.bell = 0.35; events.push({ kind: 'trainBell' }); }
    for (const v of lane.vehicles) v.x += v.speed * v.dir * dt;
    lane.vehicles = lane.vehicles.filter((v) => !((v.dir > 0 && v.x > W + 20) || (v.dir < 0 && v.x + v.w < -20)));
    if (!lane.vehicles.length) { r.state = 'clear'; r.t = RAIL_CLEAR; }
  } else if (r.state === 'clear') {
    r.gate = Math.max(0, r.gate - dt * 1.5);
    if (r.t <= 0) { r.state = 'idle'; r.t = rng.range(lane.idleRange[0], lane.idleRange[1]) / Math.max(0.6, P.speedMul); }
  }
}

// Is Rupa's span [x0, x1] overlapping any harmful vehicle in this lane?
export function vehicleAt(lane, x0, x1) {
  for (const v of lane.vehicles) {
    if (v.warnT > 0 || v.info.ride) continue;
    const inset = v.type === 'train' ? 2 : Math.min(5, v.w * 0.14);
    if (x1 > v.x + inset && x0 < v.x + v.w - inset) return v;
  }
  return null;
}

// Boat under Rupa's centre x (water lanes)
export function boatAt(lane, x) {
  for (const v of lane.vehicles) {
    if (x > v.x + 5 && x < v.x + v.w - 5) return v;
  }
  return null;
}
