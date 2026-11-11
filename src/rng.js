// Small seedable random number generator (mulberry32).
// Everything that affects gameplay uses this, so runs are reproducible.

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(a + rng() * (b - a + 1)); // inclusive
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  // Pick a key from a { key: weight } table
  rng.weighted = (table) => {
    let total = 0;
    for (const k in table) total += table[k];
    let r = rng() * total;
    for (const k in table) {
      r -= table[k];
      if (r <= 0) return k;
    }
    return Object.keys(table)[0];
  };
  rng.reseed = (n) => { s = n >>> 0; };
  return rng;
}

// Deterministic hash-based random for art (so scenery looks the same every time
// and doesn't consume the gameplay RNG).
export function artRng(seed) {
  return makeRng(seed * 9301 + 49297);
}
