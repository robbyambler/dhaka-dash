// Builds everything static about a level's scene, once per level (and per
// screen scale): the painted ground/backdrop canvas, a parallax skyline,
// depth-sorted props, overhead structures, lights and ambient actors.

import { W, TILE } from '../config.js';
import { makeCanvas, rect, shade, circle, signboard, rgba, mix, mirror } from '../gfx.js';
import { artRng } from '../rng.js';
import {
  zebraOnRow, paintRoad, paintFootpath, paintMedianBase, paintRail, paintWaterRow, wires, pole,
  treeSprite, palmSprite, lampSprite, personSprite, dogSprite, teaStall, fruitCart, bookStall,
  flowerStall, cottonCandy, umbrellaPerson, railGatePost, bushSprite, railingSprite, stallTent,
  sackPile, bollard, trafficCone,
} from './common.js';
import { LANDMARKS, skyline } from './landmarks.js';

export const BACKDROP_H = 236;  // world px above the goal footpath
export const NEAR_H = 44;       // decorative strip below the start footpath
export const SKY_H = 200;

// Per-level surface colours and footpath dressing (see docs/dhaka-reference.md)
const LOOK = {
  dhanmondi:   { asphalt: '#4a4a4c', paver: '#b9afa2', tactile: '#c9a12e', medianTop: '#9a9a8a', grass: '#4e7a32', line: '#d9d6cc', stalls: [['tea', 'চা ও কফি'], ['cotton'], ['tea', 'ফুচকা চটপটি'], ['fruit'], ['tea', 'আইসক্রিম']], trees: true },
  newmarket:   { asphalt: '#5b5855', paver: '#8c5a47', tactile: '#c9a12e', medianTop: '#8a8478', line: '#d9d6cc', stalls: [['books'], ['books'], ['tea', 'পুরাতন বই কেনা-বেচা'], ['books'], ['fruit'], ['tea', 'কম দামে বই']] },
  shahbagh:    { asphalt: '#4e4e50', paver: '#8c5a47', tactile: '#c9a12e', medianTop: '#9a9a94', grass: '#4e7a32', line: '#d9d6cc', stalls: [['flowers'], ['flowers'], ['tea', 'ফুলের দোকান'], ['flowers'], ['tea', 'গাঁদা ফুল, গোলাপ']], trees: true },
  farmgate:    { asphalt: '#3a3b40', paver: '#7a5244', tactile: '#a88a2a', medianTop: '#7a7a76', line: '#c8c6bc', stalls: [['tea', 'বৃষ্টি, ছাতা'], ['fruit'], ['tea', 'ফার্মেসি'], ['cone']], wet: true },
  karwanbazar: { asphalt: '#5e5a55', paver: '#8c6a50', tactile: '#c9a12e', medianTop: '#8a8070', line: '#d9d6cc', stalls: [['tent'], ['sacks'], ['tent'], ['tea', 'ডিম ও মুরগি'], ['sacks'], ['tent']] },
  hatirjheel:  { asphalt: '#4a4a4c', paver: '#b7a79a', tactile: '#c9a12e', medianTop: '#a8988a', grass: '#4e7a32', line: '#e0dcd0', water: '#5e7e75', stalls: [['tea', 'ফুচকা'], ['tea', 'ঝালমুড়ি'], ['bollard'], ['fruit']] },
  mohakhali:   { asphalt: '#75716a', paver: '#8a6a58', tactile: '#b8962a', medianTop: '#8a8a84', line: '#d9d6cc', stalls: [['tent'], ['tea', 'চা, সিগারেট, পান'], ['tent'], ['fruit']] },
  gulshan:     { asphalt: '#3c3c40', paver: '#9a9088', tactile: '#c9a12e', medianTop: '#8a8a8a', grass: '#3a6a32', line: '#e8e8e8', stalls: [['tea', 'এক্সপ্রেস সার্ভিস'], ['bollard'], ['tea', 'ফ্ল্যাট ভাড়া']], trees: true },
  motijheel:   { asphalt: '#4e4e4e', paver: '#8c6a5a', tactile: '#c9a12e', medianTop: '#8a8a84', grass: '#5e7a3a', line: '#d9d6cc', stalls: [['tea', 'শীতের পিঠা'], ['fruit'], ['tea', 'গরম চা, পিঠা']] },
  sadarghat:   { asphalt: '#5a524a', paver: '#8a6a50', tactile: '#a88a2a', medianTop: '#8a7a6a', line: '#d0c8b8', water: '#4b5b58', stalls: [['sacks'], ['tea', 'পুরান ঢাকা'], ['sacks'], ['tent'], ['tea', 'টিকিট কাউন্টার']] },
};

export function worldHeight(level) { return BACKDROP_H + level.rows.length * TILE + NEAR_H; }
export function rowTop(level, r) { return BACKDROP_H + (level.rows.length - 1 - r) * TILE; }

// Build a stall/prop object from a short code
function stallProp(code, seed) {
  const [kind, label] = code;
  switch (kind) {
    case 'tea': return teaStall(seed, label);
    case 'cotton': return cottonCandy(seed);
    case 'fruit': return fruitCart(seed);
    case 'books': return bookStall(seed);
    case 'flowers': return flowerStall(seed);
    case 'tent': return stallTent(seed);
    case 'sacks': return sackPile(seed);
    case 'bollard': return bollard();
    case 'cone': return trafficCone();
    default: return teaStall(seed, 'চা');
  }
}

export function buildScene(level, k) {
  const id = level.id;
  const L = LOOK[id];
  const r = artRng(id.length * 131 + id.charCodeAt(0));
  const rows = level.rows;
  const N = rows.length;
  const WH = worldHeight(level);
  const out = { props: [], overheads: [], lights: [], glows: [], walkers: [], gates: [], waterRows: [], crows: [], fountains: [] };

  // ---- ground canvas at screen resolution (so signboard text is crisp) ----
  const ground = makeCanvas(W * k, WH * k);
  const g = ground.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);
  g.imageSmoothingEnabled = false;

  // rows
  for (let i = 0; i < N; i++) {
    const row = rows[i];
    const y = rowTop(level, i);
    const above = rows[i + 1];
    if (row.type === 'road') {
      let line = null;
      if (above && above.type === 'road') line = above.dir === row.dir ? 'dash' : 'double';
      const below = rows[i - 1];
      paintRoad(g, y, { ...L, sky1: '#7e8a98' }, r, { line, wet: L.wet, gutterBottom: below && below.type !== 'road', gutterTop: above && above.type !== 'road' });
      // a (widely ignored) zebra crossing on the busy market levels
      if (['newmarket', 'farmgate', 'motijheel', 'gulshan'].includes(id)) zebraOnRow(g, 404, 34, y);
    } else if (row.type === 'foot') {
      paintFootpath(g, y, L, r, {});
    } else if (row.type === 'goal') {
      paintFootpath(g, y, L, r, { kerbFace: true });
    } else if (row.type === 'median') {
      paintMedianBase(g, y, L, r, row.kind);
    } else if (row.type === 'rail') {
      paintRail(g, y, L, r);
    } else if (row.type === 'water') {
      paintWaterRow(g, y, L, r);
      out.waterRows.push(i);
      // muddy embankment where water meets land
      if (rows[i - 1] && rows[i - 1].type !== 'water') { rect(g, 0, y + TILE - 4, W, 4, '#6f705f'); rect(g, 0, y + TILE - 4, W, 1, '#8a8a72'); }
      if (above && above.type !== 'water') { rect(g, 0, y, W, 3, rgba('#000000', 0.25)); }
    }
  }

  // near strip below the start footpath: foreground hedge + white spear fence,
  // kept dark and simple so it frames the scene without stealing attention
  const ny = rowTop(level, 0) + TILE;
  rect(g, 0, ny, W, NEAR_H, '#1e2a1c');
  rect(g, 0, ny, W, 2, shade(L.paver, -0.3));
  for (let x = 0; x < W; x += 3) { rect(g, x, ny + 2, 1, 9, '#d8d8d0'); rect(g, x, ny + 1, 1, 1, '#ffffff'); }
  rect(g, 0, ny + 4, W, 1, '#c8c8c0');
  rect(g, 0, ny + 9, W, 1, '#a8a8a0');
  for (let x = -6; x < W + 8; x += 9) {
    const hy = ny + 12 + ((x * 7) % 5);
    circle(g, x, hy, 7, '#2a4a24');
    circle(g, x - 1, hy - 2, 5, '#3a6a30');
    circle(g, x - 2, hy - 4, 2, '#5a8a3a');
  }
  rect(g, 0, ny + 22, W, NEAR_H - 22, '#141c12');

  // emissive layer: lit windows / neon that must stay bright after the night
  // darkness pass (only for the dark levels)
  let emissive = null;
  if (['dusk', 'night'].includes(level.tod)) {
    emissive = makeCanvas(W * k, WH * k);
    out.eg = emissive.getContext('2d');
    out.eg.setTransform(k, 0, 0, k, 0, 0);
    out.eg.imageSmoothingEnabled = false;
  } else {
    // painters can always draw to out.eg; on day levels it's a throwaway 1px canvas
    out.eg = makeCanvas(1, 1).getContext('2d');
  }

  // backdrop (landmark) — sits on the goal footpath's back edge
  const base = rowTop(level, N - 1) + 2;
  LANDMARKS[id](g, base, r, out);
  out.emissive = emissive;
  // Gulshan: neon smeared across the road surface (stays bright at night)
  if (id === 'gulshan') {
    const NEON = ['#ff3d9a', '#28e0ff', '#3dff8a', '#ffd23a', '#f26b1d'];
    for (let i = 0; i < N; i++) {
      if (rows[i].type !== 'road') continue;
      const y = rowTop(level, i);
      for (let k2 = 0; k2 < 7; k2++) {
        out.eg.fillStyle = rgba(NEON[Math.floor(r() * NEON.length)], 0.16);
        out.eg.fillRect(Math.floor(r() * W), y + 6 + Math.floor(r() * 20), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
        out.eg.fillRect(Math.floor(r() * W), y + 4 + Math.floor(r() * 22), 1, 4 + Math.floor(r() * 6));
      }
    }
  }

  // ---- parallax skyline (far layer) ----
  const sky = makeCanvas(W * k, SKY_H * k);
  const sg = sky.getContext('2d');
  sg.setTransform(k, 0, 0, k, 0, 0);
  skyline(sg, id, SKY_H, artRng(id.length * 7));
  out.skylineY = base - SKY_H - 30; // world y where the skyline layer sits at camera 0

  // ---- props on footpaths / medians (depth-sorted with traffic) ----
  const startTop = rowTop(level, 0);
  const goalTop = rowTop(level, N - 1);
  const umbrellas = level.weather === 'rain';
  const addPerson = (x, y, seed) => {
    const p = umbrellas ? umbrellaPerson(seed) : personSprite(seed);
    out.props.push({ ...p, x, y, t: r() * 3 });
  };

  // goal footpath: a row of stalls and people at the back edge
  let si = 0;
  const bridge = level.overhead === 'footbridge';
  for (let x = 30; x < W; x += 100 + Math.floor(r() * 30)) {
    if (bridge && inSpan(x, farStairSpan())) { r(); continue; } // keep the footbridge stairs clear
    const s = stallProp(L.stalls[si++ % L.stalls.length], si * 17 + id.length);
    out.props.push({ ...s, x, y: goalTop + 12 });
    if (r() < 0.8) addPerson(x + 26, goalTop + 14, si * 5 + 1);
  }
  for (let i = 0; i < 4; i++) out.props.push({ ...dogSprite(i + 9), x: 60 + r() * 520, y: goalTop + 26, t: r() * 5, dog: true });
  if (L.trees) for (const x of [12, 628]) out.props.push({ ...treeSprite(x + 3, { w: 40, h: 56 }), x, y: goalTop + 10 });

  // start footpath: lamp posts, a few people and a dog — kept clear of Rupa's spawn column
  for (const x of [40, 600]) { const lp = lampSprite(); out.props.push({ ...lp, x, y: startTop + 8 }); out.lights.push({ x: x - 10, y: startTop + 8 - 46, r: 70, a: 0.8 }, { x: x + 10, y: startTop + 8 - 46, r: 70, a: 0.8 }); }
  for (const x of [90, 150, 470, 540]) { const px = x + r() * 20; if (!(bridge && inSpan(px, nearStairSpan()))) addPerson(px, startTop + 10, x); }
  out.props.push({ ...dogSprite(3), x: 250, y: startTop + 28, t: 0, dog: true });
  out.props.push({ ...stallProp(L.stalls[0], 99), x: 560, y: startTop + 6 });
  // pedestrians strolling along both footpaths
  for (let i = 0; i < 5; i++) {
    const onGoal = i < 3;
    const p = umbrellas ? umbrellaPerson(i * 13 + 5) : personSprite(i * 13 + 5);
    out.walkers.push({ ...p, x: r() * W, y: (onGoal ? goalTop + 22 : startTop + 4), v: (r() < 0.5 ? -1 : 1) * (10 + r() * 10), t: r() * 3 });
  }

  // electricity poles + sagging cable bundles over the start footpath (overhead)
  const wireLayer = makeCanvas(W, 80);
  const wg = wireLayer.getContext('2d');
  wires(wg, 0, 20, 320, 26, 4, 12, 'rgba(20,20,24,0.75)');
  wires(wg, 320, 26, W, 18, 5, 14, 'rgba(20,20,24,0.75)');
  wires(wg, 0, 30, W, 30, 2, 22, 'rgba(20,20,24,0.55)');
  out.overheads.push({ spr: wireLayer, x: 0, y: startTop - 62, alpha: 0.85, thin: true });
  for (const x of [318]) {
    const pc = makeCanvas(14, 84); pole(pc.getContext('2d'), 5, 84, 80);
    out.props.push({ spr: pc, ox: 6, oy: 84, x, y: startTop + 4 });
  }

  // medians
  for (let i = 0; i < N; i++) {
    const row = rows[i];
    if (row.type !== 'median') continue;
    const y = rowTop(level, i);
    const gy = y + TILE - 6; // ground line of the median
    medianProps(row.kind, i, y, gy, out, r, level);
  }

  // overhead structures
  if (level.overhead === 'footbridge') footbridge(level, out);
  if (level.overhead === 'archbridge') {
    // nothing overhead — the arches are in the backdrop
  }

  // crows circling over the backdrop
  for (let i = 0; i < 5; i++) out.crows.push({ x: r() * W, y: base - 120 - r() * 80, v: 20 + r() * 25, ph: r() * 6 });

  return { ground, sky, worldH: WH, ...out };
}

// ---- median dressing ------------------------------------------------------------------

function medianProps(kind, i, y, gy, out, r, level) {
  const P = out.props;
  const lampAt = (x) => {
    const lp = lampSprite({ h: 50 });
    P.push({ ...lp, x, y: gy });
    out.lights.push({ x: x - 10, y: gy - 40, r: 64, a: 0.75 }, { x: x + 10, y: gy - 40, r: 64, a: 0.75 });
    out.glows.push({ x: x - 10, y: gy - 40, r: 22, color: '#ffe0a0', a: 0.35 }, { x: x + 10, y: gy - 40, r: 22, color: '#ffe0a0', a: 0.35 });
  };
  switch (kind) {
    case 'trees':
      for (let x = 20; x < W; x += 34) P.push({ ...bushSprite(x + i), x: x + r() * 8, y: gy - 2 });
      for (const x of [100, 330, 560]) P.push({ ...treeSprite(x + i * 3, { w: 34, h: 44, flame: x === 330 }), x, y: gy - 4, fade: true });
      for (const x of [215, 445]) lampAt(x);
      break;
    case 'railing':
    case 'planter':
      for (let x = 0; x < W; x += 64) P.push({ ...railingSprite(62), x, y: gy - 3 });
      for (const x of [160, 480]) lampAt(x);
      if (kind === 'planter') for (let x = 40; x < W; x += 80) P.push({ ...bushSprite(x), x, y: gy - 2 });
      break;
    case 'flowers':
      for (let x = 60; x < W; x += 150) P.push({ ...flowerStall(x + i), x, y: gy - 2, fade: true });
      for (let x = 120; x < W; x += 150) P.push({ ...personSprite(x * 3), x, y: gy - 2, t: r() * 3 });
      break;
    case 'market':
      for (let x = 40; x < W; x += 120) P.push({ ...stallTent(x + i), x, y: gy - 2, fade: true });
      for (let x = 100; x < W; x += 120) P.push({ ...sackPile(x), x, y: gy - 2 });
      for (let x = 70; x < W; x += 160) P.push({ ...personSprite(x + 7), x, y: gy - 1, t: r() * 3 });
      break;
    case 'lakeside':
      for (let x = 20; x < W; x += 40) P.push({ ...bollard(), x, y: gy - 3 });
      for (const x of [140, 500]) lampAt(x);
      for (let x = 80; x < W; x += 170) P.push({ ...personSprite(x + 11), x, y: gy - 3, t: r() * 3 });
      break;
    case 'gate':
      out.gates.push({ row: i, gy, y });
      for (let x = 60; x < W; x += 160) P.push({ ...personSprite(x + 23), x, y: gy - 3, t: r() * 3 });
      break;
    case 'oldDhaka':
      for (let x = 30; x < W; x += 110) P.push({ ...sackPile(x + 4), x, y: gy - 2 });
      for (let x = 80; x < W; x += 140) P.push({ ...personSprite(x + 31), x, y: gy - 2, t: r() * 3 });
      P.push({ ...teaStall(77, 'বাহারি বিরিয়ানি'), x: 320, y: gy - 2, fade: true });
      break;
    case 'ghat': {
      // pontoon with lifebuoys and waiting passengers
      for (let x = 30; x < W; x += 90) {
        const c = makeCanvas(10, 10), g = c.getContext('2d');
        circle(g, 5, 5, 4, ['#d9442a', '#f2a01f', '#2fa56b', '#2a6fd0'][(x / 90 | 0) % 4]); circle(g, 5, 5, 2, '#8a6a44');
        P.push({ spr: c, ox: 5, oy: 10, x, y: gy - 4 });
      }
      for (let x = 60; x < W; x += 120) P.push({ ...personSprite(x + 41), x, y: gy - 3, t: r() * 3 });
      const s = signboard('লঞ্চ টার্মিনাল', { bg: '#1e5bb8', fg: '#fff', size: 9, padX: 3 });
      P.push({ spr: makeCanvas(2, 30), ox: 1, oy: 30, x: 470, y: gy - 3, sign: s, signDx: -s.logicalW / 2, signDy: -40 });
      break;
    }
    case 'metro':
      metroViaduct(i, gy, out, level);
      break;
    case 'footbridge':
      for (const x of [110, 480]) lampAt(x);
      break;
    case 'flyover':
      flyover(i, gy, out);
      break;
    case 'circle':
      out.fountains.push({ x: 320, y: gy });
      P.push({ ...fountainSprite(), x: 320, y: gy + 1, fade: true });
      for (let x = 30; x < W; x += 60) if (Math.abs(x - 320) > 70) P.push({ ...bushSprite(x), x, y: gy - 2 });
      for (const x of [140, 500]) lampAt(x);
      break;
    case 'shapla':
      P.push({ ...shaplaSprite(), x: 320, y: gy + 2, fade: true });
      out.fountains.push({ x: 320, y: gy - 6, shapla: true });
      for (const x of [120, 520]) lampAt(x);
      break;
    default:
      break;
  }
}

// ---- landmark props that live on medians ------------------------------------------------

// Shapla Chattar: a single white water-lily bloom (pointed petals fanning up
// in two layers, dark-green sepals spreading low) on a blue wavy wall with a
// yellow scalloped top and a little mural frieze.
function petal(g, bx, by, ang, len, wid, fill, edge) {
  for (let t = 0; t <= 1; t += 0.5 / len) {
    const hw = wid * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - t * 0.35);
    const cx = bx + Math.cos(ang) * len * t, cy = by + Math.sin(ang) * len * t;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let k = -hw; k <= hw; k += 0.5) {
      const px = cx + nx * k, py = cy + ny * k;
      g.fillStyle = Math.abs(k) > hw - 1 ? edge : fill;
      g.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
}
function shaplaSprite() {
  const c = makeCanvas(160, 96), g = c.getContext('2d');
  // base wall
  rect(g, 0, 76, 160, 20, '#3fa6d9');
  rect(g, 0, 86, 160, 1, '#2f86b9');
  for (let x = 0; x < 160; x += 10) circle(g, x + 5, 76, 5, '#f3b63a');
  rect(g, 0, 76, 160, 2, '#e98a1b');
  for (let x = 6; x < 160; x += 26) { rect(g, x, 88, 12, 3, '#8a4a20'); rect(g, x + 5, 83, 1, 5, '#f5f5f0'); rect(g, x + 16, 86, 4, 5, '#c8642a'); }
  const bx = 80, by = 58;
  // sepals: dark green, pointed, spreading low and outward
  for (const a of [-0.15, -0.55, Math.PI + 0.15, Math.PI + 0.55, Math.PI / 2 + 0.6, Math.PI / 2 - 0.6]) petal(g, bx, by + 4, a, 34, 6, '#1e4a32', '#2e6a46');
  rect(g, bx - 3, by, 6, 20, '#1e4a32');
  // outer petals
  for (let i = 0; i < 7; i++) { const a = -Math.PI + 0.3 + (i / 6) * (Math.PI - 0.6); petal(g, bx, by, a, 36, 7, '#e8ecee', '#b8c0c6'); }
  // inner petals (taller, brighter)
  for (let i = 0; i < 5; i++) { const a = -Math.PI + 0.75 + (i / 4) * (Math.PI - 1.5); petal(g, bx, by, a, 42, 6, '#ffffff', '#cfd3d6'); }
  circle(g, bx, by - 6, 5, '#f2b31c'); circle(g, bx - 1, by - 7, 2, '#ffd86a');
  return { spr: c, ox: 80, oy: 96 };
}

function fountainSprite() {
  const c = makeCanvas(120, 50), g = c.getContext('2d');
  rect(g, 0, 34, 120, 16, '#c8c8d0'); rect(g, 0, 34, 120, 3, '#e8e8f0');
  rect(g, 4, 37, 112, 9, '#2a6aa8');
  rect(g, 40, 22, 40, 14, '#d8d8e0'); rect(g, 44, 25, 32, 8, '#3a8ac8');
  rect(g, 56, 6, 8, 18, '#e8e8f0'); circle(g, 60, 6, 6, '#e8e8f0');
  for (let x = 10; x < 110; x += 8) rect(g, x, 40, 3, 1, '#9fd8ff');
  return { spr: c, ox: 60, oy: 50 };
}

// MRT-6 viaduct: box-girder deck on hammer-head piers, metro trains glide across
function metroViaduct(i, gy, out, level) {
  const H = 96;
  const deckY = gy - H; // top of the deck front face
  const deck = makeCanvas(W, 34), g = deck.getContext('2d');
  rect(g, 0, 0, W, 10, '#8a8a84');            // track bed top face
  rect(g, 0, 3, W, 1, '#6b4430'); rect(g, 0, 7, W, 1, '#6b4430');
  for (let x = 0; x < W; x += 4) rect(g, x, 0, 1, 2, '#d8d8d6'); // railing
  rect(g, 0, 10, W, 16, '#b4b2aa');           // deck front face
  rect(g, 0, 10, W, 2, '#d0cec6');
  rect(g, 0, 24, W, 4, '#6e6e6a');            // underside shadow
  for (let x = 0; x < W; x += 80) rect(g, x, 12, 1, 12, '#9a9a94');
  // catenary masts
  for (let x = 40; x < W; x += 80) { rect(g, x, -0, 1, 2, '#c8ccd0'); }
  out.overheads.push({ spr: deck, x: 0, y: deckY - 10, fadeRows: true, metroDeck: true, trainY: deckY - 10 });
  // piers on the median
  for (const x of [100, 320, 540]) {
    const c = makeCanvas(40, H + 4), pg = c.getContext('2d');
    rect(pg, 0, 0, 40, 8, '#a09e98'); rect(pg, 4, 8, 32, 4, '#8a8882');
    rect(pg, 13, 12, 14, H - 8, '#a09e98'); rect(pg, 13, 12, 3, H - 8, '#c0beb8'); rect(pg, 24, 12, 3, H - 8, '#7a7872');
    // hoarding on pier base
    rect(pg, 11, H - 30, 18, 14, '#1f8f58'); rect(pg, 13, H - 28, 14, 10, '#f0f0ec');
    out.props.push({ spr: c, ox: 20, oy: H + 4, x, y: gy + 2, fade: true });
  }
}

// Mohakhali flyover: thick deck on wide-capped pillars with folk-art murals
function flyover(i, gy, out) {
  const H = 84;
  const deckY = gy - H;
  const deck = makeCanvas(W, 44), g = deck.getContext('2d');
  rect(g, 0, 0, W, 18, '#6a6862');   // road surface on top
  for (let x = 0; x < W; x += 30) rect(g, x, 8, 14, 1, '#d8d4c8');
  rect(g, 0, 0, W, 2, '#a8a69e');    // parapet
  rect(g, 0, 18, W, 20, '#8c8a84');  // fascia
  rect(g, 0, 18, W, 2, '#b0aea6');
  // mural band on the fascia: birds, lotus, colour blocks
  const M = ['#e8782a', '#f2c417', '#1e9e8e', '#d7263d', '#7b3fa0', '#f3eedc'];
  for (let x = 0; x < W; x += 12) { rect(g, x, 22, 10, 12, M[(x / 12) % M.length]); if ((x / 12) % 3 === 0) circle(g, x + 5, 28, 3, '#f3eedc'); }
  rect(g, 0, 38, W, 6, '#55534f');
  out.overheads.push({ spr: deck, x: 0, y: deckY - 18, fadeRows: true, flyover: true, carY: deckY - 12 });
  for (const x of [90, 330, 570]) {
    const c = makeCanvas(48, H + 4), pg = c.getContext('2d');
    rect(pg, 0, 0, 48, 8, '#8c8a84');
    rect(pg, 14, 8, 20, H - 4, '#9a9890'); rect(pg, 14, 8, 3, H - 4, '#b0aea6');
    for (let y = 16; y < H - 6; y += 10) rect(pg, 16, y, 16, 6, M[(y / 10) % M.length]);
    out.props.push({ spr: c, ox: 24, oy: H + 4, x, y: gy + 2, fade: true });
  }
}

// ---- Farmgate foot-over-bridge -----------------------------------------------------------
// A slim open walkway crossing the road north–south, from the start footpath to
// the goal footpath. In the ¾ view, height lifts things straight up the screen,
// so the deck is drawn FB.H px above its ground footprint. What sells "elevated":
//   * a soft shadow cast to the side on the road, with open road between it and the deck
//   * slim portal pillars (outside the deck edges, so they stay visible) on the medians
//   * stair flights with a mid landing running along each footpath
// The deck itself is drawn in render.js (drawFootbridge) after the traffic, which is
// then re-drawn faintly through it so nothing dangerous is ever hidden.
export const FB = { x: 190, w: 38, H: 66, side: 6, shadowDx: 52, run: 98 };

// x-ranges on each footpath the stairs occupy (props there are skipped)
const nearStairSpan = () => [FB.x - FB.run - 12, FB.x + 12];
const farStairSpan = () => [FB.x + FB.w + FB.side - 12, FB.x + FB.w + FB.side + FB.run + 12];
const inSpan = (x, [a, b]) => x > a && x < b;

function footbridge(level, out) {
  const N = level.rows.length;
  const { x: x0, w, H, side } = FB;
  const gFar = rowTop(level, N - 1) + 4;   // ground y of the deck's far (north) end
  const gNear = rowTop(level, 0) + 14;     // ground y of the deck's near (south) end
  const len = gNear - gFar;
  const D = 12;                            // depth of the stair-head platforms / stairs
  const r = artRng(404);

  // -- deck sprite: walking surface + railings + steel side girder + near-end face --
  const FRONT = 10;
  const deck = makeCanvas(w + side, len + FRONT);
  const g = deck.getContext('2d');
  // wet concrete slab in precast panels (alternating tones + joints read as a walkway)
  for (let y = 0; y < len; y += 12) {
    rect(g, 0, y, w, 12, (y / 12) % 2 ? '#a3a6a8' : '#9a9da0');
    rect(g, 4, y, w - 8, 1, '#7a7d80');
  }
  for (let y = 0; y < len; y += 2) if (r() < 0.5) rect(g, 4 + Math.floor(r() * (w - 8)), y, 1 + Math.floor(r() * 3), 1, '#83868b');
  // wet sheen: a pale sky reflection streaking down the middle, plus puddles
  for (let y = 0; y < len; y++) {
    const s = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.023) * 0.5;
    if (s > -0.2) rect(g, 13 + Math.round(s * 3), y, 4 + Math.round(s * 3), 1, s > 0.55 ? '#b9c6d0' : '#a2acb5');
  }
  for (let i = 0; i < 9; i++) {
    const py = 10 + Math.floor(r() * (len - 30)), px = 6 + Math.floor(r() * (w - 20));
    rect(g, px, py, 8 + Math.floor(r() * 5), 2, '#6f7c88'); rect(g, px + 2, py, 4, 1, '#c8d4de');
  }
  // expansion joints every ~1 tile
  for (let y = 18; y < len; y += 34) { rect(g, 3, y, w - 6, 1, '#5e6064'); rect(g, 3, y + 1, w - 6, 1, '#a6a8ab'); }
  // grime: dark water stains along both kerbs
  rect(g, 3, 0, 2, len, '#6c6e6c'); rect(g, w - 5, 0, 2, len, '#6c6e6c');
  for (let y = 0; y < len; y += 3) if (r() < 0.4) rect(g, 5, y, 1, 2 + Math.floor(r() * 4), '#76746c');
  // railings on both edges: dark outline, bright top rail, posts every 6 px
  for (const [rx, out] of [[0, 0], [w - 4, 3]]) {
    rect(g, rx, 0, 4, len, '#167a48');                    // green-painted steel rail band
    rect(g, rx + (out ? 2 : 1), 0, 1, len, '#f2f4ee');     // bright top rail
    rect(g, rx + out, 0, 1, len, '#0c2a1c');               // dark outer edge
    for (let y = 2; y < len; y += 5) { rect(g, rx, y, 4, 1, '#0e5a34'); rect(g, rx + (out ? 2 : 1), y, 1, 1, '#ffffff'); }
    for (let y = 0; y < len; y += 7) if (r() < 0.35) rect(g, rx + 1, y, 2, 2, '#8a4a28'); // rust spots
  }
  rect(g, 4, 0, 1, len, '#55585c'); rect(g, w - 5, 0, 1, len, '#55585c'); // rail shadow on the deck
  // the near stair joins the west rail, the far stair the east rail — leave gaps
  rect(g, 0, len - D, 5, D, '#8d9094'); rect(g, w - 5, 0, 5, D, '#8d9094');
  // east side girder (we see a sliver of it): painted steel, rust blooms
  rect(g, w, 0, side, len, '#b4562f');
  for (let y = 0; y < len; y += 3) rect(g, w + 1, y, side - 2, 1, '#9a4626');
  rect(g, w, 0, 1, len, '#e0dcd2');
  rect(g, w + side - 1, 0, 1, len, '#3a1c10');
  for (let y = 0; y < len; y += 2) if (r() < 0.22) rect(g, w + 1 + Math.floor(r() * 3), y, 2, 1 + Math.floor(r() * 3), r() < 0.5 ? '#8a4a28' : '#a8602e');
  // near-end face (the end girder facing us): concrete, rust drips, highlight edge
  rect(g, 0, len, w + side, FRONT, '#8a8a84');
  rect(g, 0, len, w + side, 1, '#c4c4bc');
  rect(g, 0, len + FRONT - 2, w + side, 2, '#4e4e4a');
  for (let x = 2; x < w + side; x += 3 + Math.floor(r() * 4)) rect(g, x, len + 1, 1, 2 + Math.floor(r() * 4), '#8a4a28');

  // -- soft shadow: the deck's footprint, cast sideways onto the road --
  const shadow = makeCanvas(w + side + 8, len + 8);
  const sg = shadow.getContext('2d');
  for (let i = 0; i < 5; i++) { sg.fillStyle = 'rgba(4,6,18,0.13)'; sg.fillRect(i, i, w + side + 8 - 2 * i, len + 8 - 2 * i); }

  // -- tiny pedestrians with umbrellas, two frames each (walking animation) --
  const walkerSprites = [0, 1, 2, 3, 4].map((i) => {
    const umb = ['#d8282a', '#1a1a1a', '#2a6ad8', '#2a9a4a', '#e8b020'][i];
    const shirt = ['#f0f0f0', '#e8c23a', '#d23a2a', '#3a4a8a', '#f06292'][i];
    return [0, 1].map((f) => {
      const c = makeCanvas(11, 16), wg = c.getContext('2d');
      rect(wg, 3, 8, 5, 5, shirt); rect(wg, 3, 8, 1, 5, shade(shirt, -0.3));
      rect(wg, 4, 13, 1, 3 - f, '#2a1a10'); rect(wg, 6, 13, 1, 2 + f, '#2a1a10');
      rect(wg, 4, 5, 3, 3, '#c08a5a');                   // face under the umbrella
      rect(wg, 5, 3, 1, 5, '#222');                      // umbrella handle
      rect(wg, 1, 1, 9, 3, umb); rect(wg, 0, 3, 11, 2, umb); rect(wg, 3, 0, 5, 1, shade(umb, 0.35));
      rect(wg, 0, 4, 11, 1, shade(umb, -0.35));
      return c;
    });
  });
  const walkers = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    lane: i % 2 ? 1 : -1,                              // keep left: two directions
    off: r() * len, v: 10 + r() * 6, spr: walkerSprites[i % 5], ph: r() * 2,
  }));

  // -- a hoarding cantilevered off the east railing, hanging over the median
  //    (so it never covers a traffic lane in screen space) --
  const mi = level.rows.findIndex((row) => row.kind === 'footbridge');
  const sign = signboard('টাকা পে', { bg: '#e2136e', fg: '#ffffff', size: 10, padX: 6, sub: 'মোবাইল রিচার্জ', subSize: 5, stripe: '#ffd23a' });
  const hoard = { sign, x: x0 + w + side + 8, y: rowTop(level, mi) + 2 };

  out.footbridge = { x0, w, side, H, gFar, gNear, len, deck, shadow, walkers, hoard, front: FRONT };

  // -- portal pillars: on each median, and under both stair-head platforms --
  const pillar = (gy, withStain) => {
    const pw = w + side + 16;
    const c = makeCanvas(pw, H + 4), pg = c.getContext('2d');
    rect(pg, 0, 0, pw, 4, '#7a7a74'); rect(pg, 0, 0, pw, 1, '#c4c4bc'); rect(pg, 0, 3, pw, 1, '#4a4a46'); // cross-beam under the deck
    for (const px of [1, pw - 7]) {
      rect(pg, px, 4, 6, H, '#a4a49c'); rect(pg, px, 4, 2, H, '#d0d0c8'); rect(pg, px + 4, 4, 2, H, '#646460');
      if (withStain) for (let y = H - 16; y < H + 4; y += 2) rect(pg, px, y, 6, 1, '#6a4a2e'); // rusty, splashed base
    }
    out.props.push({ spr: c, ox: 8, oy: H + 4, x: x0, y: gy, fade: true });
  };
  for (let i = 0; i < N; i++) if (level.rows[i].type === 'median') pillar(rowTop(level, i) + 24, true);
  pillar(gNear, false);
  pillar(gFar + D, false);

  // -- stair flights with a landing; near one runs west, far one runs east --
  const plaque = signboard('ফুটওভার ব্রিজ', { bg: '#1b7a4a', fg: '#ffffff', size: 6, padX: 3, border: '#e9e9e4' });
  const near = stairSprite(H, D, FB.run, r);
  out.props.push({ spr: near, ox: FB.run, oy: near.height, x: x0, y: gNear, fade: true, sign: plaque, signDx: -40, signDy: -45 });
  out.props.push({ spr: mirror(near), ox: 0, oy: near.height, x: x0 + w + side, y: gFar + D, fade: true });
}

// A straight stair seen from the front: rises left → right from the ground to
// height H with a landing halfway. Its front stringer shows the step zig-zag,
// the treads show as a stepped ribbon behind it, railings on both sides.
function stairSprite(H, D, RUN, r) {
  const RAIL = 10;
  const c = makeCanvas(RUN, H + D + RAIL + 2), g = c.getContext('2d');
  const base = c.height - 1;                 // ground line at the stair's front edge
  const half = H / 2, FL = (RUN - 10) / 2;   // flight length (px); 10 px landing between
  const steps = Math.round(half / 3);
  const stepW = FL / steps;
  const h = (x) => (x < FL ? Math.min(half, (Math.floor(x / stepW) + 1) * 3)
    : x < FL + 10 ? half : Math.min(H, half + (Math.floor((x - FL - 10) / stepW) + 1) * 3));
  const hr = (x) => (x < FL ? (x / FL) * half : x < FL + 10 ? half : half + ((x - FL - 10) / FL) * half); // smooth handrail line
  // landing post (mid depth)
  rect(g, FL + 3, base - half - D / 2, 3, half + D / 2, '#a8a8a0'); rect(g, FL + 3, base - half - D / 2, 1, half + D / 2, '#d0d0c8');
  rect(g, FL + 3, base - 6, 3, 6, '#7a5a3a');
  // back railing (dim)
  for (let x = 0; x < RUN; x++) {
    rect(g, x, Math.round(base - D - hr(x) - RAIL), 1, 1, '#9a9e9c');
    if (x % 4 === 0) rect(g, x, Math.round(base - D - hr(x) - RAIL), 1, Math.round(hr(x) + RAIL - h(x)) + 1, '#7c807e');
  }
  // treads: lit stepped ribbon, nosing highlighted, wet sheen
  for (let x = 0; x < RUN; x++) {
    const y = base - h(x) - D;
    const nosing = h(x) !== h(x - 1);
    rect(g, x, y, 1, D, nosing ? '#c4c0b8' : '#9c9890');
    rect(g, x, y, 1, 1, '#6a6862');
    if (!nosing && r() < 0.25) rect(g, x, y + 2 + Math.floor(r() * (D - 4)), 1, 2, '#b4bec8');
  }
  // front stringer: zig-zag top, smooth underside, painted steel with rust
  for (let x = 0; x < RUN; x++) {
    const top = base - h(x), bot = Math.round(base - hr(x) + 5);
    rect(g, x, top, 1, Math.max(2, bot - top), '#4d6a60');
    rect(g, x, top, 1, 1, '#8fb0a2');
    rect(g, x, Math.max(top + 1, bot - 1), 1, 1, '#24302c');
    if (r() < 0.15) rect(g, x, top + 1 + Math.floor(r() * 3), 1, 2, '#8a4a28');
  }
  // front railing: balusters every 4 px, mid rail, bright handrail on top
  for (let x = 0; x < RUN; x++) {
    const ry = Math.round(base - hr(x) - RAIL);
    if (x % 4 === 0) rect(g, x, ry, 1, Math.round(hr(x) + RAIL - h(x)), '#b8bcba');
    rect(g, x, Math.round(base - hr(x) - RAIL / 2), 1, 1, '#a8acaa');
    rect(g, x, ry, 1, 1, '#eef2f0'); rect(g, x, ry + 1, 1, 1, '#6a6e6c');
  }
  // concrete plinth where it lands on the footpath
  rect(g, 0, base - 3, 8, 4, '#9a9890'); rect(g, 0, base - 3, 8, 1, '#c4c2ba');
  return c;
}

