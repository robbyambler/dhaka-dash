// HUD, menus and overlay screens. Everything is drawn in the 640×360 logical
// space but at full screen resolution, so English pixel text and Bengali text
// both stay crisp. Clickable buttons are registered every frame.

import { W, H, MAX_HP, XP_STEPS } from './config.js';
import { G, setButtons, upgradeCap } from './game.js';
import { t, tr, num, uiFont, getLang, FONTS } from './i18n.js';
import { rupaSprites } from './player.js';
import { pickupSprites } from './pickups.js';
import { rgba } from './gfx.js';

let buttons = [];

// ---- primitives -------------------------------------------------------------------------

const BENGALI = /[\u0980-\u09FF]/;
// Bengali text always uses the bundled Bengali face, even in English mode
function fontFor(s, size, display) {
  if (getLang() === 'en' && BENGALI.test(s)) return `${display ? 800 : 700} ${Math.round(size * 1.55)}px ${display ? FONTS.bnDisplay : FONTS.bnBody}`;
  return uiFont(size, display);
}

function text(ctx, s, x, y, o = {}) {
  const { size = 8, color = '#ffffff', align = 'left', display = false, shadow = '#120a18', base = 'middle', font = null } = o;
  ctx.font = font || fontFor(s, size, display);
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(s, x + 1, y + 1);
    if (o.outline) { ctx.fillText(s, x - 1, y); ctx.fillText(s, x + 1, y - 1); ctx.fillText(s, x, y + 2); ctx.fillText(s, x - 1, y + 1); }
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function measure(ctx, s, size, display = false) {
  ctx.font = fontFor(s, size, display);
  return ctx.measureText(s).width;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

// A panel styled like a painted rickshaw plate: dark body, coloured border bands
function panel(ctx, x, y, w, h, accent = '#11a39a') {
  roundRect(ctx, x + 3, y + 4, w, h, 6, 'rgba(0,0,0,0.35)');
  roundRect(ctx, x, y, w, h, 6, 'rgba(18,12,30,0.92)', accent);
  ctx.fillStyle = accent; ctx.fillRect(x + 6, y + 3, w - 12, 2);
  ctx.fillStyle = '#ff8a1e'; ctx.fillRect(x + 6, y + h - 5, w - 12, 2);
  // corner rosettes
  for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.fillStyle = '#e2136e'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

function button(ctx, label, cx, y, action, o = {}) {
  const size = o.size || 8;
  const w = Math.max(o.minW || 120, measure(ctx, label, size) + 24);
  const h = getLang() === 'bn' ? 22 : 18;
  const x = Math.round(cx - w / 2);
  const primary = o.primary;
  roundRect(ctx, x + 2, y + 3, w, h, 5, 'rgba(0,0,0,0.4)');
  roundRect(ctx, x, y, w, h, 5, primary ? '#ff8a1e' : '#11a39a', '#ffe9c8');
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 4, y + 2, w - 8, 2);
  text(ctx, label, cx, y + h / 2 + (getLang() === 'bn' ? 1 : 1), { size, color: '#ffffff', align: 'center', shadow: primary ? '#8a3a00' : '#05403c' });
  buttons.push({ x, y, w, h, action });
  return y + h + 6;
}

// ---- HUD ----------------------------------------------------------------------------------

function heart(ctx, x, y, full) {
  const c = full ? '#ff3a5a' : 'rgba(255,255,255,0.18)';
  ctx.fillStyle = c;
  ctx.fillRect(x + 1, y, 3, 2); ctx.fillRect(x + 6, y, 3, 2);
  ctx.fillRect(x, y + 1, 10, 4); ctx.fillRect(x + 1, y + 5, 8, 2); ctx.fillRect(x + 3, y + 7, 4, 2);
  if (full) { ctx.fillStyle = '#ffb0c0'; ctx.fillRect(x + 2, y + 1, 1, 1); }
}

function hudBar(ctx) {
  const bn = getLang() === 'bn';
  const g = ctx.createLinearGradient(0, 0, 0, 24);
  g.addColorStop(0, 'rgba(14,8,26,0.92)'); g.addColorStop(1, 'rgba(14,8,26,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 22);
  // rickshaw-art stripe
  const cols = ['#11a39a', '#ffd23a', '#e2136e', '#ff8a1e'];
  for (let x = 0; x < W; x += 8) { ctx.fillStyle = cols[(x / 8) % 4]; ctx.fillRect(x, 22, 8, 2); }

  // level badge + name
  roundRect(ctx, 4, 4, 36, 14, 4, '#11a39a');
  text(ctx, `${t('level')}${num(G.levelIndex + 1)}`, 22, 11.5, { size: bn ? 6 : 7, align: 'center', shadow: '#05403c' });
  let nameX = 46;
  if (G.ngPlus > 0) {
    roundRect(ctx, 44, 4, bn ? 44 : 36, 14, 4, '#e2136e');
    text(ctx, `${t('ngPlus')}${num(G.ngPlus)}`, 44 + (bn ? 22 : 18), 11.5, { size: bn ? 5.5 : 7, align: 'center', shadow: '#6a0030' });
    nameX = bn ? 94 : 86;
  }
  text(ctx, tr(G.level.name), nameX, 11.5, { size: bn ? 6.5 : 7, color: '#ffe9c8', font: bn ? `700 11px ${FONTS.bnBody}` : `7px ${FONTS.pixel}` });

  // score + hi
  const sx = 312;
  text(ctx, t('score'), sx, 7.5, { size: 5, color: '#9af0e8', align: 'center', font: bn ? `700 8px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });
  text(ctx, num(String(G.score).padStart(7, '0')), sx, 16, { size: 8, color: '#ffffff', align: 'center', font: bn ? `800 12px ${FONTS.bnDisplay}` : `8px ${FONTS.pixel}` });
  text(ctx, `${t('hiScore')} ${num(G.highScore)}`, 380, 11.5, { size: 5, color: '#ffd23a', font: bn ? `700 9px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });

  // lives
  for (let i = 0; i < 3; i++) heart(ctx, 458 + i * 13, 6, i < G.lives);

  // HP bar
  const hp = Math.max(0, G.player.hp);
  const bx = 520, bw = 88;
  text(ctx, t('hp'), bx - 3, 11.5, { size: 5, color: '#9af0e8', align: 'right', font: bn ? `700 8px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });
  roundRect(ctx, bx, 6, bw, 11, 3, '#1a1028', '#5a4a7a');
  const f = hp / MAX_HP;
  const col = f > 0.6 ? '#3ad06a' : f > 0.3 ? '#ffc23a' : '#ff3a3a';
  if (f > 0) { roundRect(ctx, bx + 1, 7, Math.max(2, (bw - 2) * f), 9, 2, col); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 3, 8, Math.max(0, (bw - 6) * f), 2); }
  text(ctx, num(Math.ceil(hp)), bx + bw / 2, 12, { size: 5, align: 'center', font: bn ? `700 8px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });

  // pause button (also works with mouse / touch)
  roundRect(ctx, 616, 3, 20, 16, 4, 'rgba(255,255,255,0.12)', '#9a8ab8');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(622, 7, 3, 8); ctx.fillRect(628, 7, 3, 8);
  buttons.push({ x: 612, y: 0, w: 28, h: 22, action: 'pause' });
}

function statPanel(ctx) {
  const bn = getLang() === 'bn';
  const icons = pickupSprites();
  const y = H - 22;
  const g = ctx.createLinearGradient(0, y - 6, 0, H);
  g.addColorStop(0, 'rgba(14,8,26,0.0)'); g.addColorStop(0.35, 'rgba(14,8,26,0.72)'); g.addColorStop(1, 'rgba(14,8,26,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 6, W, 28);
  const cap = upgradeCap();
  const row = (x, icon, label, u, color) => {
    ctx.drawImage(icon, x, y + 2);
    text(ctx, `${label} ${num(u.lvl)}`, x + 19, y + 10, { size: 6, color, font: bn ? `700 10px ${FONTS.bnBody}` : `6px ${FONTS.pixel}` });
    const lw = measure(ctx, `${label} ${num(u.lvl)}`, 6);
    ctx.font = bn ? `700 10px ${FONTS.bnBody}` : `6px ${FONTS.pixel}`;
    const tw = ctx.measureText(`${label} ${num(u.lvl)}`).width;
    // level pips (filled = earned levels), then XP pips toward the next level
    let px = x + 24 + tw;
    for (let i = 0; i < cap; i++) {
      ctx.fillStyle = i < u.lvl ? color : 'rgba(255,255,255,0.18)';
      ctx.fillRect(px + i * 6, y + 6, 4, 8);
    }
    px += cap * 6 + 3;
    if (u.lvl < cap) {
      const need = XP_STEPS[Math.min(u.lvl, XP_STEPS.length - 1)];
      for (let i = 0; i < need; i++) { ctx.fillStyle = i < u.xp ? '#ffffff' : 'rgba(255,255,255,0.25)'; ctx.fillRect(px + i * 4, y + 12, 3, 2); }
    }
    return px + 18 + lw * 0;
  };
  const nx = row(6, icons.tea, t('percShort'), G.upgrades.perception, '#ffcf8a');
  row(Math.max(nx, 150), icons.cookie, t('speedShort'), G.upgrades.speed, '#ffd27a');

  // time bonus (bottom right)
  const low = G.timeLeft < 10;
  text(ctx, t('time'), W - 58, y + 10, { size: 6, color: '#9af0e8', align: 'right', font: bn ? `700 10px ${FONTS.bnBody}` : `6px ${FONTS.pixel}` });
  text(ctx, num(Math.ceil(G.timeLeft)), W - 10, y + 10, { size: 10, color: low ? '#ff6a5a' : '#ffffff', align: 'right', font: bn ? `800 16px ${FONTS.bnDisplay}` : `10px ${FONTS.pixel}` });
}

function toasts(ctx) {
  let y = 40;
  for (const tt of G.toasts) {
    const a = Math.min(1, (tt.life - tt.t) * 3, tt.t * 8);
    const pop = tt.t < 0.15 ? 1 + (0.15 - tt.t) * 3 : 1;
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.scale(pop, pop);
    const w = measure(ctx, tt.text, 8) + 20;
    roundRect(ctx, -w / 2, -9, w, 18, 5, 'rgba(14,8,26,0.8)', rgba(tt.color, 0.8));
    text(ctx, tt.text, 0, 1, { size: 8, color: tt.color, align: 'center' });
    ctx.restore();
    y += 22;
  }
  ctx.globalAlpha = 1;
}

function hints(ctx, now) {
  if (!G.level.hints || G.phase !== 'playing' || G.levelT > 32) return;
  const touch = document.documentElement.classList.contains('touch-device');
  const keys = [touch ? 'hint1Touch' : 'hint1', 'hint2', 'hint3', 'hint4', 'hint5'];
  const i = Math.floor(G.levelT / 6.4) % keys.length;
  const s = t(keys[i]);
  const w = measure(ctx, s, 7) + 24;
  const a = Math.min(1, (G.levelT % 6.4) * 3, (6.4 - (G.levelT % 6.4)) * 3);
  ctx.globalAlpha = a;
  roundRect(ctx, W / 2 - w / 2, H - 52, w, 20, 6, 'rgba(255,248,230,0.94)', '#ff8a1e');
  text(ctx, s, W / 2, H - 41.5, { size: 7, color: '#3a1a08', align: 'center', shadow: null });
  ctx.globalAlpha = 1;
}

// ---- screens ------------------------------------------------------------------------------

function dim(ctx, a = 0.55) { ctx.fillStyle = `rgba(10,6,22,${a})`; ctx.fillRect(0, 0, W, H); }

function logo(ctx, cx, y, now) {
  const bn = getLang() === 'bn';
  const en = 'DHAKA DASH';
  const bnT = 'ঢাকা দৌড়';
  const bounce = Math.sin(now * 2) * 1.5;
  // English pixel logo with layered rickshaw-art shadow
  const enSize = bn ? 11 : 24;
  const enY = bn ? y + 52 : y + bounce;
  ctx.font = `${enSize}px ${FONTS.pixel}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const layers = [['#120a18', 4], ['#e2136e', 3], ['#ffd23a', 2], ['#11a39a', 1]];
  for (const [c, d] of layers) { ctx.fillStyle = c; ctx.fillText(en, cx + d, enY + d); }
  ctx.fillStyle = '#ffffff'; ctx.fillText(en, cx, enY);
  // Bengali title
  const bnSize = bn ? 46 : 30;
  const bnY = bn ? y + 6 + bounce : y + 38;
  ctx.font = `800 ${bnSize}px ${FONTS.bnDisplay}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = bn ? 7 : 5;
  ctx.strokeStyle = '#120a18';
  ctx.strokeText(bnT, cx + 2, bnY + 3);
  ctx.lineWidth = bn ? 4 : 3;
  ctx.strokeStyle = '#c62828';
  ctx.strokeText(bnT, cx, bnY);
  ctx.fillStyle = '#ffd23a';
  ctx.fillText(bnT, cx, bnY);
}

function titleScreen(ctx, now) {
  dim(ctx, 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,6,22,0.7)'); g.addColorStop(0.5, 'rgba(10,6,22,0.1)'); g.addColorStop(1, 'rgba(10,6,22,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  logo(ctx, W / 2, 52, now);
  // Rupa, big, bouncing next to the logo
  const R = rupaSprites();
  ctx.save();
  ctx.translate(560, 120 + Math.abs(Math.sin(now * 3)) * -10);
  ctx.scale(3, 3);
  ctx.drawImage(R.down[Math.floor(now * 3) % 2 ? 1 : 0], -10, -30);
  ctx.restore();
  text(ctx, t('subtitle'), W / 2, getLang() === 'bn' ? 128 : 122, { size: 7, color: '#ffe9c8', align: 'center', outline: true });
  // buttons
  let y = 150;
  const pulse = 1 + Math.sin(now * 5) * 0.03;
  ctx.save(); ctx.translate(W / 2, y + 10); ctx.scale(pulse, pulse); ctx.translate(-W / 2, -(y + 10));
  y = button(ctx, getLang() === 'bn' ? 'খেলা শুরু' : 'START', W / 2, y, 'start', { primary: true, minW: 160, size: 9 });
  ctx.restore();
  const y2 = y + 2;
  button(ctx, t('langButton'), W / 2 - 86, y2, 'lang', { minW: 120 });
  button(ctx, G.muted ? t('soundOff') : t('soundOn'), W / 2 + 86, y2, 'mute', { minW: 120 });
  text(ctx, t('pressStart'), W / 2, y2 + 42, { size: 7, color: Math.floor(now * 2) % 2 ? '#ffffff' : '#ffd23a', align: 'center', outline: true });
  // high score strip
  text(ctx, `${t('highScore')}: ${num(G.highScore)}   ${t('bestNg')}: ${num(G.bestNg)}`, W / 2, y2 + 62, { size: 6, color: '#9af0e8', align: 'center', outline: true });
  text(ctx, t('controls'), W / 2, H - 14, { size: 5, color: 'rgba(255,255,255,0.75)', align: 'center', font: getLang() === 'bn' ? `600 9px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });
  // which landmark is showing behind
  text(ctx, tr(G.level.name), 8, H - 30, { size: 6, color: '#ffe9c8', outline: true });
}

function levelIntro(ctx, now) {
  const p = Math.min(1, G.phaseT * 3);
  const out = G.phaseT > 2.2 ? Math.min(1, (G.phaseT - 2.2) * 2.5) : 0;
  const bn = getLang() === 'bn';
  dim(ctx, 0.45 * (1 - out));
  const w = 400, h = G.level.hints ? 150 : 104;
  const x = W / 2 - w / 2;
  const y = 70 - (1 - p) * 30 - out * 200;
  ctx.globalAlpha = p * (1 - out);
  panel(ctx, x, y, w, h);
  text(ctx, `${t('levelWord')} ${num(G.levelIndex + 1)}${G.ngPlus ? `  ·  ${t('ngPlus')}${num(G.ngPlus)}` : ''}`, W / 2, y + 20, { size: 8, color: '#ffd23a', align: 'center' });
  text(ctx, tr(G.level.name), W / 2, y + 46, { size: 14, color: '#ffffff', align: 'center', display: true, font: bn ? `800 26px ${FONTS.bnDisplay}` : `14px ${FONTS.pixel}`, outline: true });
  text(ctx, tr(G.level.tagline), W / 2, y + 76, { size: 7, color: '#9af0e8', align: 'center' });
  if (G.level.hints) {
    text(ctx, t(document.documentElement.classList.contains('touch-device') ? 'hint1Touch' : 'hint1'), W / 2, y + 100, { size: 6, color: '#ffe9c8', align: 'center' });
    text(ctx, t('hint3'), W / 2, y + 116, { size: 6, color: '#ffe9c8', align: 'center' });
    text(ctx, t('hint4'), W / 2, y + 132, { size: 6, color: '#ffe9c8', align: 'center' });
  }
  ctx.globalAlpha = 1;
}

function pauseMenu(ctx) {
  dim(ctx, 0.6);
  const bn = getLang() === 'bn';
  const w = 260, h = bn ? 196 : 176;
  const x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h, '#ff8a1e');
  text(ctx, t('paused'), W / 2, y + 24, { size: 14, color: '#ffd23a', align: 'center', display: true, outline: true });
  let by = y + 46;
  by = button(ctx, t('resume'), W / 2, by, 'resume', { primary: true, minW: 200 });
  by = button(ctx, t('langLabel'), W / 2, by, 'lang', { minW: 200 });
  by = button(ctx, G.muted ? t('soundOff') : t('soundOn'), W / 2, by, 'mute', { minW: 200 });
  by = button(ctx, G.scanlines ? t('scanOn') : t('scanOff'), W / 2, by, 'scan', { minW: 200 });
  button(ctx, t('quit'), W / 2, by, 'quit', { minW: 200 });
}

function levelClear(ctx) {
  const p = Math.min(1, G.phaseT * 3);
  dim(ctx, 0.35 * p);
  const w = 320, h = 150;
  const x = W / 2 - w / 2, y = 80 + (1 - p) * 40;
  ctx.globalAlpha = p;
  panel(ctx, x, y, w, h, '#3ad06a');
  text(ctx, t('levelClear'), W / 2, y + 24, { size: 14, color: '#7aff9a', align: 'center', display: true, outline: true });
  const tl = G.tally || { clear: 0, time: 0, nodmg: 0, total: 0 };
  const lines = [[t('clearBonus'), tl.clear], [t('timeBonus'), tl.time], [t('noDamage'), tl.nodmg], [t('total'), tl.total]];
  lines.forEach(([label, v], i) => {
    if (G.phaseT < 0.4 + i * 0.35) return;
    const yy = y + 52 + i * 18;
    if (i === 3) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 30, yy - 10, w - 60, 1); }
    text(ctx, label, x + 34, yy, { size: 7, color: i === 3 ? '#ffd23a' : '#ffe9c8' });
    text(ctx, `+${num(v)}`, x + w - 34, yy, { size: 8, color: i === 3 ? '#ffd23a' : '#ffffff', align: 'right' });
  });
  ctx.globalAlpha = 1;
}

function gameOver(ctx, now) {
  dim(ctx, 0.7);
  const w = 340, h = 200;
  const x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h, '#ff3a3a');
  text(ctx, t('gameOver'), W / 2, y + 28, { size: 18, color: '#ff5a4a', align: 'center', display: true, outline: true });
  text(ctx, t('gameOverSub'), W / 2, y + 54, { size: 6, color: '#ffe9c8', align: 'center' });
  text(ctx, `${t('finalScore')}: ${num(G.score)}`, W / 2, y + 78, { size: 9, color: '#ffffff', align: 'center' });
  text(ctx, `${t('highScore')}: ${num(G.highScore)}`, W / 2, y + 98, { size: 7, color: '#ffd23a', align: 'center' });
  if (G.newHigh && Math.floor(now * 3) % 2) text(ctx, t('newHigh'), W / 2, y + 114, { size: 7, color: '#7aff9a', align: 'center' });
  let by = y + 130;
  by = button(ctx, t('retry'), W / 2, by, 'retry', { primary: true, minW: 200 });
  button(ctx, t('toTitle'), W / 2, by, 'title', { minW: 200 });
}

function victory(ctx, now) {
  dim(ctx, 0.55);
  // confetti
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + now * (30 + (i % 5) * 12)) % W;
    const y = (i * 53 + now * (40 + (i % 7) * 10)) % H;
    ctx.fillStyle = ['#ffd23a', '#e2136e', '#11a39a', '#ff8a1e', '#ffffff'][i % 5];
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
  const w = 400, h = 222;
  const x = W / 2 - w / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h, '#ffd23a');
  text(ctx, t('victory'), W / 2, y + 30, { size: 16, color: '#ffd23a', align: 'center', display: true, outline: true });
  text(ctx, t('victorySub'), W / 2, y + 58, { size: 6, color: '#ffe9c8', align: 'center' });
  text(ctx, `${t('finalScore')}: ${num(G.score)}`, W / 2, y + 82, { size: 9, color: '#ffffff', align: 'center' });
  text(ctx, `${t('highScore')}: ${num(G.highScore)}`, W / 2, y + 102, { size: 7, color: '#9af0e8', align: 'center' });
  text(ctx, t('ngExplain'), W / 2, y + 122, { size: 5.5, color: '#ffe9c8', align: 'center', font: getLang() === 'bn' ? `600 9px ${FONTS.bnBody}` : `5px ${FONTS.pixel}` });
  let by = y + 140;
  by = button(ctx, `${t('newGamePlus')} ${num(G.ngPlus + 1)}`, W / 2, by, 'ngplus', { primary: true, minW: 220, size: 9 });
  button(ctx, t('toTitle'), W / 2, by, 'title', { minW: 220 });
  // Rupa celebrating with a cup of cha
  const R = rupaSprites();
  ctx.save();
  ctx.translate(x + w - 40, y + h - 14 - Math.abs(Math.sin(now * 5)) * 8);
  ctx.scale(2, 2);
  ctx.drawImage(R.down[1], -10, -30);
  ctx.restore();
}

export function drawHud(ctx, now) {
  ctx.setTransform(ctx.getTransform()); // keep current scale
  buttons = [];
  const ph = G.phase;
  if (ph === 'title') { titleScreen(ctx, now); setButtons(buttons); return; }
  hudBar(ctx);
  statPanel(ctx);
  hints(ctx, now);
  toasts(ctx);
  if (ph === 'levelIntro') levelIntro(ctx, now);
  if (ph === 'levelClear') levelClear(ctx);
  if (ph === 'gameOver') gameOver(ctx, now);
  if (ph === 'victory') victory(ctx, now);
  if (G.paused) pauseMenu(ctx);
  setButtons(buttons);
}
