// Vehicle type table + procedural pixel-art painters.
// Every vehicle is painted once, facing right, into a small canvas; the
// left-facing copy is a mirror. Several colour variants per type.
//
// Sprite frame: width = length × 32 + 2·PAD, height = SPR_H.
// The wheels touch the ground at y = GROUND. game code places GROUND on the lane.

import { makeCanvas, mirror, rect, shade, circle, wheel, box } from './gfx.js';
import { artRng } from './rng.js';

export const PAD = 4;
export const SPR_H = 64;
export const GROUND = 58;

// speed = base px/s at difficulty 1.0. dmg = HP damage. wrong = how likely this
// type is to drive the wrong way (relative weight). horn = sound class.
export const VEHICLES = {
  bicycle:  { len: 1,   speed: 46,  dmg: 8,   wrong: 2.2, horn: 'bell', hitW: 0.1 },
  rickshaw: { len: 1.5, speed: 40,  dmg: 12,  wrong: 2.0, horn: 'bell', hitW: 0.2 },
  van:      { len: 1.5, speed: 30,  dmg: 12,  wrong: 1.6, horn: 'bell', hitW: 0.2 },
  moto:     { len: 1,   speed: 112, dmg: 18,  wrong: 2.4, horn: 'moto', hitW: 0.3 },
  cng:      { len: 1.5, speed: 72,  dmg: 22,  wrong: 1.6, horn: 'cng', hitW: 0.35 },
  car:      { len: 2,   speed: 94,  dmg: 30,  wrong: 0.8, horn: 'car', hitW: 0.5 },
  leguna:   { len: 2,   speed: 74,  dmg: 35,  wrong: 0.7, horn: 'cng', hitW: 0.55 },
  pickup:   { len: 2,   speed: 78,  dmg: 40,  wrong: 0.5, horn: 'car', hitW: 0.6 },
  microbus: { len: 2.5, speed: 108, dmg: 45,  wrong: 0.5, horn: 'car', hitW: 0.7 },
  bus:      { len: 3.5, speed: 88,  dmg: 65,  wrong: 0.15, horn: 'bus', hitW: 0.9 },
  truck:    { len: 4,   speed: 70,  dmg: 80,  wrong: 0.12, horn: 'truck', hitW: 1 },
  train:    { len: 14,  speed: 520, dmg: 100, wrong: 0, horn: 'truck', hitW: 1 },
  // Water craft — rideable platforms, never damage
  nouka:    { len: 2.5, speed: 34, dmg: 0, wrong: 0, ride: true },
  hyacinth: { len: 2,   speed: 26, dmg: 0, wrong: 0, ride: true },
  watertaxi:{ len: 3,   speed: 44, dmg: 0, wrong: 0, ride: true },
  launch:   { len: 5,   speed: 30, dmg: 0, wrong: 0, ride: true, horn: 'ship' },
};

// ---- small figures ---------------------------------------------------------

const SKIN = ['#8d5a3b', '#a8714a', '#6e4429', '#b98258'];

// A seated or standing person, ~6px wide. (x, y) = top of head.
function person(g, x, y, o = {}) {
  const skin = o.skin || SKIN[0];
  const hair = o.hair || '#1a1414';
  if (o.helmet) { rect(g, x, y - 1, 5, 3, o.helmet); rect(g, x + 1, y - 1, 3, 1, shade(o.helmet, 0.4)); }
  else if (o.cap) { rect(g, x, y, 5, 2, o.cap); }
  else { rect(g, x, y, 5, 2, hair); }
  rect(g, x, y + 2, 5, 3, skin);
  if (!o.helmet && !o.cap) rect(g, x, y + 2, 1, 2, hair);
  rect(g, x + 4, y + 3, 1, 1, '#2a1a12');
  if (o.scarf) rect(g, x - 1, y + 4, 7, 2, o.scarf);
  rect(g, x - 1, y + 5, 7, o.h || 6, o.shirt || '#e8e2d0');
  rect(g, x - 1, y + 5, 1, o.h || 6, shade(o.shirt || '#e8e2d0', -0.25));
}

// ---- painters (all face right; local x=0 is the vehicle's rear) -------------

function paintBicycle(g, v, r) {
  const G = GROUND;
  wheel(g, 6, G - 5, 5); wheel(g, 25, G - 5, 5);
  rect(g, 4, G - 6, 3, 2, '#c9ccd6'); rect(g, 24, G - 6, 3, 2, '#c9ccd6');
  // frame
  rect(g, 7, G - 9, 16, 2, v.frame);
  rect(g, 13, G - 14, 2, 8, v.frame);
  rect(g, 22, G - 15, 2, 9, v.frame);
  rect(g, 20, G - 16, 5, 2, '#2a2a2a'); // handlebar
  rect(g, 11, G - 15, 5, 2, '#3a2a20'); // saddle
  // rider: lungi + shirt
  rect(g, 12, G - 22, 6, 8, v.lungi);
  rect(g, 15, G - 15, 3, 7, v.lungi);
  rect(g, 17, G - 9, 2, 3, SKIN[1]);
  person(g, 12, G - 33, { shirt: v.shirt, skin: v.skin, h: 11, cap: r() < 0.3 ? '#ffffff' : null });
  rect(g, 17, G - 25, 6, 2, v.skin); // arm
  if (v.basket) { rect(g, 25, G - 15, 5, 4, '#b08a4a'); rect(g, 25, G - 15, 5, 1, '#d8b06a'); }
}

function paintRickshaw(g, v, r) {
  const G = GROUND;
  // big rear wheels (passenger) and small front wheel (puller)
  wheel(g, 12, G - 7, 7); rect(g, 11, G - 8, 3, 3, '#d8d8d8');
  for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; rect(g, 12 + Math.round(Math.cos(ang) * 4), G - 7 + Math.round(Math.sin(ang) * 4), 1, 1, '#bbb'); }
  wheel(g, 41, G - 5, 5);
  // chassis + rickshaw-art back panel
  rect(g, 4, G - 16, 26, 4, v.body);
  rect(g, 1, G - 19, 7, 10, v.panel);           // painted rear plate
  rect(g, 2, G - 18, 5, 8, shade(v.panel, 0.25));
  rect(g, 3, G - 16, 3, 3, v.accent);            // flower motif
  rect(g, 4, G - 17, 1, 5, v.accent2);
  rect(g, 2, G - 14, 5, 1, v.accent2);
  // seat
  rect(g, 8, G - 22, 18, 6, v.seat);
  rect(g, 8, G - 22, 18, 2, shade(v.seat, 0.3));
  // the hood: a folded half-dome canopy (open toward the puller), painted in
  // concentric bands with gold sequin edging and bright rosettes
  const cx = 22, cy = G - 18, R = 25;
  for (let x = 0; x < 22; x++) {
    for (let y = G - 46; y < G - 16; y++) {
      const dx = (cx - x) / R, dy = (cy - y) / (R * 1.08);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      let c = v.hood;
      if (d > 0.92) c = '#c9a227';                      // sequin edge
      else if (d > 0.84) c = v.hoodBand;
      else if (d < 0.2) c = shade(v.hood, -0.5);       // inside of the hood
      if (y < G - 40 && d <= 0.9) c = shade(c, 0.25);  // top face catches the light
      rect(g, x, y, 1, 1, c);
    }
  }
  // rosettes on the hood + tassels along the edge
  circle(g, 8, G - 30, 2, v.accent2); rect(g, 8, G - 30, 1, 1, '#ffffff');
  circle(g, 14, G - 38, 2, '#ffffff'); rect(g, 14, G - 38, 1, 1, v.accent);
  for (let i = 0; i < 5; i++) rect(g, 1 + i * 4, G - 17 + (i % 2), 1, 3, [v.accent2, '#ffd23a', '#ff4a8a'][i % 3]);
  rect(g, 21, G - 44, 2, 28, '#2a2a30'); // hood strut
  // passenger (sari / shirt) seated in the shade of the hood
  person(g, 14, G - 32, { shirt: v.pax, skin: v.skin2, h: 9, scarf: v.pax2 });
  // front frame to the puller
  rect(g, 28, G - 12, 14, 2, '#3a3a40');
  rect(g, 38, G - 22, 2, 12, '#3a3a40');
  rect(g, 36, G - 23, 7, 2, '#202024');
  rect(g, 29, G - 21, 6, 2, '#3a2a20'); // saddle
  // puller: vest + lungi, standing on pedals
  rect(g, 29, G - 20, 6, 8, v.lungi);
  rect(g, 32, G - 13, 2, 6, SKIN[2]);
  person(g, 30, G - 31, { shirt: v.vest, skin: SKIN[2], h: 9, cap: r() < 0.4 ? '#f2efe6' : null });
  rect(g, 34, G - 24, 5, 2, SKIN[2]);
}

function paintVan(g, v, r) {
  const G = GROUND;
  wheel(g, 8, G - 5, 5); wheel(g, 26, G - 5, 5); wheel(g, 42, G - 5, 5);
  // flat wooden bed (top + front face)
  box(g, 1, G - 15, 32, 3, 3, '#8a5a32', { top: '#b07a48' });
  for (let i = 3; i < 32; i += 6) rect(g, i, G - 15, 1, 3, '#7a4a28');
  // load
  if (v.load === 'sacks') {
    for (let i = 0; i < 4; i++) { rect(g, 2 + i * 7, G - 22, 7, 7, i % 2 ? '#d9c79a' : '#cbb47e'); rect(g, 2 + i * 7, G - 22, 7, 2, '#efe1b8'); }
    for (let i = 0; i < 3; i++) { rect(g, 5 + i * 7, G - 27, 7, 6, '#e0cfa2'); rect(g, 5 + i * 7, G - 27, 7, 2, '#f5e8c4'); }
  } else if (v.load === 'veg') {
    for (let i = 0; i < 14; i++) { const c = ['#2f8f3a', '#d23b2a', '#e8a32a', '#7a3a8a', '#3fa84a'][i % 5]; circle(g, 4 + (i % 7) * 4, G - 18 - Math.floor(i / 7) * 4, 2, c); }
    rect(g, 2, G - 26, 28, 2, '#5aa84a');
  } else if (v.load === 'bananas') {
    for (let i = 0; i < 5; i++) { rect(g, 2 + i * 6, G - 23, 6, 8, '#e8d23a'); rect(g, 3 + i * 6, G - 23, 1, 8, '#9aa82a'); rect(g, 2 + i * 6, G - 23, 6, 1, '#fff27a'); }
  } else { // gas cylinders / crates
    for (let i = 0; i < 5; i++) { rect(g, 2 + i * 6, G - 25, 5, 10, i % 2 ? '#2a7ad2' : '#d24a2a'); rect(g, 2 + i * 6, G - 25, 5, 2, '#eee'); }
  }
  // puller
  rect(g, 34, G - 12, 10, 2, '#3a3a40');
  rect(g, 41, G - 22, 2, 12, '#3a3a40');
  rect(g, 33, G - 20, 6, 8, v.lungi);
  person(g, 34, G - 31, { shirt: v.vest, skin: SKIN[2], h: 9 });
  rect(g, 38, G - 24, 4, 2, SKIN[2]);
}

function paintMoto(g, v, r) {
  const G = GROUND;
  wheel(g, 6, G - 5, 5); wheel(g, 26, G - 5, 5);
  rect(g, 5, G - 6, 2, 2, '#ccc'); rect(g, 25, G - 6, 2, 2, '#ccc');
  // body / tank
  rect(g, 7, G - 13, 18, 5, v.body);
  rect(g, 15, G - 16, 9, 4, v.body);
  rect(g, 15, G - 16, 9, 1, shade(v.body, 0.45));
  rect(g, 5, G - 12, 6, 3, '#333'); // exhaust
  rect(g, 2, G - 12, 3, 2, '#9a9a9a');
  rect(g, 24, G - 20, 2, 9, '#444'); // fork
  rect(g, 22, G - 21, 6, 2, '#222');
  rect(g, 27, G - 17, 3, 3, '#ffe9a0'); // headlight
  // riders
  const n = v.riders;
  for (let i = n - 1; i >= 0; i--) {
    const px = 15 - i * 5;
    rect(g, px, G - 21, 6, 8, v.pants[i]);
    person(g, px, G - 32, { shirt: v.shirts[i], skin: SKIN[i % 4], h: 9, helmet: i === 0 ? v.helmet : (r() < 0.4 ? '#e8e8e8' : null), scarf: i > 0 && r() < 0.5 ? '#d4307a' : null });
  }
  rect(g, 20, G - 25, 5, 2, SKIN[0]);
}

function paintCng(g, v, r) {
  const G = GROUND;
  // 3 wheels: one front, two rear (we see one)
  wheel(g, 10, G - 5, 5); wheel(g, 40, G - 4, 4);
  // lower body
  rect(g, 2, G - 16, 42, 10, v.body);
  rect(g, 2, G - 16, 42, 1, shade(v.body, 0.35));
  rect(g, 2, G - 8, 42, 2, shade(v.body, -0.35));
  // rounded nose
  rect(g, 40, G - 22, 6, 14, v.body);
  rect(g, 44, G - 18, 3, 8, shade(v.body, -0.15));
  rect(g, 45, G - 14, 2, 3, '#fff2a8'); // headlight
  // canopy roof (black/dark green) with top face
  rect(g, 3, G - 34, 38, 3, shade(v.roof, 0.35));
  rect(g, 2, G - 31, 40, 3, v.roof);
  rect(g, 41, G - 31, 4, 9, v.roof);
  // the famous steel-mesh cage doors
  rect(g, 4, G - 28, 34, 12, 'rgba(20,30,25,0.85)');
  g.fillStyle = '#b8c2bc';
  for (let x = 4; x < 38; x += 3) g.fillRect(x, G - 28, 1, 12);
  for (let y = G - 28; y < G - 16; y += 3) g.fillRect(4, y, 34, 1);
  rect(g, 20, G - 28, 2, 12, '#8a9690');
  // passengers' silhouettes behind the mesh
  rect(g, 8, G - 25, 5, 6, '#e0b080'); rect(g, 13, G - 26, 5, 7, v.pax);
  rect(g, 30, G - 26, 5, 6, SKIN[1]);
  // stripe + plate
  rect(g, 2, G - 13, 42, 2, v.stripe);
  rect(g, 4, G - 11, 7, 3, '#f4f4f4');
}

function paintCar(g, v, r) {
  const G = GROUND;
  const c = v.body;
  wheel(g, 13, G - 5, 5); wheel(g, 51, G - 5, 5);
  // lower body side
  rect(g, 1, G - 16, 62, 10, c);
  rect(g, 1, G - 16, 62, 1, shade(c, 0.45));
  rect(g, 1, G - 8, 62, 2, shade(c, -0.4));
  // hood + trunk top faces
  rect(g, 2, G - 20, 14, 4, shade(c, 0.25));
  rect(g, 46, G - 19, 16, 3, shade(c, 0.25));
  // cabin
  rect(g, 15, G - 29, 32, 13, c);
  rect(g, 17, G - 32, 27, 3, shade(c, 0.3)); // roof top face
  rect(g, 18, G - 27, 12, 8, v.glass);
  rect(g, 32, G - 27, 12, 8, v.glass);
  rect(g, 18, G - 27, 12, 2, shade(v.glass, 0.35));
  rect(g, 32, G - 27, 12, 2, shade(v.glass, 0.35));
  rect(g, 44, G - 27, 3, 8, shade(v.glass, -0.2));
  rect(g, 30, G - 27, 2, 11, shade(c, -0.2));
  // door line + handles
  rect(g, 31, G - 15, 1, 8, shade(c, -0.3));
  rect(g, 24, G - 14, 3, 1, '#ddd'); rect(g, 37, G - 14, 3, 1, '#ddd');
  // lights
  rect(g, 60, G - 15, 3, 3, '#fff6c8'); rect(g, 1, G - 15, 2, 3, '#e02a2a');
  rect(g, 58, G - 10, 5, 2, '#bbb'); rect(g, 1, G - 10, 5, 2, '#bbb');
  if (v.taxi) { rect(g, 1, G - 12, 62, 2, '#f2c21a'); rect(g, 27, G - 35, 8, 3, '#f2c21a'); }
  if (v.scratch) { rect(g, 40, G - 12, 6, 1, shade(c, -0.25)); rect(g, 8, G - 11, 3, 1, '#9a9a9a'); }
}

function paintLeguna(g, v, r) {
  const G = GROUND;
  wheel(g, 12, G - 5, 5); wheel(g, 50, G - 5, 5);
  // cab at front
  rect(g, 42, G - 30, 19, 24, v.body);
  rect(g, 43, G - 33, 17, 3, shade(v.body, 0.3));
  rect(g, 47, G - 28, 11, 8, '#2c3d4e');
  rect(g, 47, G - 28, 11, 2, '#5a7a92');
  rect(g, 58, G - 14, 3, 3, '#fff2a8');
  // covered passenger box with stripes
  rect(g, 2, G - 16, 41, 10, v.body);
  rect(g, 2, G - 34, 40, 3, shade(v.canopy, 0.3));
  rect(g, 1, G - 31, 42, 15, v.canopy);
  rect(g, 4, G - 28, 34, 8, '#2a2420');
  // passengers seated sideways
  for (let i = 0; i < 4; i++) rect(g, 6 + i * 8, G - 27, 5, 6, ['#e8d0a0', '#d0302a', '#2a6ad0', '#f0f0f0'][i]);
  rect(g, 1, G - 18, 42, 2, v.stripe);
  rect(g, 1, G - 10, 42, 2, v.stripe2);
  // conductor hanging off the back step
  rect(g, -1, G - 10, 4, 2, '#555');
  person(g, -1, G - 27, { shirt: '#f0f0f0', skin: SKIN[2], h: 10 });
  rect(g, 0, G - 17, 3, 7, '#304a8a');
}

function paintPickup(g, v, r) {
  const G = GROUND;
  wheel(g, 12, G - 5, 5); wheel(g, 50, G - 5, 5);
  // cab
  rect(g, 40, G - 28, 21, 22, v.body);
  rect(g, 41, G - 31, 18, 3, shade(v.body, 0.3));
  rect(g, 45, G - 26, 13, 8, '#26384a'); rect(g, 45, G - 26, 13, 2, '#5d7c96');
  rect(g, 58, G - 14, 3, 3, '#fff2a8');
  // open bed with tarp-covered load
  rect(g, 1, G - 16, 40, 10, v.body);
  rect(g, 1, G - 16, 40, 1, shade(v.body, 0.4));
  rect(g, 2, G - 26, 37, 10, v.tarp);
  rect(g, 4, G - 30, 33, 4, shade(v.tarp, 0.25));
  for (let x = 6; x < 38; x += 8) rect(g, x, G - 28, 1, 12, shade(v.tarp, -0.35)); // ropes
  rect(g, 1, G - 9, 60, 2, shade(v.body, -0.4));
  rect(g, 1, G - 15, 2, 3, '#e02a2a');
}

function paintMicrobus(g, v, r) {
  const G = GROUND;
  const c = v.body;
  wheel(g, 15, G - 5, 5); wheel(g, 64, G - 5, 5);
  rect(g, 1, G - 34, 77, 28, c);
  rect(g, 3, G - 37, 72, 3, shade(c, 0.3)); // roof top
  rect(g, 77, G - 30, 3, 22, shade(c, -0.12)); // nose
  // windows
  for (let i = 0; i < 4; i++) {
    rect(g, 6 + i * 16, G - 31, 13, 9, v.glass);
    rect(g, 6 + i * 16, G - 31, 13, 2, shade(v.glass, 0.4));
  }
  rect(g, 70, G - 31, 7, 10, v.glass);
  rect(g, 1, G - 9, 79, 3, shade(c, -0.4));
  rect(g, 77, G - 15, 3, 3, '#fff6c8'); rect(g, 1, G - 16, 2, 4, '#e02a2a');
  if (v.ambulance) {
    rect(g, 1, G - 19, 77, 3, '#d2202a');
    rect(g, 34, G - 18, 9, 3, '#ffffff');
    rect(g, 30, G - 16, 3, 8, '#d2202a'); rect(g, 27, G - 13, 9, 3, '#d2202a'); // red cross
    rect(g, 36, G - 40, 12, 3, '#2a5ad8'); rect(g, 42, G - 40, 6, 3, '#e0202a'); // light bar
  } else {
    rect(g, 1, G - 18, 77, 2, v.stripe);
  }
}

function paintBus(g, v, r) {
  const G = GROUND;
  const L = 112;
  const c = v.body;
  const dd = v.double;
  const top = dd ? G - 60 : G - 42;
  wheel(g, 20, G - 6, 6); wheel(g, 30, G - 6, 6); wheel(g, 90, G - 6, 6);
  rect(g, 1, top, L - 3, G - 6 - top, c);
  rect(g, 3, top - 3, L - 8, 3, shade(c, 0.28)); // roof top face
  rect(g, L - 4, top + 4, 3, G - 10 - top, shade(c, -0.15)); // front
  // window rows
  const rows = dd ? [top + 5, top + 23] : [top + 5];
  for (const wy of rows) {
    for (let i = 0; i < 8; i++) {
      const wx = 5 + i * 12;
      rect(g, wx, wy, 10, 10, v.glass);
      rect(g, wx, wy, 10, 2, shade(v.glass, 0.35));
      // heads in the windows
      if (r() < 0.75) rect(g, wx + 2 + Math.floor(r() * 4), wy + 5, 4, 5, ['#1a1414', '#2a1a14', '#f0f0f0', '#d03a2a'][Math.floor(r() * 4)]);
    }
  }
  // livery stripes
  rect(g, 1, G - 24, L - 3, 3, v.stripe);
  rect(g, 1, G - 19, L - 3, 2, v.stripe2);
  // door with a passenger hanging out
  rect(g, 98, top + 5, 9, G - 12 - top, shade(c, -0.35));
  person(g, 101, G - 30, { shirt: '#e8e2d0', skin: SKIN[3], h: 10 });
  rect(g, 100, G - 20, 4, 8, '#3a3a6a');
  // windscreen hint + lights
  rect(g, L - 5, top + 5, 2, 12, v.glass);
  rect(g, L - 5, G - 16, 3, 4, '#fff6c8');
  rect(g, 1, G - 16, 2, 4, '#e02a2a');
  rect(g, 1, G - 9, L - 3, 3, shade(c, -0.45));
  // scrapes and dents — Dhaka buses earn them
  for (let i = 0; i < 9; i++) {
    const sx = 4 + Math.floor(r() * (L - 14));
    const sy = G - 18 + Math.floor(r() * 10);
    rect(g, sx, sy, 3 + Math.floor(r() * 7), 1, r() < 0.5 ? '#c8c2b0' : shade(c, -0.35));
  }
  rect(g, 40 + Math.floor(r() * 30), G - 15, 6, 4, shade(c, -0.2));
  // roof luggage / rack
  if (!dd && r() < 0.5) { rect(g, 20, top - 6, 30, 3, '#5a4a3a'); rect(g, 24, top - 9, 10, 3, '#c8a050'); }
}

function paintTruck(g, v, r) {
  const G = GROUND;
  wheel(g, 18, G - 6, 6); wheel(g, 32, G - 6, 6); wheel(g, 108, G - 6, 6);
  // cab (front, right side) — painted front panel
  rect(g, 98, G - 40, 28, 33, v.cab);
  rect(g, 99, G - 43, 25, 3, shade(v.cab, 0.3));
  rect(g, 104, G - 37, 18, 11, '#24323e');
  rect(g, 104, G - 37, 18, 2, '#5d7c96');
  rect(g, 98, G - 24, 28, 3, v.art1);
  for (let i = 0; i < 5; i++) rect(g, 100 + i * 5, G - 20, 3, 3, i % 2 ? v.art2 : v.art3);
  rect(g, 123, G - 16, 3, 4, '#fff6c8');
  // tall wooden cargo body with folk-art panels
  rect(g, 1, G - 44, 98, 37, v.body);
  rect(g, 2, G - 47, 95, 3, shade(v.body, 0.3));
  // painted panels (flowers / landscape)
  for (let i = 0; i < 4; i++) {
    const px = 5 + i * 23;
    rect(g, px, G - 40, 20, 14, v.art1);
    rect(g, px + 1, G - 39, 18, 6, '#7ac8f0');        // sky
    rect(g, px + 1, G - 33, 18, 6, '#4aa84a');        // field
    circle(g, px + 14, G - 36, 2, '#ffd23a');          // sun
    rect(g, px + 4, G - 35, 3, 4, '#f0f0f0'); rect(g, px + 3, G - 36, 5, 1, '#c84a2a'); // hut
  }
  rect(g, 1, G - 24, 98, 3, v.art2);
  for (let x = 4; x < 96; x += 6) rect(g, x, G - 21, 3, 3, x % 12 ? v.art3 : '#ffffff');
  rect(g, 1, G - 14, 98, 2, shade(v.body, -0.35));
  // load piled high under a tarp
  if (v.loadHigh) {
    rect(g, 3, G - 56, 92, 10, v.tarp);
    rect(g, 8, G - 60, 80, 4, shade(v.tarp, 0.25));
    for (let x = 10; x < 92; x += 12) rect(g, x, G - 58, 1, 12, shade(v.tarp, -0.4));
  }
  rect(g, 1, G - 9, 125, 3, '#2a2a2a');
  rect(g, 1, G - 16, 2, 4, '#e02a2a');
}

// Train: locomotive + coaches painted into one long sprite (~14 tiles)
function paintTrain(g, v, r) {
  const G = GROUND;
  const L = 14 * 32;
  // coaches
  const coachW = 84;
  for (let i = 0; i < 4; i++) {
    const x = 2 + i * (coachW + 4);
    rect(g, x, G - 36, coachW, 29, v.coach);
    rect(g, x + 2, G - 39, coachW - 4, 3, shade(v.coach, 0.25));
    rect(g, x, G - 18, coachW, 3, v.coachStripe);
    for (let w = 0; w < 7; w++) {
      rect(g, x + 4 + w * 11, G - 32, 8, 8, '#20262c');
      // faces at the windows
      if (r() < 0.7) rect(g, x + 6 + w * 11, G - 30, 4, 4, SKIN[Math.floor(r() * 4)]);
      rect(g, x + 4 + w * 11, G - 32, 8, 1, '#888');
    }
    // passengers riding on the roof — a Dhaka classic
    for (let p = 0; p < 6; p++) if (r() < 0.6) {
      const px = x + 4 + Math.floor(r() * (coachW - 10));
      person(g, px, G - 50, { shirt: ['#f0f0f0', '#d23a2a', '#2a7ad2', '#e8c23a'][Math.floor(r() * 4)], skin: SKIN[p % 4], h: 6 });
    }
    wheel(g, x + 12, G - 5, 5); wheel(g, x + 24, G - 5, 5);
    wheel(g, x + coachW - 24, G - 5, 5); wheel(g, x + coachW - 12, G - 5, 5);
    rect(g, x + coachW, G - 24, 4, 3, '#333');
  }
  // locomotive at the front (right)
  const lx = L - 92;
  rect(g, lx, G - 40, 88, 33, v.loco);
  rect(g, lx + 2, G - 43, 82, 3, shade(v.loco, 0.3));
  rect(g, lx, G - 22, 88, 4, v.locoStripe);
  rect(g, lx + 70, G - 37, 14, 10, '#20262c');
  rect(g, lx + 70, G - 37, 14, 2, '#7a9ab0');
  rect(g, lx + 20, G - 36, 30, 8, shade(v.loco, -0.2));
  for (let i = 0; i < 6; i++) rect(g, lx + 22 + i * 5, G - 35, 2, 6, shade(v.loco, -0.4));
  rect(g, lx + 85, G - 18, 3, 4, '#fff6c8');
  wheel(g, lx + 14, G - 5, 5); wheel(g, lx + 28, G - 5, 5); wheel(g, lx + 60, G - 5, 5); wheel(g, lx + 74, G - 5, 5);
  rect(g, 0, G - 9, L, 2, '#222');
}

// ---- water craft -----------------------------------------------------------

function hull(g, x0, len, depth, color, G) {
  // curved wooden hull: rises at both ends
  for (let x = 0; x < len; x++) {
    const e = Math.min(x, len - 1 - x);
    const lift = e < 6 ? Math.round((6 - e) * 0.9) : 0;
    rect(g, x0 + x, G - depth - lift, 1, depth + lift - 2, color);
    rect(g, x0 + x, G - depth - lift, 1, 1, shade(color, 0.4));
  }
}

function paintNouka(g, v, r) {
  const G = GROUND;
  const L = 80;
  hull(g, 0, L, 12, v.hull, G);
  rect(g, 6, G - 12, L - 12, 3, shade(v.hull, 0.3)); // deck top
  for (let x = 8; x < L - 8; x += 7) rect(g, x, G - 12, 1, 3, shade(v.hull, -0.3));
  rect(g, 0, G - 6, L, 2, shade(v.hull, -0.4));
  // bamboo "chhoi" canopy over the middle
  if (v.canopy) {
    rect(g, 24, G - 30, 32, 3, '#d8b878');
    rect(g, 22, G - 27, 36, 15, '#b8904e');
    for (let x = 24; x < 56; x += 4) rect(g, x, G - 27, 1, 15, '#8a6a34');
    rect(g, 22, G - 27, 36, 1, '#e8cc90');
    rect(g, 28, G - 20, 24, 8, '#3a2a18');
  }
  // boatman with long oar at the stern
  person(g, 8, G - 33, { shirt: v.shirt, skin: SKIN[2], h: 10, cap: '#f0ece0' });
  rect(g, 8, G - 23, 6, 8, '#3a5a8a');
  rect(g, 4, G - 30, 1, 22, '#7a5a2a');
  rect(g, 2, G - 9, 4, 3, '#7a5a2a');
}

function paintHyacinth(g, v, r) {
  const G = GROUND;
  const L = 64;
  // floating mat of water hyacinth (rideable!)
  for (let i = 0; i < 70; i++) {
    const x = 2 + Math.floor(r() * (L - 6));
    const y = G - 14 + Math.floor(r() * 9);
    circle(g, x, y, 2 + Math.floor(r() * 2), ['#2f7a2f', '#3f9a38', '#58b048', '#24602a'][Math.floor(r() * 4)]);
  }
  for (let i = 0; i < 9; i++) {
    const x = 5 + Math.floor(r() * (L - 12)), y = G - 18 + Math.floor(r() * 6);
    rect(g, x, y, 3, 2, '#b07ad8'); rect(g, x + 1, y - 1, 1, 1, '#e8c8ff'); rect(g, x + 1, y + 1, 1, 1, '#f2d23a');
  }
  rect(g, 2, G - 6, L - 4, 2, 'rgba(20,50,20,0.6)');
}

function paintWaterTaxi(g, v, r) {
  const G = GROUND;
  const L = 96;
  hull(g, 0, L, 12, v.hull, G);
  rect(g, 4, G - 12, L - 8, 2, v.stripe);
  rect(g, 0, G - 6, L, 2, shade(v.hull, -0.4));
  // canopy with posts and seated passengers
  rect(g, 12, G - 36, 72, 3, shade(v.roof, 0.3));
  rect(g, 10, G - 33, 76, 4, v.roof);
  for (let x = 12; x <= 84; x += 18) rect(g, x, G - 29, 2, 17, '#e8e8e8');
  for (let i = 0; i < 6; i++) person(g, 18 + i * 11, G - 27, { shirt: ['#f0f0f0', '#d23a2a', '#2a7ad2', '#e8c23a', '#7a2a8a', '#2a8a5a'][i], skin: SKIN[i % 4], h: 7, helmet: '#ff7a1a' /* life jacket colour hint */ });
  rect(g, 86, G - 18, 6, 4, '#ffe9a0');
}

function paintLaunch(g, v, r) {
  const G = GROUND;
  const L = 160;
  // big multi-deck river launch
  hull(g, 0, L, 16, v.hull, G);
  rect(g, 4, G - 16, L - 8, 4, v.stripe);
  rect(g, 0, G - 6, L, 2, shade(v.hull, -0.45));
  // lower deck
  rect(g, 10, G - 30, L - 22, 14, v.deck);
  for (let x = 14; x < L - 16; x += 10) rect(g, x, G - 27, 7, 7, '#2a2e3a');
  rect(g, 10, G - 30, L - 22, 1, shade(v.deck, 0.5));
  // upper deck
  rect(g, 22, G - 44, L - 48, 14, v.deck2);
  for (let x = 26; x < L - 30; x += 10) rect(g, x, G - 41, 7, 7, '#2a2e3a');
  rect(g, 20, G - 47, L - 44, 3, shade(v.deck2, 0.4));
  // wheelhouse + funnel + people
  rect(g, L - 52, G - 56, 24, 12, v.stripe);
  rect(g, L - 50, G - 53, 20, 5, '#2a2e3a');
  rect(g, 40, G - 60, 8, 14, '#d82a2a'); rect(g, 40, G - 62, 8, 2, '#222');
  for (let i = 0; i < 10; i++) person(g, 14 + i * 13, G - 40, { shirt: ['#f0f0f0', '#d23a2a', '#2a7ad2', '#e8c23a'][i % 4], skin: SKIN[i % 4], h: 5 });
}

// ---- variant palettes --------------------------------------------------------

const VARIANTS = {
  bicycle: [
    { frame: '#c0282a', shirt: '#f2f2ea', lungi: '#3a5a9a', skin: SKIN[0] },
    { frame: '#2a6ad0', shirt: '#e8c23a', lungi: '#7a3a2a', skin: SKIN[1], basket: true },
    { frame: '#2a2a2a', shirt: '#5ab04a', lungi: '#2a3a5a', skin: SKIN[2] },
  ],
  rickshaw: [
    { body: '#2a2a3a', panel: '#d81b60', accent: '#ffd600', accent2: '#00b0ff', seat: '#1e88e5', hood: '#1a1f4a', hoodBand: '#e0212f', pax: '#f06292', pax2: '#ffeb3b', skin2: SKIN[1], lungi: '#5c6bc0', vest: '#f5f5f5' },
    { body: '#1b3a2a', panel: '#00897b', accent: '#ff4081', accent2: '#ffeb3b', seat: '#e53935', hood: '#c62828', hoodBand: '#f5c518', pax: '#ffffff', pax2: '#7cb342', skin2: SKIN[3], lungi: '#8d6e63', vest: '#ffca28' },
    { body: '#3a1a1a', panel: '#fdd835', accent: '#e53935', accent2: '#43a047', seat: '#8e24aa', hood: '#12a88f', hoodBand: '#f26ba3', pax: '#ab47bc', pax2: '#ff7043', skin2: SKIN[0], lungi: '#455a64', vest: '#ef5350' },
    { body: '#2a2a3a', panel: '#8e24aa', accent: '#ffeb3b', accent2: '#ff5722', seat: '#00acc1', hood: '#2d63c6', hoodBand: '#f5c518', pax: '#26a69a', pax2: '#ffffff', skin2: SKIN[1], lungi: '#283593', vest: '#ffffff' },
  ],
  van: [
    { load: 'sacks', lungi: '#3949ab', vest: '#eeeeee' },
    { load: 'veg', lungi: '#6d4c41', vest: '#ffb300' },
    { load: 'bananas', lungi: '#2e7d32', vest: '#f5f5f5' },
    { load: 'gas', lungi: '#37474f', vest: '#e53935' },
  ],
  moto: [
    { body: '#c62828', helmet: '#212121', riders: 2, shirts: ['#1565c0', '#f06292'], pants: ['#263238', '#ad1457'] },
    { body: '#1a1a1a', helmet: '#e53935', riders: 3, shirts: ['#eeeeee', '#43a047', '#ffca28'], pants: ['#37474f', '#2e7d32', '#6d4c41'] },
    { body: '#1565c0', helmet: '#fafafa', riders: 1, shirts: ['#ff7043'], pants: ['#263238'] },
    { body: '#2e7d32', helmet: '#fdd835', riders: 2, shirts: ['#fdd835', '#ffffff'], pants: ['#3e2723', '#4527a0'] }, // ride-share green
  ],
  cng: [
    { body: '#2e8b3a', roof: '#1f3d26', stripe: '#f2d23a', pax: '#e24a7a' },
    { body: '#33a04a', roof: '#24402a', stripe: '#ffffff', pax: '#3a7ad8' },
    { body: '#2a7a34', roof: '#1a2a1e', stripe: '#d8a02a', pax: '#f0f0f0' },
  ],
  car: [
    { body: '#eceff1', glass: '#2f4a62' },
    { body: '#b0bec5', glass: '#263d52', scratch: true },
    { body: '#212121', glass: '#2e4a66' },
    { body: '#c62828', glass: '#27405a' },
    { body: '#1f1f1f', glass: '#30485e', taxi: true },
    { body: '#1565c0', glass: '#22384c', scratch: true },
  ],
  leguna: [
    { body: '#1e88e5', canopy: '#0d47a1', stripe: '#ffeb3b', stripe2: '#e53935' },
    { body: '#43a047', canopy: '#1b5e20', stripe: '#ffffff', stripe2: '#ffeb3b' },
    { body: '#fdd835', canopy: '#5d4037', stripe: '#e53935', stripe2: '#1e88e5' },
  ],
  pickup: [
    { body: '#e0e0e0', tarp: '#1e6fb8' },
    { body: '#c62828', tarp: '#2e7d32' },
    { body: '#37474f', tarp: '#ef6c00' },
  ],
  microbus: [
    { body: '#eceff1', glass: '#2c4258', stripe: '#90a4ae' },
    { body: '#b0bec5', glass: '#2c4258', stripe: '#546e7a' },
    { body: '#f5f5f5', glass: '#2c4258', stripe: '#c62828' },
    { body: '#8a9096', glass: '#2c4258', stripe: '#cfd8dc' },
    { body: '#f5f5f5', glass: '#2c4258', ambulance: true },
  ],
  bus: [
    { body: '#c62828', glass: '#22303c', stripe: '#fdd835', stripe2: '#ffffff', double: true }, // BRTC double-decker
    { body: '#2e7d32', glass: '#22303c', stripe: '#fdd835', stripe2: '#c62828' },
    { body: '#1565c0', glass: '#22303c', stripe: '#ffffff', stripe2: '#e53935' },
    { body: '#ef6c00', glass: '#22303c', stripe: '#4e342e', stripe2: '#fff59d' },
    { body: '#6a1b9a', glass: '#22303c', stripe: '#ffd600', stripe2: '#00bfa5' },
  ],
  truck: [
    { cab: '#f9a825', body: '#d84315', art1: '#1565c0', art2: '#fdd835', art3: '#43a047', tarp: '#1e6fb8', loadHigh: true },
    { cab: '#c62828', body: '#2e7d32', art1: '#6a1b9a', art2: '#ffeb3b', art3: '#e91e63', tarp: '#fbc02d', loadHigh: true },
    { cab: '#1565c0', body: '#ef6c00', art1: '#c62828', art2: '#00bcd4', art3: '#fdd835', tarp: '#455a64', loadHigh: false },
  ],
  train: [
    { coach: '#2e5d3a', coachStripe: '#e8c23a', loco: '#1f4f8f', locoStripe: '#f2c21a' },
    { coach: '#8a2a1e', coachStripe: '#f0e6c8', loco: '#2a6a8a', locoStripe: '#f2c21a' },
  ],
  nouka: [
    { hull: '#7a4a22', shirt: '#f0f0f0', canopy: true },
    { hull: '#5a3a1a', shirt: '#2a7ad2', canopy: false },
    { hull: '#8a5a2a', shirt: '#d23a2a', canopy: true },
  ],
  hyacinth: [{}, {}],
  watertaxi: [
    { hull: '#f2f2f2', stripe: '#1e88e5', roof: '#f9a825' },
    { hull: '#ffeb3b', stripe: '#c62828', roof: '#1565c0' },
  ],
  launch: [
    { hull: '#1f3f7a', stripe: '#d8282a', deck: '#f2efe6', deck2: '#e8f0f8' },
    { hull: '#7a1f2a', stripe: '#f2c21a', deck: '#f2efe6', deck2: '#fff3d8' },
  ],
};

const PAINTERS = {
  bicycle: paintBicycle, rickshaw: paintRickshaw, van: paintVan, moto: paintMoto, cng: paintCng,
  car: paintCar, leguna: paintLeguna, pickup: paintPickup, microbus: paintMicrobus, bus: paintBus,
  truck: paintTruck, train: paintTrain, nouka: paintNouka, hyacinth: paintHyacinth,
  watertaxi: paintWaterTaxi, launch: paintLaunch,
};

// Dark 1px outline around opaque pixels — makes sprites pop off busy roads.
function outline(c, color = 'rgba(16,10,24,0.9)') {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const src = g.getImageData(0, 0, w, h);
  const out = g.createImageData(w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src.data[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a(x, y) > 0) continue;
    if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) {
      const i = (y * w + x) * 4;
      out.data[i] = 16; out.data[i + 1] = 10; out.data[i + 2] = 24; out.data[i + 3] = 220;
    }
  }
  const tmp = makeCanvas(w, h);
  tmp.getContext('2d').putImageData(out, 0, 0);
  g.globalCompositeOperation = 'destination-over';
  g.drawImage(tmp, 0, 0);
  g.globalCompositeOperation = 'source-over';
}

let SPRITES = null;

// Build every vehicle sprite once. Returns { type: [ { r, l } per variant ] }
export function buildVehicleSprites() {
  if (SPRITES) return SPRITES;
  SPRITES = {};
  for (const type in PAINTERS) {
    const info = VEHICLES[type];
    const w = Math.round(info.len * 32) + PAD * 2;
    SPRITES[type] = VARIANTS[type].map((v, i) => {
      const c = makeCanvas(w, SPR_H);
      const g = c.getContext('2d');
      g.translate(PAD, 0);
      PAINTERS[type](g, v, artRng(i * 31 + type.length * 7));
      outline(c);
      return { r: c, l: mirror(c), ambulance: !!v.ambulance };
    });
  }
  return SPRITES;
}

export function variantCount(type) { return VARIANTS[type].length; }
