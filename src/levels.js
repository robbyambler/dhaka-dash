// The ten levels as data. Rows are listed bottom (start) → top (goal).
//
// Row helpers:
//   F            start footpath (safe)
//   G            goal footpath (safe; reaching it clears the level)
//   M(kind)      median / divider (safe). kind picks the art.
//   R(dir, spd)  road lane. dir -1 = traffic to the left, +1 = to the right.
//                Bangladesh drives on the LEFT, so near lanes flow left.
//   T()          rail track (level crossing)
//   W(dir, spd)  water lane (ride boats)
// Lane speed `spd` multiplies the vehicle's own speed.

const F = { type: 'foot' };
const G = { type: 'goal' };
const M = (kind = 'divider') => ({ type: 'median', kind });
const R = (dir, spd = 1, extra = {}) => ({ type: 'road', dir, spd, ...extra });
const T = (extra = {}) => ({ type: 'rail', ...extra });
const W = (dir, spd = 1, extra = {}) => ({ type: 'water', dir, spd, ...extra });

export const LEVELS = [
  {
    id: 'dhanmondi',
    name: { en: 'Dhanmondi Lake', bn: 'ধানমন্ডি লেক' },
    tagline: { en: 'Soft morning. Mind the rickshaws.', bn: 'নরম সকাল। রিকশা থেকে সাবধান।' },
    tod: 'morning', weather: 'clear',
    speedMul: 0.72, gap: [3.6, 7], wrongWay: 0.06, time: 70, pickupEvery: 5,
    mix: { rickshaw: 6, bicycle: 3, car: 2, cng: 1 },
    rows: [F, R(-1, 0.9), R(-1, 1.1), M('trees'), R(-1, 1), R(+1, 0.9), R(+1, 1.15), M('trees'), R(+1, 1), R(+1, 1.2), R(+1, 0.9), G],
    hints: true,
  },
  {
    id: 'newmarket',
    name: { en: 'New Market / Nilkhet', bn: 'নিউ মার্কেট / নীলক্ষেত' },
    tagline: { en: 'Late morning. The rickshaw swarm.', bn: 'বেলা বাড়ছে। রিকশার ঝাঁক।' },
    tod: 'lateMorning', weather: 'clear',
    speedMul: 0.8, gap: [3.2, 6], wrongWay: 0.08, time: 70, pickupEvery: 5,
    mix: { rickshaw: 9, van: 2, cng: 2, bicycle: 2, moto: 1, leguna: 1, car: 1 },
    rows: [F, R(-1, 1), R(-1, 0.85), R(-1, 1.15), M('railing'), R(+1, 1), R(+1, 1.2), R(+1, 0.9), M('railing'), R(+1, 1.1), R(+1, 1), R(+1, 1.25), G],
  },
  {
    id: 'shahbagh',
    name: { en: 'Shahbagh', bn: 'শাহবাগ' },
    tagline: { en: 'Noon. Flowers, buses and the metro overhead.', bn: 'দুপুর। ফুল, বাস আর মাথার ওপর মেট্রো।' },
    tod: 'noon', weather: 'clear',
    speedMul: 0.86, gap: [3.0, 5.6], wrongWay: 0.1, time: 75, pickupEvery: 5,
    mix: { rickshaw: 4, bus: 2, car: 2, cng: 2, moto: 2, bicycle: 1, leguna: 1 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), M('metro'), R(-1, 1.1), R(+1, 1), M('flowers'), R(+1, 1.15), R(+1, 0.9), R(+1, 1.2), M('railing'), R(+1, 1), R(+1, 1.1), G],
    overhead: 'metro',
  },
  {
    id: 'farmgate',
    name: { en: 'Farmgate', bn: 'ফার্মগেট' },
    tagline: { en: 'Monsoon downpour. Bus mayhem.', bn: 'বর্ষার ঝুম বৃষ্টি। বাসের তাণ্ডব।' },
    tod: 'rain', weather: 'rain',
    speedMul: 0.9, gap: [2.9, 5.4], wrongWay: 0.12, time: 80, pickupEvery: 5,
    mix: { bus: 4, leguna: 2, cng: 2, car: 2, rickshaw: 3, moto: 2 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), R(-1, 1.1), M('footbridge'), R(-1, 1), R(+1, 1.15), R(+1, 0.9), M('metro'), R(+1, 1.2), R(+1, 1), R(+1, 1.1), R(+1, 0.95), G],
    overhead: 'footbridge',
  },
  {
    id: 'karwanbazar',
    name: { en: 'Karwan Bazar', bn: 'কারওয়ান বাজার' },
    tagline: { en: 'Hazy afternoon. Trucks — and a rail crossing.', bn: 'ধোঁয়াটে বিকেল। ট্রাক — আর রেলক্রসিং।' },
    tod: 'haze', weather: 'haze',
    speedMul: 0.94, gap: [2.8, 5.2], wrongWay: 0.13, time: 85, pickupEvery: 5,
    mix: { truck: 3, pickup: 3, van: 3, cng: 2, rickshaw: 2, bus: 1, car: 1, moto: 1 },
    rows: [F, R(-1, 1), R(-1, 1.15), R(-1, 0.9), M('market'), T(), M('gate'), R(-1, 1), R(+1, 1.1), R(+1, 0.9), R(+1, 1.2), M('railing'), R(+1, 1), R(+1, 1.15), R(+1, 0.9), R(+1, 1.05), G],
    train: { idle: [6, 9], speed: 470 },
  },
  {
    id: 'hatirjheel',
    name: { en: 'Hatirjheel', bn: 'হাতিরঝিল' },
    tagline: { en: 'Golden hour. Hop the water taxis.', bn: 'সোনালি বিকেল। ওয়াটার ট্যাক্সিতে লাফ দাও।' },
    tod: 'golden', weather: 'clear',
    speedMul: 1.0, gap: [2.8, 5.0], wrongWay: 0.15, time: 85, pickupEvery: 5,
    mix: { car: 4, cng: 3, moto: 3, microbus: 2, rickshaw: 1, bus: 1 },
    waterMix: { watertaxi: 3, nouka: 2, hyacinth: 2 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), M('lakeside'), W(+1, 1, { gap: [1.4, 2.6] }), W(-1, 1.2, { gap: [1.4, 2.6] }), W(+1, 0.9, { gap: [1.4, 2.4] }), M('lakeside'), R(+1, 1), R(+1, 1.15), R(+1, 0.9), R(+1, 1.1), G],
    overhead: 'archbridge',
  },
  {
    id: 'mohakhali',
    name: { en: 'Mohakhali', bn: 'মহাখালী' },
    tagline: { en: 'Dusk. Headlights on, trains coming.', bn: 'গোধূলি। হেডলাইট জ্বলছে, ট্রেন আসছে।' },
    tod: 'dusk', weather: 'clear',
    speedMul: 1.0, gap: [2.8, 5.0], wrongWay: 0.16, time: 90, pickupEvery: 5,
    mix: { bus: 4, car: 2, cng: 3, microbus: 2, truck: 1, moto: 2, leguna: 1, rickshaw: 1 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), R(-1, 1.1), M('flyover'), T(), M('gate'), R(-1, 1), R(+1, 1.15), R(+1, 0.95), R(+1, 1.2), M('railing'), R(+1, 1), R(+1, 1.1), R(+1, 0.9), G],
    overhead: 'flyover',
    train: { idle: [5, 8], speed: 520 },
  },
  {
    id: 'gulshan',
    name: { en: 'Gulshan-2 Circle', bn: 'গুলশান-২ গোলচত্বর' },
    tagline: { en: 'Night. Neon, glass and fast cars.', bn: 'রাত। নিয়ন, কাচ আর দ্রুত গাড়ি।' },
    tod: 'night', weather: 'clear',
    speedMul: 1.08, gap: [2.9, 5.0], wrongWay: 0.18, time: 90, pickupEvery: 4.5,
    mix: { car: 6, microbus: 3, moto: 3, cng: 2, pickup: 1, bus: 1 },
    rows: [F, R(-1, 1), R(-1, 1.25), R(-1, 0.9), R(-1, 1.15), M('circle'), R(-1, 1), R(+1, 1.2), R(+1, 0.95), R(+1, 1.1), M('planter'), R(+1, 1.25), R(+1, 1), R(+1, 1.15), R(+1, 0.9), G],
  },
  {
    id: 'motijheel',
    name: { en: 'Motijheel', bn: 'মতিঝিল' },
    tagline: { en: 'Foggy winter morning. Buses everywhere.', bn: 'কুয়াশাভরা শীতের সকাল। চারদিকে বাস।' },
    tod: 'fog', weather: 'fog',
    speedMul: 1.08, gap: [2.6, 4.6], wrongWay: 0.2, time: 95, pickupEvery: 4.5,
    mix: { bus: 7, car: 2, cng: 2, rickshaw: 2, leguna: 2, moto: 2, microbus: 1 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), R(-1, 1.1), M('railing'), R(-1, 1), R(+1, 1.15), R(+1, 0.95), M('shapla'), R(+1, 1.2), R(+1, 1), R(+1, 1.1), M('metro'), R(+1, 0.9), R(+1, 1.2), R(+1, 1.05), G],
    overhead: 'metro',
  },
  {
    id: 'sadarghat',
    name: { en: 'Sadarghat, Old Dhaka', bn: 'সদরঘাট, পুরান ঢাকা' },
    tagline: { en: 'Sunset finale. Cross the Buriganga.', bn: 'সূর্যাস্তের শেষ লড়াই। বুড়িগঙ্গা পার হও।' },
    tod: 'sunset', weather: 'clear',
    speedMul: 1.2, gap: [2.5, 4.4], wrongWay: 0.22, time: 110, pickupEvery: 4.5,
    mix: { rickshaw: 4, van: 2, truck: 4, cng: 3, moto: 3, pickup: 2, bicycle: 1 },
    waterMix: { nouka: 4, launch: 2, hyacinth: 1 },
    rows: [F, R(-1, 1), R(-1, 1.2), R(-1, 0.9), R(-1, 1.1), M('oldDhaka'), R(+1, 1), R(+1, 1.15), R(+1, 0.9), R(+1, 1.2), M('gate'), T(), M('ghat'),
      W(-1, 1, { gap: [1.3, 2.4] }), W(+1, 1.15, { gap: [1.3, 2.4] }), W(-1, 0.9, { gap: [1.3, 2.4] }), W(+1, 1.25, { gap: [1.3, 2.2] }), W(-1, 1.05, { gap: [1.3, 2.4] }), G],
    train: { idle: [5, 8], speed: 540 },
  },
];

// Time-of-day + weather look per level (used by fx.js and the scenery builder).
// tint: colour multiplied over the scene; dark: night darkness 0..1;
// lights: vehicles' headlights on; shadow: [dx, dy, stretch] for drop shadows.
export const TOD = {
  morning:     { sky: ['#9fd3f0', '#f7e4c2'], tint: '#fff4e0', tintA: 0.10, dark: 0,    lights: false, shadow: [5, 2, 1.2], haze: 0.05, sun: '#fff1c4' },
  lateMorning: { sky: ['#7cc4f2', '#e6f2f6'], tint: '#ffffff', tintA: 0,    dark: 0,    lights: false, shadow: [3, 2, 1.0], haze: 0.03, sun: '#ffffff' },
  noon:        { sky: ['#5ab4f0', '#d8eef8'], tint: '#fffbe6', tintA: 0.06, dark: 0,    lights: false, shadow: [0, 3, 0.9], haze: 0.04, sun: '#ffffff' },
  rain:        { sky: ['#4f5d6e', '#8d9aa6'], tint: '#5a7088', tintA: 0.30, dark: 0.12, lights: true,  shadow: [0, 2, 0.8], haze: 0.10, sun: null },
  haze:        { sky: ['#c9b48a', '#e8d6b0'], tint: '#e8c890', tintA: 0.16, dark: 0,    lights: false, shadow: [4, 2, 1.1], haze: 0.18, sun: '#ffe6b0' },
  golden:      { sky: ['#f6a85a', '#ffe0a0'], tint: '#ffb060', tintA: 0.20, dark: 0.04, lights: false, shadow: [14, 2, 2.2], haze: 0.08, sun: '#ffcf7a' },
  dusk:        { sky: ['#3a2c6a', '#f08a5a'], tint: '#8a6ab8', tintA: 0.22, dark: 0.26, lights: true,  shadow: [-8, 2, 1.6], haze: 0.06, sun: '#ff9a6a' },
  night:       { sky: ['#0a0c24', '#2a1a4a'], tint: '#4a4a9a', tintA: 0.22, dark: 0.42, lights: true,  shadow: [0, 2, 0.9], haze: 0.02, sun: null },
  fog:         { sky: ['#c8ccd0', '#e8eaec'], tint: '#d8dee4', tintA: 0.14, dark: 0.04, lights: true,  shadow: [0, 2, 0.8], haze: 0.22, sun: null },
  sunset:      { sky: ['#5a2a6a', '#ff8a3a'], tint: '#ff7a4a', tintA: 0.24, dark: 0.12, lights: true,  shadow: [-16, 2, 2.4], haze: 0.08, sun: '#ff7a3a' },
};
