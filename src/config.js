// Shared constants. The whole game is drawn in a 640×360 "logical" space;
// main.js scales that up to the real screen.

export const W = 640;          // logical width
export const H = 360;          // logical height
export const TILE = 32;        // one grid tile (and one row) in logical pixels
export const COLS = 20;        // playfield columns (20 × 32 = 640)
export const STEP = 1 / 60;    // fixed simulation timestep (seconds)

export const HUD_H = 22;       // height of the top HUD strip

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const MAX_HP = 100;
export const LIFE_EVERY = 5000;      // extra life every N points
export const IFRAMES = 1.2;          // invulnerability after a hit (s)
export const WATER_FALL_DMG = 40;

// Base hop timing (before Speed upgrades)
export const HOP_TIME = 0.13;
export const HOP_COOLDOWN = 0.05;

// Upgrade levelling: pickups needed for each successive level
export const XP_STEPS = [1, 2, 2, 3, 3];
export const BASE_UPGRADE_CAP = 5;

// localStorage keys
export const SAVE_KEY = 'dhakaDash.v1';
