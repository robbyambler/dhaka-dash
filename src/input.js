// Input: keyboard, swipe/tap, on-screen D-pad and menu clicks.
// Everything is turned into simple events in a queue that game.js drains
// once per simulation step:
//   { kind: 'move', dir: 'up'|'down'|'left'|'right' }
//   { kind: 'action', name: 'pause'|'mute'|'lang'|'confirm'|'back' }
//   { kind: 'click', x, y }    (logical 640×360 coordinates)

const queue = [];
let toLogical = (cx, cy) => ({ x: cx, y: cy });
let onFirstGesture = null;

export function pushEvent(e) { queue.push(e); }
export function drainEvents() { return queue.splice(0, queue.length); }

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

function gesture() {
  if (onFirstGesture) { const f = onFirstGesture; onFirstGesture = null; f(); }
}

export function initInput({ canvas, mapToLogical, firstGesture }) {
  toLogical = mapToLogical;
  onFirstGesture = firstGesture;

  window.addEventListener('keydown', (e) => {
    gesture();
    if (e.repeat && !KEYMAP[e.code]) return;
    if (KEYMAP[e.code]) {
      e.preventDefault();
      if (!e.repeat) queue.push({ kind: 'move', dir: KEYMAP[e.code] });
      return;
    }
    switch (e.code) {
      case 'KeyP': queue.push({ kind: 'action', name: 'pause' }); break;
      case 'Escape': queue.push({ kind: 'action', name: 'back' }); break;
      case 'KeyM': queue.push({ kind: 'action', name: 'mute' }); break;
      case 'KeyL': queue.push({ kind: 'action', name: 'lang' }); break;
      case 'Enter': case 'Space': case 'NumpadEnter':
        e.preventDefault();
        queue.push({ kind: 'action', name: 'confirm' }); break;
      default: break;
    }
  });

  // Pointer: a short tap is a click (menus) / hop up (in play);
  // a drag beyond 24px is a swipe in that direction.
  let start = null;
  canvas.addEventListener('pointerdown', (e) => {
    gesture();
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 24) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      queue.push({ kind: 'move', dir, swipe: true });
    } else {
      const p = toLogical(e.clientX, e.clientY);
      queue.push({ kind: 'click', x: p.x, y: p.y, touch: e.pointerType !== 'mouse' });
    }
    start = null;
  });
  canvas.addEventListener('pointercancel', () => { start = null; });

  // On-screen D-pad (shown on touch devices by CSS/main.js)
  document.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gesture();
      queue.push({ kind: 'move', dir: btn.dataset.dir });
      btn.classList.add('down');
    });
    const up = () => btn.classList.remove('down');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
  });
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gesture();
      queue.push({ kind: 'action', name: btn.dataset.action });
    });
  });
}
