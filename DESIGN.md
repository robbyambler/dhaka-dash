# Dhaka Dash — Game Design Spec

English title: **Dhaka Dash**. Bengali title: **ঢাকা দৌড়** ("Dhaka Dash" — দৌড় = a run, a dash).

A classic lane-crossing arcade game. You are **Rupa (রূপা)**, a university student in a
teal salwar kameez with an orange orna and a backpack, crossing ten of Dhaka's
most chaotic roads on foot.

## 1. Tech

- **Vite + vanilla JavaScript (ES modules) + Canvas 2D.** No game framework. Only
  runtime deps allowed: `@fontsource/*` font packages (bundled, no CDN).
- All art is **procedural pixel art drawn in code** (no downloaded image assets in
  the game). Pre-render sprites to offscreen canvases once and blit them — never
  re-draw vector shapes per frame. Target a locked 60fps on a mid laptop and a phone.
- Internal render resolution **640×360**, scaled up with integer scaling where
  possible, `image-rendering: pixelated`, letterboxed, responsive, DPR-aware.
- Fixed-timestep simulation (60Hz) decoupled from render, with interpolation.
- Works with keyboard (arrows/WASD, P pause, M mute, L language), and touch
  (swipe + tap, plus an on-screen D-pad on touch devices).
- Persist to `localStorage`: language, mute, high score, best NG+ reached.
- `npm run dev`, `npm run build`, `npm run test` (Playwright, see §9).

Suggested layout (keep files focused, plain readable code, commented at a high level):

```
index.html
src/main.js            boot, loop, scaling
src/game.js            state machine: title → levelIntro → playing → levelClear → gameOver → victory
src/player.js          Rupa: grid hop, HP, i-frames, sprites
src/traffic.js         lanes, spawning, vehicle AI, wrong-way logic
src/vehicles.js        vehicle type table + sprite painters
src/levels.js          10 level definitions (data)
src/scenery/*.js       per-level backdrop + roadside painters
src/pickups.js         tea / cookie / daab
src/fx.js              particles, shake, lighting, weather
src/hud.js             HUD + menus
src/i18n.js            EN + BN strings, Bengali numerals
src/audio.js           WebAudio synth SFX + music
src/input.js
tests/
```

## 2. Look: "8/16-bit, polished for 2026"

- **Faux-3D oblique view** (¾ top-down, like a modern "HD-2D"-lite). Every vehicle
  and prop shows a top face AND a side face, has a soft drop shadow, and is
  depth-sorted by Y. Buildings on the far side have visible front facades.
- Chunky pixel sprites with a limited, saturated palette per level — but modern
  finishing: sub-pixel-smooth motion, parallax skyline layers, per-level
  **time of day + weather** (lighting tint overlay, long shadows at golden hour,
  headlight cones and neon glow at night, rain with splashes and wet-road
  reflections, winter fog), dust/exhaust particles, screen shake on hits, hit
  flash, squash-and-stretch hop, floating damage/score numbers, smooth scene
  transitions. Optional subtle scanline/vignette toggle.
- Dhaka must feel **dense and loud**: Bengali signboards stacked on every building,
  tangled overhead wires, tea stalls, fruit carts, hawkers, pedestrians and street
  dogs idling on the footpath, crows, rickshaw-art colors, bus panels with scrapes.
- Signboard text is real Bengali, rendered large enough to read (≥10px bold on the
  640×360 buffer; pre-render signs to offscreen canvases).
- Level is **taller than the screen**; the camera scrolls vertically following
  Rupa. Tile ≈ 32px wide. Playfield 20 columns. Far side of each level is the
  landmark backdrop, revealed as you get close.

Read `docs/dhaka-reference.md` (visual research notes from real photos; being
written in parallel — may not exist for the first several minutes) before painting
level scenery. If it's still missing when you get to scenery, proceed from your
own knowledge and reconcile afterwards.

## 3. Core mechanics (classic lane-crossing rules, with a life bar)

- Grid hops: one tile per input, 4 directions, short hop animation, input buffering.
- Start on the near footpath (bottom). **Goal: reach the far footpath (top).**
- Rows are: footpath, road lanes, medians/dividers (safe), rail tracks, water.
- **HP bar (100)** instead of one-hit death. A vehicle hit deals damage by type
  (§4), knocks Rupa back one tile away from the vehicle's travel direction or
  back toward the start (keep it fair), and grants ~1.2s of blinking i-frames.
- HP ≤ 0 → lose a **life**, respawn at level start with full HP. **3 lives.** No
  lives → Game Over (show score, high score, retry).
- **Water rows** (classic arcade river): Rupa must ride boats / rafts; she moves
  with them. Falling in costs 40 HP and returns her to the last safe row. Being
  carried off-screen counts as falling in.
- **Train rows**: a rail crossing with warning bells, flashing lights and a
  lowering gate animation a few seconds before a long train crosses at high speed.
  Train hit = 100 damage (lose the life).
- Soft level timer: a time bonus counts down; no death at zero.
- Idle pressure is traffic itself; no other enemies.

## 4. Conveyances

Each has its own sprite (2 facings: left/right), size in tiles, base speed, damage:

| Type | Length (tiles) | Speed | Damage |
|---|---|---|---|
| Bicycle | 1 | slow | 8 |
| Pedal rickshaw (colorful hood, rickshaw art) | 1.5 | slow | 12 |
| Rickshaw van / thela cart | 1.5 | very slow | 12 |
| Motorcycle (often 2–3 riders) | 1 | fast | 18 |
| CNG auto-rickshaw (green, caged) | 1.5 | medium | 22 |
| Private car / sedan | 2 | medium-fast | 30 |
| Leguna / human hauler | 2 | medium | 35 |
| Small pickup | 2 | medium | 40 |
| Microbus / ambulance | 2.5 | fast | 45 |
| City bus (battered, colorful, e.g. red BRTC double-decker variant) | 3.5 | medium-fast | 65 |
| Truck / lorry (painted, "Bangladesh" art, loaded high) | 4 | medium | 80 |
| Train | ~14 | very fast | 100 |
| Water: nouka (rowboat), water taxi, launch, hyacinth raft | 2–5 | slow | rideable |

- Lanes have a direction, speed band and a weighted mix of types per level.
- **Wrong-way drivers**: each spawn has a per-level chance (≈6% on level 1 rising
  to ≈22% on level 10, more in NG+) to travel against its lane. Smaller vehicles
  do it most; buses and trucks rarely but memorably. Telegraph it: flashing
  headlights + a "!" honk bubble + horn SFX. Oncoming vehicles must not visually
  pass through each other: use a cosmetic swerve (vehicles shift apart vertically
  within the lane) and/or braking. Collision with Rupa stays row-based and fair.
- Vehicles in the same direction never overlap: followers brake and queue behind
  slower ones (Dhaka jams are welcome), with occasional honking.
- Spawning must never create an impossible wall; guarantee crossable gaps.

## 5. RPG layer

Pickups appear on road tiles and expire after a while:

- **Cha (cup of tea) → Perception XP.** Each Perception level (max 5 per run,
  +1 cap per NG+ cycle) slows vehicles that are above the level's "fast"
  threshold by a further ~7% and adds a faint danger outline to wrong-way
  vehicles at level 3+.
- **Biscuit (cookie) → Speed XP.** Each Speed level (same caps) shortens hop
  duration/cooldown by ~8%.
- **Daab (green coconut)** — rare, heals 30 HP. (Small bonus item.)
- Levelling takes a rising number of pickups (1, 2, 2, 3, 3). Show both stats and
  XP pips in the HUD, with a satisfying level-up flourish. Upgrades persist across
  levels and into New Game+.

## 6. Scoring and lives

- +10 per new furthest row, +50 pickup, +500 level clear, + remaining time bonus,
  + no-damage bonus, × NG+ multiplier.
- **Extra life every 5,000 points, capped at 3 lives.** At the cap, the award
  becomes a full heal + 250 points instead.

## 7. The ten levels

Each has its own palette, time of day, landmark backdrop, lane layout, vehicle
mix, and a one-line intro card ("Level 3 — Shahbagh"). Difficulty ramps via lane
count, speed, density, wrong-way chance. Roughly 8 traffic rows on level 1 up to
~16 on level 10.

1. **Dhanmondi Lake** — soft morning. Leafy residential road, lake + footbridge
   behind, rickshaws, bicycles, a few cars. Tutorial hints.
2. **New Market / Nilkhet** — late morning. Rickshaw swarm, book stalls, New
   Market's arched gate, hawkers, dense signboards.
3. **Shahbagh** — noon. Flower stalls, National Museum, buses; the **Metro
   (MRT-6) viaduct overhead** with a train gliding across periodically.
4. **Farmgate** — **monsoon rain**. Footbridge, bus mayhem, metro station,
   umbrellas, puddle reflections.
5. **Karwan Bazar** — hazy afternoon. Trucks, pickups, vegetable market,
   and the first **rail level-crossing**.
6. **Hatirjheel** — golden hour. Lakeside road + arched bridge; includes a
   **water section** crossed on water taxis.
7. **Mohakhali** — dusk. Flyover overhead, inter-district buses, a rail crossing,
   headlights coming on.
8. **Gulshan-2 Circle** — night, neon and glass towers, fast cars, microbuses,
   Gulshan Lake glimpse.
9. **Motijheel** — foggy winter morning. Office towers, Shapla Chattar fountain
   (water lily monument) as a median, metro terminus, relentless buses.
10. **Sadarghat, Old Dhaka** — sunset finale. Narrow chaos of rickshaws, thela
    carts and trucks, a rail/ghat approach, then the **Buriganga river** crossed
    on noukas and launches to the far bank. Ahsan Manzil (the Pink Palace) on the
    skyline.

## 8. New Game+

Clearing level 10 shows a victory screen, then offers **New Game+**: restart at
level 1 keeping score, upgrades and lives, with NG+ counter N: speeds ×(1+0.12N),
density up, wrong-way chance up, damage ×(1+0.10N), score ×(1+0.5N), upgrade caps
+1 per cycle. Show "NG+N" in the HUD. Unlimited cycles.

## 9. Language

- Full **English / Bengali (বাংলা)** toggle on the title screen, pause menu, and
  the `L` key; switches instantly; persisted. Everything is translated: menus,
  HUD labels, level names, tutorial hints, pickup toasts, game-over/victory copy.
  Bengali mode uses **Bengali numerals** (০১২৩…).
- Fonts (bundled via `@fontsource`): a pixel display face for English (e.g.
  Press Start 2P / Silkscreen) and a bold readable Bengali face (e.g. Baloo Da 2
  or Hind Siliguri). Never show tofu boxes; wait for fonts before first paint.
- In-world signboards stay in Bengali in both languages.

## 10. Audio

WebAudio synth only (no audio files): hop, hit (weight varies by vehicle), horns
(distinct per class), rickshaw bell, train bell + rumble, pickup chime, level-up,
life lost, level clear jingle; a light looping chiptune bed with a Bengali-folk
flavored melody. Mute toggle. Audio starts only after first user gesture.

## 11. Test hooks (required)

Expose `window.__dhaka` in all builds: `{ state(), startLevel(n, opts),
setNgPlus(n), grant({speed, perception, lives, hp, score}), setLang('en'|'bn'),
autoplay(on), stepFrames(n), seed(n) }`. `state()` returns level, ngPlus, hp,
lives, score, upgrades, player tile, row types, vehicle list (type, row, x, dir,
wrongWay, speed), game phase. Seedable RNG so runs are reproducible. `autoplay`
is a simple gap-finding bot used to prove every level is completable.
