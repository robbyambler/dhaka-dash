// Draws one frame: sky → parallax skyline → painted ground → shadows →
// depth-sorted props / traffic / Rupa → overhead structures → weather and
// lighting → HUD. Positions are interpolated between simulation steps.

import { W, H, TILE } from './config.js';
import { G, playerWorldY } from './game.js';
import { buildScene, rowTop, BACKDROP_H, FB } from './scenery/index.js';
import { buildVehicleSprites, PAD, GROUND } from './vehicles.js';
import { rupaSprites } from './player.js';
import { pickupSprites, PICKUP_COLORS } from './pickups.js';
import { drawParticles, drawSplashes, drawRain, drawFog, drawLighting, drawTint, drawVignette, drawFlash } from './fx.js';
import { crowFrames } from './scenery/common.js';
import { makeCanvas, rect, rgba, mix } from './gfx.js';
import { drawHud } from './hud.js';

let scene = null, sceneKey = '';
let shadowSpr = null;
let crows = null;
let metroTrain = null, flyCars = null, sunSpr = null, skyGradCache = null;

const lerp = (a, b, t) => a + (b - a) * t;

function getScene(k) {
  const key = `${G.level.id}@${k}`;
  if (key !== sceneKey) { scene = buildScene(G.level, k); sceneKey = key; }
  return scene;
}

// Soft ellipse used for every drop shadow (stretched per object)
function shadowSprite() {
  if (shadowSpr) return shadowSpr;
  shadowSpr = makeCanvas(64, 16);
  const g = shadowSpr.getContext('2d');
  for (let y = 0; y < 16; y++) {
    const dy = (y - 7.5) / 8;
    const w = Math.round(32 * Math.sqrt(Math.max(0, 1 - dy * dy)));
    g.fillStyle = 'rgba(12,8,24,0.42)';
    g.fillRect(32 - w, y, w * 2, 1);
  }
  return shadowSpr;
}

function metroSprite() {
  if (metroTrain) return metroTrain;
  // MRT-6: white-pearl body, apple-green window band, darker green stripe
  metroTrain = makeCanvas(440, 22);
  const g = metroTrain.getContext('2d');
  for (let c = 0; c < 6; c++) {
    const x = c * 73;
    rect(g, x, 2, 71, 18, '#f0f0ec');
    rect(g, x, 0, 71, 3, '#d8d8d4');
    rect(g, x, 5, 71, 6, '#1baa59');
    rect(g, x, 15, 71, 2, '#0e7a45');
    for (let w = 0; w < 6; w++) rect(g, x + 4 + w * 11, 6, 8, 4, '#1a222b');
    rect(g, x, 18, 71, 2, '#b9bec2');
  }
  rect(g, 432, 4, 8, 12, '#1a222b'); rect(g, 434, 6, 5, 2, '#ffb000');
  return metroTrain;
}

function flyoverCars() {
  if (flyCars) return flyCars;
  flyCars = [0, 1, 2, 3].map((i) => {
    const c = makeCanvas(30, 10), g = c.getContext('2d');
    const col = ['#e9e9e6', '#c8322b', '#bfc2c4', '#2a6fce'][i];
    rect(g, 0, 3, 30, 6, col); rect(g, 6, 0, 16, 4, col); rect(g, 8, 1, 12, 2, '#2a3a4a');
    return c;
  });
  return flyCars;
}

// ---------------------------------------------------------------------------------------

export function render(ctx, k, alpha) {
  if (!G.level) return;
  const sc = getScene(k);
  const tod = G.tod;
  const fx = G.fx;
  const now = performance.now() / 1000;

  // camera (interpolated, snapped to the device pixel grid)
  let cam = lerp(G.prevCam, G.cam, alpha) + fx.shakeY;
  cam = Math.round(cam * k) / k;
  const camX = Math.round(fx.shakeX * k) / k;

  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // 1. sky
  if (!skyGradCache || skyGradCache.tod !== tod) {
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, tod.sky[0]);
    sg.addColorStop(1, tod.sky[1]);
    skyGradCache = { tod, grad: sg };
  }
  ctx.fillStyle = skyGradCache.grad;
  ctx.fillRect(0, 0, W, H);
  if (tod.sun) {
    const sy = sc.skylineY + 40 - cam * 0.5;
    const sx = G.level.tod === 'golden' || G.level.tod === 'sunset' ? 520 : G.level.tod === 'dusk' ? 90 : 470;
    if (!sunSpr || sunSpr.col !== tod.sun) {
      sunSpr = makeCanvas(140, 140); sunSpr.col = tod.sun;
      const sg = sunSpr.getContext('2d');
      const grd = sg.createRadialGradient(70, 70, 0, 70, 70, 70);
      grd.addColorStop(0, rgba(tod.sun, 0.9)); grd.addColorStop(0.18, rgba(tod.sun, 0.75)); grd.addColorStop(1, rgba(tod.sun, 0));
      sg.fillStyle = grd; sg.fillRect(0, 0, 140, 140);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sunSpr, sx - 70, sy - 70);
    ctx.imageSmoothingEnabled = false;
  } else if (G.level.tod === 'night') {
    ctx.fillStyle = '#f2ecd8';
    const my = sc.skylineY + 30 - cam * 0.5;
    ctx.beginPath(); ctx.arc(540, my, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tod.sky[0];
    ctx.beginPath(); ctx.arc(546, my - 3, 10, 0, Math.PI * 2); ctx.fill();
  }

  // 2. parallax skyline (moves slower than the ground)
  const skyY = sc.skylineY - cam * 0.55;
  if (skyY + 200 > 0) ctx.drawImage(sc.sky, camX, skyY, W, 200);

  // 3. painted ground (1:1 copy of the visible slice)
  const srcY = Math.max(0, Math.round(cam * k));
  const visH = Math.min(H * k, sc.ground.height - srcY);
  ctx.drawImage(sc.ground, 0, srcY, W * k, visH, camX, (srcY / k) - cam, W, visH / k);

  ctx.save();
  ctx.translate(camX, -cam);
  const viewTop = cam - 80, viewBot = cam + H + 80;

  // 4. animated water shimmer
  for (const ri of sc.waterRows) {
    const y = rowTop(G.level, ri);
    if (y < viewTop || y > viewBot) continue;
    const lane = G.lanes[ri];
    const off = (now * 24 * lane.dir) % 40;
    ctx.fillStyle = 'rgba(220,240,255,0.18)';
    for (let x = -40; x < W + 40; x += 40) {
      ctx.fillRect(Math.round(x + off), y + 8 + ((x / 40) % 2) * 10, 14, 1);
      ctx.fillRect(Math.round(x + off + 20), y + 20, 8, 1);
    }
  }

  // 5. collect drawables
  const items = [];
  const sprites = buildVehicleSprites();
  const shadow = shadowSprite();
  const [sdx, sdy, sstretch] = tod.shadow;

  for (const lane of G.lanes) {
    if (!lane) continue;
    const top = rowTop(G.level, lane.row);
    if (top < viewTop - 40 || top > viewBot) continue;
    const ground = top + 29;
    for (const v of lane.vehicles) {
      if (v.warnT > 0) continue;
      const x = lerp(v.prevX, v.x, alpha);
      if (x > W + 10 || x + v.w < -10) continue;
      const sw = lerp(v.prevSwerve ?? v.swerve, v.swerve, alpha);
      const vs = sprites[v.type][v.variant % sprites[v.type].length];
      const spr = v.dir > 0 ? vs.r : vs.l;
      const bob = v.info.ride ? Math.sin(now * 2 + v.bob) * 1 : 0;
      items.push({ sortY: ground + sw + (v.info.ride ? -8 : 0), kind: 'veh', v, x, y: ground + sw + bob, spr });
    }
  }
  for (const p of sc.props) {
    if (p.y < viewTop || p.y - 120 > viewBot) continue;
    items.push({ sortY: p.y, kind: 'prop', p });
  }
  for (const wk of sc.walkers) {
    if (!G.paused) { wk.x += wk.v / 60; if (wk.x < -20) wk.x = W + 20; if (wk.x > W + 20) wk.x = -20; }
    items.push({ sortY: wk.y, kind: 'walker', p: wk });
  }
  for (const pk of G.pickups) {
    items.push({ sortY: rowTop(G.level, pk.row) + 20, kind: 'pickup', pk });
  }
  const p = G.player;
  const px = lerp(p.pvx ?? p.x, p.x, alpha);
  const py = playerWorldY(alpha);
  items.push({ sortY: py + 0.5, kind: 'rupa', x: px, y: py });

  items.sort((a, b) => a.sortY - b.sortY);

  // 6. shadows first (so nothing's shadow covers something else)
  ctx.globalAlpha = 1;
  for (const it of items) {
    if (it.kind === 'veh') {
      const w = it.v.w * 1.02 * sstretch;
      const sx = it.x + (it.v.w - w) / 2 + sdx * (it.v.info.len > 3 ? 1.3 : 1);
      if (it.v.info.ride) ctx.globalAlpha = 0.5;
      ctx.drawImage(shadow, sx, it.y - 6 + sdy, w + 6, 10);
      ctx.globalAlpha = 1;
    } else if (it.kind === 'rupa' && !p.dead) {
      const lift = p.lift || 0;
      const s = 1 - lift / 30;
      // faint halo so she pops out of busy scenes
      ctx.fillStyle = 'rgba(122,255,234,0.18)';
      ctx.fillRect(Math.round(it.x - 11), Math.round(it.y - 3), 22, 5);
      ctx.fillRect(Math.round(it.x - 8), Math.round(it.y - 4), 16, 7);
      ctx.drawImage(shadow, it.x - 9 * s * sstretch + sdx * 0.5, it.y - 3 + sdy * 0.5, 18 * s * sstretch, 6);
    }
  }

  // wet-road reflections on the monsoon level
  if (G.level.weather === 'rain') {
    ctx.globalAlpha = 0.16;
    for (const it of items) {
      if (it.kind !== 'veh') continue;
      ctx.save();
      ctx.translate(Math.round(it.x - PAD), Math.round(it.y + 4));
      ctx.scale(1, -0.5);
      ctx.drawImage(it.spr, 0, -GROUND);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  drawSplashes(ctx, fx);

  // 7. the depth-sorted pass
  const rupaScreen = { x: px - 10, y: py - 34, w: 20, h: 34 };
  const R = rupaSprites();
  const pks = pickupSprites();
  for (const it of items) {
    if (it.kind === 'veh') drawVehicle(ctx, it, now);
    else if (it.kind === 'prop' || it.kind === 'walker') drawProp(ctx, it.p, now, rupaScreen);
    else if (it.kind === 'pickup') {
      const pk = it.pk;
      const blink = pk.life - pk.t < 2 && Math.floor(pk.t * 8) % 2 === 0;
      if (blink) continue;
      const y = rowTop(G.level, pk.row) + 7 + Math.sin(pk.t * 4) * 2;
      // glow ring so pickups read against busy asphalt
      ctx.fillStyle = rgba(PICKUP_COLORS[pk.type], 0.35 + Math.sin(pk.t * 6) * 0.15);
      ctx.fillRect(pk.x - 10, rowTop(G.level, pk.row) + 25, 20, 3);
      ctx.drawImage(pks[pk.type], Math.round(pk.x - 8), Math.round(y));
    } else if (it.kind === 'rupa') drawRupa(ctx, R, it.x, it.y, now);
  }

  // x-ray: if a tall bus or prop in front hides Rupa, show her silhouette through it
  if (!p.dead) {
    let hidden = false;
    let after = false;
    for (const it of items) {
      if (it.kind === 'rupa') { after = true; continue; }
      if (!after) continue;
      if (it.kind === 'veh') {
        const top = it.y - (it.v.info.len > 3 ? 56 : 40);
        if (px + 6 > it.x && px - 6 < it.x + it.v.w && py - 26 < it.y && py > top) { hidden = true; break; }
      }
    }
    if (hidden) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(R.ghost[p.facing], Math.round(px - 10), Math.round(py - 30 - (p.lift || 0)));
      ctx.globalAlpha = 1;
    }
  }

  // rail crossing gates (booms + flashing lights)
  for (const gt of sc.gates) drawGate(ctx, gt, now);

  // 8. particles
  drawParticles(ctx, fx);

  // 9. overhead structures — fade when Rupa is underneath. The Farmgate
  // footbridge goes first: it is lower than the metro viaduct, which crosses above it.
  if (sc.footbridge) drawFootbridge(ctx, sc.footbridge, items, R, px, py, now);
  for (const o of sc.overheads) {
    if (o.y > viewBot || o.y + o.spr.height < viewTop) continue;
    let a = o.alpha ?? 1;
    const under = rupaScreen.y < o.y + o.spr.height + 6 && rupaScreen.y + rupaScreen.h > o.y - 4 &&
      (!o.fadeCols || (px > o.fadeCols[0] && px < o.fadeCols[1]));
    if (under && !o.thin) a = 0.38;
    ctx.globalAlpha = a;
    ctx.drawImage(o.spr, o.x, o.y);
    if (o.metroDeck && G.metroX !== null) ctx.drawImage(metroSprite(), Math.round(G.metroX), o.trainY - 12);
    if (o.flyover) {
      const cars = flyoverCars();
      for (let i = 0; i < 6; i++) {
        const dir = i % 2 ? 1 : -1;
        const cx = ((now * (60 + i * 9) * dir + i * 137) % (W + 60) + W + 60) % (W + 60) - 30;
        const cy = o.carY + (i % 2) * 5 - 6;
        ctx.drawImage(cars[i % 4], Math.round(cx), cy);
      }
    }
    ctx.globalAlpha = 1;
  }

  // crows flapping across the skyline
  if (!crows) crows = crowFrames();
  for (const c of sc.crows) {
    if (!G.paused) c.x += c.v / 60;
    if (c.x > W + 20) c.x = -20;
    const f = Math.floor(now * 6 + c.ph) % 2;
    ctx.drawImage(crows[f], Math.round(c.x), Math.round(c.y + Math.sin(now * 1.5 + c.ph) * 6));
  }

  // 10. wrong-way telegraphs + perception outlines, then honk arcs (visible with sound off)
  drawWarnings(ctx, now);
  drawHonks(ctx, items);

  // floating numbers
  for (const tt of fx.texts) {
    const a = 1 - tt.t / tt.life;
    ctx.globalAlpha = Math.min(1, a * 2);
    hudText(ctx, tt.text, tt.x, tt.y, tt.size, tt.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 11. screen-space: colour grade, lighting, weather
  drawTint(ctx, tod);
  if (tod.dark > 0 || tod.lights) {
    const lights = [], glows = [];
    if (tod.dark > 0) {
      for (const L of sc.lights) lights.push({ x: L.x + camX, y: L.y - cam, r: L.r, a: L.a });
      lights.push({ x: px, y: py - 12 - cam, r: 54, a: 0.55 }); // keep Rupa readable
      for (const gl of sc.glows) glows.push({ ...gl, y: gl.y - cam });
    }
    for (const it of items) {
      if (it.kind !== 'veh' || it.v.info.ride) continue;
      const v = it.v;
      const fxp = v.dir > 0 ? it.x + v.w : it.x;
      const ly = it.y - 14 - cam;
      if (tod.lights) {
        lights.push({ x: fxp, y: ly, r: 90, a: 0.9, cone: true, dir: v.dir });
        const ga = 0.2 + tod.dark * 0.6;
        glows.push({ x: fxp, y: ly, r: 8, color: '#fff2b0', a: ga });
        glows.push({ x: v.dir > 0 ? it.x : it.x + v.w, y: ly + 1, r: 5, color: '#ff2a2a', a: ga * 0.9 });
      }
    }
    drawLighting(ctx, tod, lights, glows);
    // lit windows and neon signs stay bright through the dark
    if (sc.emissive) {
      ctx.globalAlpha = 0.92;
      ctx.drawImage(sc.emissive, 0, srcY, W * k, visH, camX, (srcY / k) - cam, W, visH / k);
      ctx.globalAlpha = 1;
    }
  }
  if (G.level.weather === 'rain') drawRain(ctx, fx);
  if (G.level.weather === 'fog') drawFog(ctx, fx, tod.haze);
  // wrong-way headlight flashes stay bright on top of the lighting
  drawWrongWayFlashes(ctx, items, cam, now);
  drawFlash(ctx, fx);
  if (G.levelUpFlash > 0) { ctx.fillStyle = rgba('#ffe14a', G.levelUpFlash * 0.25); ctx.fillRect(0, 0, W, H); }
  drawVignette(ctx, G.scanlines);

  // 12. HUD + menus
  drawHud(ctx, now);

  // scene transition: rickshaw-art stripes slide away to reveal the new level
  if (G.wipe > 0 && G.phase !== 'title') {
    const cols = ['#11a39a', '#ffd23a', '#e2136e', '#ff8a1e', '#1a1f4a'];
    const t = 1 - G.wipe;
    for (let i = 0; i < 12; i++) {
      const bandH = H / 12;
      const delay = i * 0.04;
      const p2 = Math.max(0, Math.min(1, (t - delay) / 0.5));
      const x = (i % 2 ? 1 : -1) * p2 * W * 1.05;
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(Math.round(x), Math.round(i * bandH), W, Math.ceil(bandH) + 1);
    }
  }
}

// ---------------------------------------------------------------------------------------

function drawVehicle(ctx, it, now) {
  const v = it.v;
  ctx.drawImage(it.spr, Math.round(it.x - PAD), Math.round(it.y - GROUND));
  // perception 3+: a faint red danger outline on wrong-way drivers
  if (v.wrongWay && G.upgrades.perception.lvl >= 3) {
    ctx.strokeStyle = `rgba(255,60,60,${0.45 + Math.sin(now * 10) * 0.25})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(it.x) + 0.5, Math.round(it.y - GROUND + 12) + 0.5, v.w - 1, GROUND - 12);
  }
}

// Farmgate foot-over-bridge (geometry and sprites built in scenery/index.js)
function drawFootbridge(ctx, fb, items, R, px, py, now) {
  const deckY = fb.gFar - fb.H;
  const dw = fb.w + fb.side, dh = fb.len + fb.front;
  const hs = fb.hoard.sign;
  // 1. soft shadow on the road, cast to the side — drawn over the traffic, so
  //    vehicles driving through it darken, and open road shows between it and the deck
  ctx.drawImage(fb.shadow, fb.x0 + FB.shadowDx - 4, fb.gFar - 4);
  // 2. the deck itself, solid (step 3 below makes whatever is under it show through)
  ctx.drawImage(fb.deck, fb.x0, deckY);
  // pedestrians with umbrellas walking both ways (keep-left lanes)
  for (const wk of fb.walkers) {
    const d = ((now * wk.v + wk.off) % (fb.len - 18) + fb.len - 18) % (fb.len - 18);
    const wy = wk.lane > 0 ? deckY + 2 + d : deckY + fb.len - 18 - d;
    const f = Math.floor(now * 4 + wk.ph) % 2;
    ctx.drawImage(wk.spr[f], fb.x0 + (wk.lane > 0 ? fb.w - 17 : 6), Math.round(wy));
  }
  // rain splashing on the deck: a few short-lived droplet crowns
  const tick = Math.floor(now * 14);
  ctx.fillStyle = 'rgba(225,238,255,0.8)';
  for (let i = 0; i < 7; i++) {
    const hsh = ((tick * 7 + i) * 2654435761) >>> 0;
    const sx = fb.x0 + 4 + (hsh % (fb.w - 8)), sy = deckY + ((hsh >>> 8) % fb.len);
    ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(sx - 1, sy - 1, 1, 1); ctx.fillRect(sx + 1, sy - 1, 1, 1);
  }
  // hoarding hung off the east railing: two steel brackets + the flex sign
  const hx = fb.hoard.x, hy = fb.hoard.y;
  ctx.fillStyle = '#3a4440';
  ctx.fillRect(fb.x0 + dw, hy + 2, hx - fb.x0 - dw, 2);
  ctx.fillRect(fb.x0 + dw, hy + hs.logicalH - 4, hx - fb.x0 - dw, 2);
  ctx.fillStyle = '#2a302c'; ctx.fillRect(hx - 1, hy - 1, hs.logicalW + 2, hs.logicalH + 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(hs, hx, hy, hs.logicalW, hs.logicalH);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(110,60,30,0.55)'; // rust weeping from the brackets
  ctx.fillRect(hx + 1, hy + 1, 1, 5); ctx.fillRect(hx + hs.logicalW - 3, hy + 1, 1, 7);
  ctx.globalAlpha = 1;
  // 3. x-ray: traffic and Rupa under the deck or hoarding are re-drawn faintly
  //    on top, so nothing dangerous is ever fully hidden
  ctx.save();
  ctx.beginPath();
  ctx.rect(fb.x0, deckY, dw, dh);
  ctx.rect(fb.x0 + dw, hy - 1, hx + hs.logicalW + 1 - fb.x0 - dw, hs.logicalH + 2);
  ctx.clip();
  for (const it of items) {
    if (it.kind !== 'veh') continue;
    // the more of a vehicle the deck hides, the more strongly it shows through
    const overlap = (a, b) => Math.max(0, Math.min(it.x + it.v.w, b) - Math.max(it.x, a));
    const hidden = Math.max(overlap(fb.x0, fb.x0 + dw), overlap(hx, hx + hs.logicalW)) / it.v.w;
    if (hidden <= 0) continue;
    ctx.globalAlpha = 0.35 + 0.4 * hidden;
    ctx.drawImage(it.spr, Math.round(it.x - PAD), Math.round(it.y - GROUND));
  }
  if (!G.player.dead) {
    ctx.globalAlpha = 0.85;
    ctx.drawImage(R.ghost[G.player.facing], Math.round(px - 10), Math.round(py - 30 - (G.player.lift || 0)));
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawProp(ctx, p, now, rupa) {
  let a = 1;
  if (p.fade) {
    const sx = p.x - p.ox, sy = p.y - (p.oy ?? 0);
    const w = (p.spr || p.frames[0]).width, h = (p.spr || p.frames[0]).height;
    if (rupa.x + rupa.w > sx && rupa.x < sx + w && rupa.y + rupa.h > sy && rupa.y < sy + h && rupa.y + rupa.h < p.y + 2) a = 0.4;
  }
  ctx.globalAlpha = a;
  let spr = p.spr;
  if (p.frames) {
    const f = p.dog ? (Math.floor((now + (p.t || 0)) / p.anim) % 4 === 0 ? 1 : 0) : Math.floor((now + (p.t || 0)) / p.anim) % 2;
    spr = p.frames[f];
  }
  if (p.v) {
    // walkers face their direction
    if (p.v < 0) { ctx.save(); ctx.translate(Math.round(p.x), 0); ctx.scale(-1, 1); ctx.drawImage(spr, -p.ox, Math.round(p.y - p.oy)); ctx.restore(); }
    else ctx.drawImage(spr, Math.round(p.x - p.ox), Math.round(p.y - p.oy));
  } else {
    ctx.drawImage(spr, Math.round(p.x - p.ox), Math.round(p.y - p.oy));
  }
  if (p.sign) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(p.sign, Math.round(p.x + p.signDx), Math.round(p.y + p.signDy), p.sign.logicalW, p.sign.logicalH);
    ctx.imageSmoothingEnabled = false;
  }
  ctx.globalAlpha = 1;
}

function drawRupa(ctx, R, x, y, now) {
  const p = G.player;
  if (p.dead) {
    // flattened + spinning stars
    const t = 1.4 - p.deadT;
    ctx.globalAlpha = Math.max(0, 1 - t / 1.4);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(1.4, 0.35);
    ctx.drawImage(R.down[0], -10, -30);
    ctx.restore();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const a = now * 5 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y - 14 + Math.sin(a) * 3), 2, 2);
    }
    return;
  }
  if (p.iframes > 0 && Math.floor(now * 14) % 2 === 0) return;
  const frame = p.hopping ? 1 : 0;
  const flash = p.iframes > IFR_FLASH_FROM ? R.flash[p.facing][frame] : null;
  const spr = R[p.facing][frame];
  // squash & stretch
  const hopT = p.hopping ? Math.min(1, p.hopT) : 1;
  let sx = 1, sy = 1;
  if (p.hopping) { const s = Math.sin(Math.PI * hopT); sx = 1 - s * 0.12; sy = 1 + s * 0.16; }
  else if (p.squash > 0.02) { sx = 1 + p.squash * 0.22; sy = 1 - p.squash * 0.18; }
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - (p.lift || 0)));
  ctx.scale(sx, sy);
  ctx.drawImage(spr, -10, -30);
  if (flash) { ctx.globalAlpha = 0.7; ctx.drawImage(flash, -10, -30); ctx.globalAlpha = 1; }
  ctx.restore();
}
const IFR_FLASH_FROM = 1.0;

function drawGate(ctx, gt, now) {
  const rail = G.lanes.find((l) => l && l.kind === 'rail');
  if (!rail) return;
  const r = rail.rail;
  const lower = r.gate; // 0 = up, 1 = down
  const ang = (1 - lower) * (Math.PI / 2 - 0.08);
  const flashing = r.state === 'warn' || r.state === 'pass';
  for (const [px, dir] of [[18, 1], [622, -1]]) {
    const by = gt.gy - 22;
    // post + lights
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 2, by, 4, 24);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px - 6, by - 6, 12, 6);
    const on = flashing && Math.floor(now * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#5a1010'; ctx.fillRect(px - 5, by - 5, 4, 4);
    ctx.fillStyle = flashing && !on ? '#ff2a2a' : '#5a1010'; ctx.fillRect(px + 1, by - 5, 4, 4);
    if (flashing) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,40,40,0.35)';
      ctx.fillRect(px - 9 + (on ? 0 : 6), by - 9, 10, 10);
      ctx.globalCompositeOperation = 'source-over';
    }
    // boom arm: red/white stripes, pivoting from vertical to horizontal
    // lowered: a long horizontal barrier; raised: a short near-vertical pole
    const len = 150 + 120 * lower;
    const ex = px + dir * Math.cos(ang) * len;
    const ey = by + 2 - Math.sin(ang) * 46;
    const steps = Math.ceil(len / 2);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      ctx.fillStyle = Math.floor(i / 8) % 2 ? '#f0f0f0' : '#d8282a';
      ctx.fillRect(Math.round(px + (ex - px) * t), Math.round(by + 2 + (ey - by - 2) * t), 2, 3);
    }
  }
}

function drawWarnings(ctx, now) {
  const blink = Math.floor(now * 8) % 2 === 0;
  for (const lane of G.lanes) {
    if (!lane || lane.kind !== 'road') continue;
    const top = rowTop(G.level, lane.row);
    for (const v of lane.vehicles) {
      if (!v.wrongWay) continue;
      if (v.warnT > 0) {
        // edge warning arrow where the wrong-way driver will burst in
        const ex = v.dir > 0 ? 4 : W - 20;
        if (blink) {
          ctx.fillStyle = '#ff2a2a';
          ctx.fillRect(ex, top + 6, 16, 18);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex + 7, top + 9, 2, 8);
          ctx.fillRect(ex + 7, top + 19, 2, 2);
        }
        continue;
      }
      // "!" honk bubble above the vehicle
      const vx = v.x + v.w / 2;
      const by = top + 29 - (v.info.len > 3 ? 60 : 44) + v.swerve;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(vx - 6), Math.round(by), 12, 13);
      ctx.fillRect(Math.round(vx - 2), Math.round(by + 13), 4, 3);
      ctx.fillStyle = blink ? '#e8201a' : '#1a1a1a';
      ctx.fillRect(Math.round(vx - 1), Math.round(by + 2), 2, 6);
      ctx.fillRect(Math.round(vx - 1), Math.round(by + 9), 2, 2);
    }
  }
}

// Honk indicator: three pixel sound-wave arcs ")))" spreading from the vehicle's
// nose for the 0.6 s after it honks
function drawHonks(ctx, items) {
  for (const it of items) {
    if (it.kind !== 'veh' || !(it.v.honkFlash > 0)) continue;
    const v = it.v;
    const age = 0.6 - v.honkFlash;                    // 0 → 0.6 s
    const nx = v.dir > 0 ? it.x + v.w + 1 : it.x - 1;  // nose
    const ny = it.y - (v.info.len > 3 ? 30 : v.info.ride ? 14 : 20);
    ctx.globalAlpha = Math.max(0, Math.min(1, 1.6 - age * 2.2));
    for (let i = 0; i < 3; i++) {
      const t = age * 14 - i;                          // arcs pop out one after another
      if (t < 0) continue;
      const rad = 4 + i * 4 + Math.min(1, t) * 2;
      for (let a = -0.85; a <= 0.86; a += 0.17) {
        const px = Math.round(nx + v.dir * Math.cos(a) * rad), py = Math.round(ny + Math.sin(a) * rad * 1.1);
        ctx.fillStyle = '#1a1420'; ctx.fillRect(px, py + 1, 2, 1);
        ctx.fillStyle = v.wrongWay ? '#ffd23a' : '#fff6d0'; ctx.fillRect(px, py, 2, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

let flashSpr = null;
function drawWrongWayFlashes(ctx, items, cam, now) {
  const on = Math.floor(now * 10) % 2 === 0;
  if (!on) return;
  if (!flashSpr) {
    flashSpr = makeCanvas(32, 32);
    const g = flashSpr.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,250,200,0.9)');
    grd.addColorStop(0.35, 'rgba(255,230,120,0.5)');
    grd.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  for (const it of items) {
    if (it.kind !== 'veh' || !it.v.wrongWay) continue;
    const v = it.v;
    const fx = v.dir > 0 ? it.x + v.w : it.x;
    const fy = it.y - 14 - cam;
    ctx.drawImage(flashSpr, fx - 13, fy - 13, 26, 26);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
}

// Small outlined text used for floating numbers (pixel font)
export function hudText(ctx, s, x, y, size, color) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#120a18';
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillText(s, x - 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

