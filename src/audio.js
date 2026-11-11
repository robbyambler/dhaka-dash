// All sound is synthesised with WebAudio — no audio files.
// The AudioContext is only created after the first user gesture (browser rule).

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let muted = false;
let musicOn = false;
let musicTimer = null;
let noiseBuf = null;
let hornBus = null;   // all horns go through here → compressor → master

// Mix levels (linear gain). Effective peak ≈ voice vol × bus gain × master (0.9).
export const MIX = { master: 0.9, sfx: 0.55, music: 0.22, horn: 0.6 };

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.setTargetAtTime(muted ? 0 : MIX.master, ctx.currentTime, 0.02);
}

// Call from the first click / key / touch.
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MIX.master;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = MIX.sfx; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = MIX.music; musicBus.connect(master);
  // Horn bus with its own limiter, so a pile-up of horns can't clip or swamp the mix
  hornBus = ctx.createGain(); hornBus.gain.value = MIX.horn;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14; limiter.knee.value = 6; limiter.ratio.value = 12;
  limiter.attack.value = 0.002; limiter.release.value = 0.15;
  hornBus.connect(limiter).connect(master);
  // One second of white noise, reused for hits, rumble, rain, drums
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (musicOn) startLoop();
}

const ready = () => ctx && ctx.state !== 'closed';

// ---- tiny synth building blocks -------------------------------------------

// bp: optional band-pass centre (Hz) — narrows the tone (used for the nasal CNG horn)
// glide: start at f × glide and slide to f in 40 ms (the "blat" of a horn's attack)
// hold: sustain at full volume for 70% of dur before releasing (horns are held, not plucked)
function tone({ type = 'square', f = 440, f2 = null, t = 0, dur = 0.1, vol = 0.3, bus = sfxBus, attack = 0.005, bp = null, q = 3, glide = null, hold = false }) {
  if (!ready()) return;
  const now = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(glide ? f * glide : f, now);
  if (glide) o.frequency.exponentialRampToValueAtTime(f, now + 0.04);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + attack);
  if (hold) g.gain.setValueAtTime(vol, now + Math.max(attack, dur * 0.7)); // sustain (horns), then release
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  if (bp) {
    const f0 = ctx.createBiquadFilter(); f0.type = 'bandpass'; f0.frequency.value = bp; f0.Q.value = q;
    o.connect(f0).connect(g).connect(bus);
  } else o.connect(g).connect(bus);
  o.start(now);
  o.stop(now + dur + 0.02);
}

function noise({ t = 0, dur = 0.2, vol = 0.3, filter = 1200, q = 0.7, type = 'lowpass', bus = sfxBus, f2 = null }) {
  if (!ready()) return;
  const now = ctx.currentTime + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.frequency.setValueAtTime(filter, now);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, now + dur);
  bq.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bq).connect(g).connect(bus);
  src.start(now, Math.random() * 0.5);
  src.stop(now + dur + 0.02);
}

// ---- sound effects --------------------------------------------------------

// Briefly dip the horn bus so gameplay cues (hop, hit, pickup, train bell) cut through
function duckHorns(depth = 0.45, hold = 0.12) {
  if (!ready() || !hornBus) return;
  const t = ctx.currentTime, gn = hornBus.gain;
  gn.cancelScheduledValues(t);
  gn.setValueAtTime(gn.value, t);
  gn.linearRampToValueAtTime(MIX.horn * depth, t + 0.01);
  gn.setTargetAtTime(MIX.horn, t + hold, 0.06);
}

// A horn "voice": its own gain (distance) and stereo panner (screen x), feeding the horn bus
function hornVoice(pan, vol) {
  const v = ctx.createGain(); v.gain.value = vol;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); v.connect(p).connect(hornBus); } else v.connect(hornBus);
  return v;
}

export const sfx = {
  hop() { duckHorns(0.5, 0.08); tone({ type: 'square', f: 420, f2: 760, dur: 0.07, vol: 0.12 }); },
  // weight 0..1 — bicycles are a tap, trucks are a crunch
  hit(weight = 0.5) {
    duckHorns(0.3, 0.3);
    noise({ dur: 0.18 + weight * 0.3, vol: 0.35 + weight * 0.35, filter: 2600 - weight * 1900, f2: 200 });
    tone({ type: 'sawtooth', f: 220 - weight * 120, f2: 50, dur: 0.2 + weight * 0.25, vol: 0.25 });
  },
  // Horns differ per vehicle class. pan -1..1 (screen x), vol 0..1 (distance).
  // Lengths here must match HORN_LEN in game.js (used for the voice cap).
  horn(kind = 'car', { pan = 0, vol = 1 } = {}) {
    if (!ready() || !hornBus) return;
    const bus = hornVoice(pan, vol);
    const T = (o) => tone({ attack: 0.004, hold: true, bus, ...o });
    switch (kind) {
      case 'bell': // rickshaw / bicycle bell: bright double ring
        for (let i = 0; i < 2; i++) {
          T({ type: 'triangle', f: 2350, t: i * 0.11, dur: 0.18, vol: 0.2 });
          T({ type: 'sine', f: 3510, t: i * 0.11, dur: 0.12, vol: 0.09 });
        }
        break;
      case 'moto': // thin, high single beep
        T({ type: 'square', f: 1180, dur: 0.15, vol: 0.12, bp: 2400, q: 2 });
        T({ type: 'triangle', f: 1770, dur: 0.15, vol: 0.06 });
        break;
      case 'cng': // nasal "beep-beep": two detuned squares squeezed through a narrow band-pass
        for (const t of [0, 0.16]) {
          T({ type: 'square', f: 560, t, dur: 0.11, vol: 0.3, bp: 1300, q: 5 });
          T({ type: 'square', f: 588, t, dur: 0.11, vol: 0.22, bp: 1300, q: 5 });
        }
        break;
      case 'bus': // harsh two-tone air horn: two clashing saws + sub, double blast
        for (const [t, dur] of [[0, 0.3], [0.36, 0.42]]) {
          T({ type: 'sawtooth', f: 277, t, dur, vol: 0.16, glide: 0.85 });
          T({ type: 'sawtooth', f: 349, t, dur, vol: 0.13, glide: 0.85 });
          T({ type: 'square', f: 138, t, dur, vol: 0.06 });
        }
        break;
      case 'truck': { // Bangladeshi truck: long melodic multi-note "pressure horn" tune
        const tune = [523, 659, 784, 659, 880, 784, 659];
        tune.forEach((f, i) => {
          T({ type: 'square', f, t: i * 0.14, dur: 0.16, vol: 0.1, glide: 0.94 });
          T({ type: 'sawtooth', f: f / 2, t: i * 0.14, dur: 0.16, vol: 0.07 });
        });
        break;
      }
      case 'ship': // launch on the river: low, long, hollow ship horn
        T({ type: 'sawtooth', f: 98, dur: 1.35, vol: 0.2, attack: 0.08, bp: 420, q: 1.2 });
        T({ type: 'sawtooth', f: 147, dur: 1.35, vol: 0.14, attack: 0.08, bp: 420, q: 1.2 });
        T({ type: 'sine', f: 49, dur: 1.35, vol: 0.18, attack: 0.08 });
        break;
      case 'ambulance':
        for (let i = 0; i < 3; i++) { T({ type: 'square', f: 880, t: i * 0.3, dur: 0.15, vol: 0.08 }); T({ type: 'square', f: 660, t: i * 0.3 + 0.15, dur: 0.15, vol: 0.08 }); }
        break;
      default: // car: standard mid horn, a major third, one firm blast
        T({ type: 'square', f: 392, dur: 0.28, vol: 0.13, glide: 0.92 });
        T({ type: 'square', f: 494, dur: 0.28, vol: 0.1, glide: 0.92 });
    }
  },
  trainBell(i = 0) { duckHorns(0.6, 0.1); tone({ type: 'triangle', f: i % 2 ? 1320 : 1480, dur: 0.22, vol: 0.12 }); },
  trainRumble() {
    noise({ dur: 2.2, vol: 0.5, filter: 220, q: 1.5 });
    tone({ type: 'sawtooth', f: 330, dur: 1.2, vol: 0.1 }); tone({ type: 'sawtooth', f: 415, dur: 1.2, vol: 0.08 }); // train horn
  },
  splash() { noise({ dur: 0.5, vol: 0.4, filter: 900, f2: 300, type: 'bandpass', q: 0.8 }); tone({ type: 'sine', f: 600, f2: 180, dur: 0.25, vol: 0.15 }); },
  pickup() { duckHorns(0.5, 0.15); [988, 1319, 1568].forEach((f, i) => tone({ type: 'square', f, t: i * 0.05, dur: 0.09, vol: 0.09 })); },
  heal() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.06, dur: 0.15, vol: 0.12 })); },
  levelUp() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, t: i * 0.07, dur: 0.12, vol: 0.09 }));
  },
  extraLife() { [659, 784, 988, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.08, dur: 0.2, vol: 0.13 })); },
  lifeLost() { [440, 392, 349, 262].forEach((f, i) => tone({ type: 'square', f, f2: f * 0.97, t: i * 0.14, dur: 0.16, vol: 0.12 })); },
  clear() {
    // Little "rickshaw-bell + fanfare" jingle
    const notes = [523, 587, 659, 784, 880, 784, 1047];
    notes.forEach((f, i) => tone({ type: 'square', f, t: i * 0.09, dur: 0.14, vol: 0.1 }));
    tone({ type: 'triangle', f: 2350, t: 0.7, dur: 0.3, vol: 0.1 });
  },
  gameOver() { [392, 370, 349, 330, 196].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.22, dur: 0.3, vol: 0.14 })); },
  menu() { tone({ type: 'square', f: 880, dur: 0.05, vol: 0.07 }); },
  thunder() { noise({ dur: 2.5, vol: 0.35, filter: 160, q: 0.5 }); },
};

// ---- music: a light chiptune loop with a Bengali-folk flavoured melody -----
// Scale built on Sa–Re–Ga–Ma–Pa–Dha–ni (a Khamaj-ish folk mode) in D.
// A plucky "ektara" drone pings on every beat, a dhol-like drum keeps time.

const BPM = 104;
const SA = 293.66; // D4
const SCALE = [0, 2, 4, 5, 7, 9, 10, 12, 14, 16]; // semitones from Sa
const note = (deg, oct = 0) => SA * Math.pow(2, (SCALE[deg] + 12 * oct) / 12);

// Melody: degree index per 8th note (-1 = rest). Two phrases, 32 steps each.
const MELODY = [
  4, -1, 5, 4, 2, -1, 1, 2, 4, -1, 4, 5, 7, -1, 5, 4,
  5, -1, 4, 2, 1, -1, 0, 1, 2, -1, 1, 0, 0, -1, -1, -1,
  7, -1, 7, 8, 7, 5, 4, -1, 5, -1, 5, 7, 5, 4, 2, -1,
  4, 5, 4, 2, 1, -1, 2, 4, 2, 1, 0, -1, 0, -1, -1, -1,
];
const BASS = [0, 0, 4, 0, 3, 3, 4, 4]; // per half bar

let step = 0;
let nextTime = 0;

function scheduleStep(i, at) {
  const t = at - ctx.currentTime;
  const s8 = 60 / BPM / 2;
  const m = MELODY[i % MELODY.length];
  if (m >= 0) {
    tone({ type: 'triangle', f: note(m, 1) * 0.5 * 2, t, dur: s8 * 1.6, vol: 0.16, bus: musicBus, attack: 0.02 });
    tone({ type: 'square', f: note(m, 1), t, dur: s8 * 0.9, vol: 0.035, bus: musicBus });
  }
  // ektara pluck on each beat
  if (i % 2 === 0) tone({ type: 'square', f: SA * 2, f2: SA * 1.98, t, dur: 0.12, vol: 0.04, bus: musicBus });
  // bass on each half bar
  if (i % 4 === 0) {
    const b = BASS[(i / 4) % BASS.length];
    tone({ type: 'triangle', f: note(b, -2), t, dur: s8 * 3.5, vol: 0.22, bus: musicBus, attack: 0.01 });
  }
  // dhol: low thump on 1 and the "and" of 2, slap on 3
  const bar = i % 8;
  if (bar === 0 || bar === 3) tone({ type: 'sine', f: 120, f2: 55, t, dur: 0.18, vol: 0.35, bus: musicBus });
  if (bar === 4) noise({ t, dur: 0.08, vol: 0.18, filter: 2500, type: 'bandpass', q: 1.2, bus: musicBus });
  if (bar % 2 === 1) noise({ t, dur: 0.03, vol: 0.05, filter: 7000, type: 'highpass', bus: musicBus });
}

function startLoop() {
  if (!ready() || musicTimer) return;
  nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    const s8 = 60 / BPM / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      scheduleStep(step++, nextTime);
      nextTime += s8;
    }
  }, 60);
}

export function setMusic(on) {
  musicOn = on;
  if (on) startLoop();
  else if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
