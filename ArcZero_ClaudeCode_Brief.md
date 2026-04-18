# ArcZero — Claude Code Implementation Brief

> **Audience:** Claude Code (implementation agent)
> **Source project:** formerly *Missile Maniac*, now **ArcZero**
> **Prerequisite:** read `CLAUDE.md` and the design analysis document before starting any phase.
> **Mode:** prescriptive. Every instruction is a directive, not a suggestion. Do not optimize, refactor, or re-architect beyond what is specified. If a spec is ambiguous, stop and ask — do not guess.

---

## 0. Preamble — rules of engagement

### 0.1 Identity & non-negotiables

- **Game name:** ArcZero (everywhere — title, package.json name, HTML title, CSS classnames allowed to keep their semantic names).
- **Core identity to preserve:** physics-based arc-aim missile interception with gravity-affected projectiles on both sides, a 20m "no-intercept" danger band, clean dark-space aesthetic, deterministic fixed-step simulation.
- **Must not break:** physics integrity (g, dt, integration formulas stay exact), deterministic simulation (fixed 20 Hz tick, all randomness routed through the seeded PRNG), the hold-SPACE-to-charge mechanic as default input.
- **Must not add:** cheesy F2P mechanics (energy timers, gacha, lives that regenerate IRL), ads, tracking beyond self-hosted analytics, any network calls in Phase 0-3.

### 0.2 Conventions (unchanged from CLAUDE.md + additions)

- No globals. All state in `state.js`, passed explicitly.
- Physics logic lives only in `physics.js`.
- Rendering logic lives only in `renderer.js`.
- All tunable numbers in `constants.js`. Level-specific data in `levels.js`. Never hardcode elsewhere.
- New convention: **all randomness must go through `rng.js`** (see Phase 0.3). `Math.random()` is banned outside of `rng.js`. Add an ESLint rule to enforce.
- New convention: **all persistence goes through `persistence.js`**. No direct `localStorage` calls elsewhere. ESLint rule to enforce.
- Commit format: `type(phase): description` (e.g., `feat(phase1): add screen shake on intercept`).

### 0.3 Feature flags (scoped usage)

Add `src/flags.js`:

```js
export const FLAGS = {
  // Risky / physics-adjacent — flip to true when ready to enable
  SCORE_REBALANCE: true,      // Phase 2 — passive 1.0→0.25, base intercept 15→10
  DDA_ENABLED: false,          // reserved for v3; keep false
  SEEDED_RNG: true,            // Phase 0 — deterministic runs
  // Content
  EVENT_MISSILES: true,        // Phase 4 — couriers/splitters/MIRV
  MOBILE_TOUCH: true,          // Phase 4 — touch controls
  // Accessibility
  REDUCE_MOTION: false,        // user setting override
};
```

Everything else (juice, combo, waves, persistence, trajectory preview, launcher redesign, angle flip) ships unflagged — they are pure improvements.

### 0.4 Testing baseline

Every phase adds Vitest unit specs and Playwright E2E specs. Tests run in CI on every commit. Acceptance criteria at phase end must all pass before the next phase starts.

- Unit: `src/**/*.test.js` (Vitest).
- E2E: `tests/e2e/*.spec.js` (Playwright).
- Commands (already in CLAUDE.md): `npm test`, `npm run test:e2e`.

### 0.5 Implementation order

**Phases are sequential. Do not skip or reorder.** Each phase ships a playable, tested build.

- Phase 0 — Foundation (rename, seeded RNG, persistence module, new constants, flip key scaffolding)
- Phase 1 — Moment-to-moment feel (tuning pass, juice, trajectory preview, reload meter, launcher/interceptor redesign, near-miss, launch animation, angle flip)
- Phase 2 — Systems (combo, score rebalance, missile telegraph, wave system, 10-level redesign)
- Phase 3 — Retention (UI persistence, best scores, daily seed, local leaderboard, share payload, milestones)
- Phase 4 — Content & variance (event missiles, mobile touch controls)
- Phase 5 — Optional v2 (modifier deck)

---

## Phase 0 — Foundation

**Goal:** rename the project, introduce deterministic RNG, introduce the persistence module, expand `constants.js` with the new knobs that later phases will use. No visible gameplay change. Shipping this phase produces a game that plays identically to today but is ready for every later change.

### 0.A Rename

- `package.json` → `"name": "arczero"`.
- `index.html` → `<title>ArcZero</title>`, update any visible branding strings.
- `README.md` → replace "Missile Maniac" with "ArcZero" throughout.
- `CLAUDE.md` → update the title line and first paragraph. Keep the rest as-is.
- Git: do not rename the repo in this phase; commit message `chore(phase0): rename to ArcZero`.

### 0.B Seeded PRNG — `src/rng.js`

Create `src/rng.js`:

```js
/**
 * Deterministic PRNG. mulberry32 — 32-bit state, fast, good enough for gameplay.
 * All randomness in the game must route through here.
 */
let _state = 0;

export function seed(s) {
  _state = s >>> 0;
}

export function random() {
  let t = (_state += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomBetween(min, max) {
  return min + random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function pickWeighted(entries) {
  // entries: [[item, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [item, w] of entries) {
    r -= w;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seedFromDateISO(dateISO) {
  return seedFromString('arczero_' + dateISO);
}
```

**Replace all `Math.random()` usage** in:
- `spawner.js` — use `randomBetween` from `rng.js`.
- Anywhere else a grep reveals.

**On game start** in `main.js`:

```js
import { seed } from './rng.js';
// Campaign mode: seed with current time (non-deterministic across sessions, deterministic within a run)
seed(Date.now() & 0xFFFFFFFF);
```

Later phases will re-seed for daily mode.

**ESLint rule:** add `no-restricted-properties` for `Math.random`, exception for `src/rng.js`:

```json
"rules": {
  "no-restricted-properties": ["error", {
    "object": "Math", "property": "random",
    "message": "Use random() from src/rng.js instead."
  }]
}
```

### 0.C Persistence module — `src/persistence.js`

Create `src/persistence.js`:

```js
const STORAGE_KEY = 'arczero.save.v1';
const BOARDS_KEY  = 'arczero.localBoards.v1';

const DEFAULT_SAVE = {
  schemaVersion: 1,
  player: { anonId: null, createdAt: null },
  best: {
    allTime: { score: 0, level: 1, date: null, seed: null },
    perLevel: {},
    longestChain: 0,
    closestMissM: Infinity,
    totalIntercepts: 0,
    totalSurvivedS: 0,
  },
  progress: {
    highestLevelReached: 1,
    unlockedStartLevels: [1],
    sessionsPlayed: 0,
    lastSessionAt: null,
    milestones: {},
  },
  settings: {
    reduceMotion: false,
    soundVolume: 1.0,
    mobileTouchMode: 'auto',
    tapToFire: false,
    colorblindMode: 'off',
    showTrajectoryPreview: true,
  },
  streak: { current: 0, best: 0, lastPlayDateISO: null, shield: true },
  daily:  { lastCompletedDateISO: null, lastScore: 0, lastSeed: null },
};

function generateAnonId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'az_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(target[k] ?? {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = structuredClone(DEFAULT_SAVE);
      fresh.player.anonId = generateAnonId();
      fresh.player.createdAt = Date.now();
      saveSave(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    // Merge to ensure forward-compat fields exist
    return deepMerge(DEFAULT_SAVE, parsed);
  } catch (e) {
    console.warn('Save corrupt, resetting.', e);
    const fresh = structuredClone(DEFAULT_SAVE);
    fresh.player.anonId = generateAnonId();
    fresh.player.createdAt = Date.now();
    saveSave(fresh);
    return fresh;
  }
}

export function saveSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save write failed.', e);
  }
}

export function updateBest(save, runResult) {
  // runResult: { score, level, longestChain, closestMissM, intercepts, survivedS, seed, dateISO }
  const b = save.best;
  let updated = false;
  if (runResult.score > b.allTime.score) {
    b.allTime = { score: runResult.score, level: runResult.level, date: runResult.dateISO, seed: runResult.seed };
    updated = true;
  }
  const lvlBest = b.perLevel[runResult.level] ?? 0;
  if (runResult.score > lvlBest) b.perLevel[runResult.level] = runResult.score;
  if (runResult.longestChain > b.longestChain) b.longestChain = runResult.longestChain;
  if (runResult.closestMissM < b.closestMissM) b.closestMissM = runResult.closestMissM;
  b.totalIntercepts += runResult.intercepts;
  b.totalSurvivedS  += runResult.survivedS;
  save.progress.sessionsPlayed += 1;
  save.progress.lastSessionAt = Date.now();
  if (runResult.level > save.progress.highestLevelReached) {
    save.progress.highestLevelReached = runResult.level;
    if (!save.progress.unlockedStartLevels.includes(runResult.level)) {
      save.progress.unlockedStartLevels.push(runResult.level);
    }
  }
  saveSave(save);
  return updated;
}

// --- Local leaderboards ---

export function loadBoards() {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return { daily: {}, weekly: [], allTime: [] };
    return JSON.parse(raw);
  } catch { return { daily: {}, weekly: [], allTime: [] }; }
}

export function saveBoards(boards) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

export function submitLocalScore(boards, entry) {
  // entry: { anonId, name, score, level, chainBest, durationS, seed, dateISO, inputType, modifiers }
  const bucket = entry.seed ? 'daily' : 'allTime';
  if (bucket === 'daily') {
    boards.daily[entry.seed] = boards.daily[entry.seed] || [];
    boards.daily[entry.seed].push(entry);
    boards.daily[entry.seed].sort((a,b) => b.score - a.score);
    boards.daily[entry.seed] = boards.daily[entry.seed].slice(0, 20);
  } else {
    boards.allTime.push(entry);
    boards.allTime.sort((a,b) => b.score - a.score);
    boards.allTime = boards.allTime.slice(0, 20);
  }
  saveBoards(boards);
}
```

Do not wire this to UI yet — that's Phase 3. This phase only adds the module and its unit tests.

### 0.D Constants expansion — `constants.js`

Add the following to `constants.js` (do not remove any existing constants):

```js
// === Phase 0 foundation ===
export const PHYSICS_VERSION = 1;     // bump when physics changes; never during a daily season
export const SCHEMA_VERSION = 1;      // save file schema
export const GAME_NAME = 'ArcZero';

// === Phase 1 — feel ===
export const SHAKE_AMP_INTERCEPT = 4;       // px
export const SHAKE_DUR_INTERCEPT = 0.18;    // s
export const SHAKE_AMP_DAMAGE = 8;
export const SHAKE_DUR_DAMAGE = 0.30;
export const SHAKE_AMP_GAMEOVER = 14;
export const SHAKE_DUR_GAMEOVER = 0.60;
export const HITSTOP_INTERCEPT = 0.06;      // s
export const FLASH_INTERCEPT = 0.06;
export const FLASH_DAMAGE = 0.08;
export const FLASH_LEVELUP = 0.08;
export const NEAR_MISS_THRESHOLD = 10;      // meters
export const TRAJECTORY_PREVIEW_STEPS = 40; // sim steps for the preview arc
export const TRAJECTORY_PREVIEW_DT = 0.05;  // matches physics dt
export const MUZZLE_FLASH_DUR = 0.08;       // s
export const LAUNCHER_RECOIL_PX = 3;
export const LAUNCHER_RECOIL_DUR = 0.12;    // s

// === Phase 1 — launcher facing (flip) ===
export const FACING_RIGHT = 1;
export const FACING_LEFT = -1;
export const FLIP_KEY = 'z';                 // lowercase; check key.toLowerCase()

// === Phase 2 — combo + scoring ===
export const COMBO_WINDOW_S = 3.0;
export const COMBO_MULT_PER_HIT = 0.25;      // +0.25x per intercept
export const COMBO_MULT_CAP = 8;
export const COMBO_DECAY_DUR_S = 1.0;
export const BASE_INTERCEPT_SCORE_V2 = 10;   // used when SCORE_REBALANCE is on
export const PASSIVE_SCORE_RATE_V2 = 0.25;   // per second when SCORE_REBALANCE is on
export const LEVEL_CLEAR_BONUS = 50;         // × level
export const BONUS_HIGH_ALT_M = 100;
export const BONUS_HIGH_ALT_MULT = 1.25;
export const BONUS_CLUTCH_M = 35;            // intercept y below this (but above MIN_INTERCEPT_ALTITUDE)
export const BONUS_CLUTCH_MULT = 1.5;
export const BONUS_LONG_RANGE_M = 50;        // |impactX - launcherX|
export const BONUS_LONG_RANGE_MULT = 1.2;

// === Phase 2 — telegraph ===
export const SPAWN_TELEGRAPH_EASY_S = 0.7;   // L1-L3
export const SPAWN_TELEGRAPH_HARD_S = 0.5;   // L4+

// === Phase 2 — waves ===
export const WAVE_BUILD_DUR_S = 14;
export const WAVE_PEAK_DUR_S  = 8;
export const WAVE_RELEASE_DUR_S = 8;
export const WAVE_BUILD_SPAWN_MULT = 1.0;
export const WAVE_PEAK_SPAWN_MULT  = 0.6;
export const WAVE_RELEASE_SPAWN_MULT = 1.8;

// === Phase 4 — event missiles ===
export const COURIER_VY_MIN = -50;
export const COURIER_VY_MAX = -35;
export const COURIER_SCORE_MULT = 1.5;
export const SPLITTER_SPLIT_Y = 60;          // when y < this and still alive, split
export const SPLITTER_CHILD_VX = 15;
export const SPLITTER_CHILD_VY = -5;
export const MIRV_SPLIT_AFTER_S = 1.5;
export const MIRV_SPREAD_DEG = 20;
```

### 0.E Angle flip — scaffolding only (implementation in Phase 1)

Add to `state.js` inside the launcher object:

```js
launcher: {
  x: LAUNCHER_START_X,
  y: 0,
  angle: ANGLE_START,
  power: POWER_START,
  charging: false,
  fireCooldown: 0,
  facing: FACING_RIGHT,   // NEW — -1 or +1
  recoilPx: 0,            // NEW — Phase 1 visual
  recoilTimer: 0,         // NEW — Phase 1 visual
  muzzleFlashTimer: 0,    // NEW — Phase 1 visual
}
```

Do not yet use `facing` in input or physics — Phase 1 hooks it up. Just add the fields so save/state is stable.

### 0.F Tests (Phase 0)

**Vitest — `src/rng.test.js`:**

```js
import { describe, it, expect } from 'vitest';
import { seed, random, randomBetween, seedFromString, seedFromDateISO } from './rng.js';

describe('rng', () => {
  it('is deterministic across seeds', () => {
    seed(42);
    const a = [random(), random(), random()];
    seed(42);
    const b = [random(), random(), random()];
    expect(a).toEqual(b);
  });
  it('produces different sequences for different seeds', () => {
    seed(1);
    const a = random();
    seed(2);
    const b = random();
    expect(a).not.toBe(b);
  });
  it('randomBetween stays in range', () => {
    seed(123);
    for (let i = 0; i < 1000; i++) {
      const v = randomBetween(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });
  it('seedFromString is stable', () => {
    expect(seedFromString('hello')).toBe(seedFromString('hello'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
  it('seedFromDateISO is stable', () => {
    expect(seedFromDateISO('2026-04-17')).toBe(seedFromDateISO('2026-04-17'));
  });
});
```

**Vitest — `src/persistence.test.js`:** cover `loadSave` roundtrip, `updateBest` correctness for score/chain/closestMiss, local board insert + sort + cap.

```js
// Use a jsdom environment with mocked localStorage
import { beforeEach, describe, it, expect } from 'vitest';
import { loadSave, updateBest, loadBoards, submitLocalScore } from './persistence.js';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('creates a fresh save on first load', () => {
    const s = loadSave();
    expect(s.schemaVersion).toBe(1);
    expect(s.player.anonId).toMatch(/^az_/);
  });
  it('updates best score only when higher', () => {
    const s = loadSave();
    updateBest(s, { score: 100, level: 1, longestChain: 3, closestMissM: 5, intercepts: 5, survivedS: 30, seed: null, dateISO: '2026-04-17' });
    expect(s.best.allTime.score).toBe(100);
    updateBest(s, { score: 50, level: 1, longestChain: 2, closestMissM: 10, intercepts: 2, survivedS: 10, seed: null, dateISO: '2026-04-17' });
    expect(s.best.allTime.score).toBe(100);
    expect(s.best.longestChain).toBe(3);
    expect(s.best.closestMissM).toBe(5);
  });
  it('caps local boards at 20 entries sorted desc', () => {
    const boards = loadBoards();
    for (let i = 0; i < 30; i++) {
      submitLocalScore(boards, { anonId: 'x', name: 'x', score: i, level: 1, chainBest: 0, durationS: 10, seed: null, dateISO: '2026-04-17', inputType: 'kbd', modifiers: [] });
    }
    expect(boards.allTime.length).toBe(20);
    expect(boards.allTime[0].score).toBe(29);
  });
});
```

**Playwright — `tests/e2e/phase0-smoke.spec.js`:** load the game, verify title is "ArcZero", verify game starts and L1 plays.

### 0.G Acceptance criteria

- [ ] Game renders "ArcZero" in title bar and HTML `<title>`.
- [ ] `Math.random` appears zero times in `src/` outside `src/rng.js` (grep check).
- [ ] `localStorage` read/write appears zero times outside `src/persistence.js` (grep check).
- [ ] `src/rng.test.js` and `src/persistence.test.js` pass.
- [ ] Playwright smoke test passes: game loads, L1 plays, no console errors.
- [ ] Running twice with the same seed produces identical first-5 missile spawn positions (manual or scripted check).

---

## Phase 1 — Moment-to-moment feel

**Goal:** every second of gameplay feels better. Tuning pass, juice, trajectory preview, reload meter, launcher + interceptor art redesign, launch animation, near-miss detection, angle flip.

### 1.A Difficulty curve re-tune (partial — full redesign is Phase 2)

In this phase, apply the L1 retune only as an immediate relief. Full 10-level redesign lands in Phase 2.

In `levels.js`, replace the L1 entry:

```js
// Before
{ label: 'LEVEL 1', spawnInterval: 4.0, missileVyMin: 0, missileVyMax: 0, missileVxRange: 0, maxMissiles: Infinity, scoreThreshold: 100 },
// After
{ label: 'LEVEL 1', spawnInterval: 3.0, missileVyMin: -5, missileVyMax: 0, missileVxRange: 0, maxMissiles: Infinity, scoreThreshold: 60 },
```

### 1.B Juice pass

**State additions (`state.js`):**

```js
state.shake = { amp: 0, dur: 0, elapsed: 0 };
state.flash = { color: null, dur: 0, elapsed: 0 };
state.hitstopRemainingS = 0;
state.stats = { intercepts: 0, shots: 0, nearMisses: 0, closestMissM: Infinity, longestChain: 0, waveStats: [] };
```

**Helpers in `renderer.js`:**

```js
export function triggerShake(state, amp, durS) {
  if (state.settings?.reduceMotion) { amp *= 0.3; }
  state.shake = { amp, dur: durS, elapsed: 0 };
}
export function triggerFlash(state, color, durS) {
  if (state.settings?.reduceMotion) return;
  state.flash = { color, dur: durS, elapsed: 0 };
}
```

**In `gameLoop.js`**, before rendering each tick:

```js
// Shake decay
if (state.shake.dur > 0) {
  state.shake.elapsed += DT;
  if (state.shake.elapsed >= state.shake.dur) state.shake = { amp: 0, dur: 0, elapsed: 0 };
}
// Flash decay
if (state.flash.dur > 0) {
  state.flash.elapsed += DT;
  if (state.flash.elapsed >= state.flash.dur) state.flash = { color: null, dur: 0, elapsed: 0 };
}
// Hitstop gate: skip physics + spawner when hitstopRemainingS > 0
if (state.hitstopRemainingS > 0) {
  state.hitstopRemainingS = Math.max(0, state.hitstopRemainingS - DT);
  // Render only; skip all simulation steps this tick
  render(ctx, state);
  return;
}
```

**In `renderer.js` main `render()`**, at the very start:

```js
const shakeX = state.shake.amp > 0 ? (Math.random()*2-1) * state.shake.amp * (1 - state.shake.elapsed/state.shake.dur) : 0;
const shakeY = state.shake.amp > 0 ? (Math.random()*2-1) * state.shake.amp * (1 - state.shake.elapsed/state.shake.dur) : 0;
ctx.save();
ctx.translate(shakeX, shakeY);
// ... all existing draws ...
ctx.restore();

// Full-screen flash overlay (drawn last, above everything, uses real canvas coords, no translate)
if (state.flash.color && state.flash.dur > 0) {
  const a = (1 - state.flash.elapsed/state.flash.dur) * 0.35;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = state.flash.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
```

Note: shake uses `Math.random()` for visual jitter. This is the **one allowed exception** — visual only, not simulation. Add an ESLint override comment on that line: `// eslint-disable-next-line no-restricted-properties -- visual jitter only`.

**On intercept (`collision.js`):**

```js
// After score += INTERCEPT_SCORE:
triggerShake(state, SHAKE_AMP_INTERCEPT, SHAKE_DUR_INTERCEPT);
triggerFlash(state, '#ffffff', FLASH_INTERCEPT);
state.hitstopRemainingS = HITSTOP_INTERCEPT;
state.stats.intercepts += 1;
```

**On damage:**

```js
triggerShake(state, SHAKE_AMP_DAMAGE, SHAKE_DUR_DAMAGE);
triggerFlash(state, '#ff3535', FLASH_DAMAGE);
```

**On game over (in `gameLoop.js`):**

```js
triggerShake(state, SHAKE_AMP_GAMEOVER, SHAKE_DUR_GAMEOVER);
```

**Audio layering (`audio.js`):**

- Add `playWithPitch(name, variance = 0.15)` that clones the buffer source and randomizes `playbackRate` to `1 + (Math.random()*2-1)*variance`. This is also visual/UX, use `Math.random()` is fine here and add the eslint-disable comment.
- Replace `playIntercept()` internally with `playWithPitch('intercept', 0.15)`.
- Replace `playShoot()` with `playWithPitch('shoot', 0.10)`.
- Add new sound slot `thump` (low-freq thud); play in parallel with intercept. Source: freesound.org or Zapsplat; keep the file name `public/audio/thump.mp3`.

### 1.C Trajectory preview arc

**Current:** `renderer.js` draws a 10-meter dashed guide. **New:** draw the full predicted parabola for the current `angle + power + facing`, until the simulated projectile hits ground or canvas edge.

In `physics.js`, add:

```js
export function simulateTrajectory(startX, startY, vx, vy, maxSteps = TRAJECTORY_PREVIEW_STEPS) {
  const pts = [];
  let x = startX, y = startY, vxi = vx, vyi = vy;
  for (let i = 0; i < maxSteps; i++) {
    x += vxi * TRAJECTORY_PREVIEW_DT;
    y += vyi * TRAJECTORY_PREVIEW_DT + 0.5 * GRAVITY * TRAJECTORY_PREVIEW_DT * TRAJECTORY_PREVIEW_DT;
    vyi += GRAVITY * TRAJECTORY_PREVIEW_DT;
    if (y <= 0 || x < 0 || x > WORLD_WIDTH) break;
    pts.push({ x, y });
  }
  return pts;
}
```

In `renderer.js`, replace `drawTrajectory` with:

```js
function drawTrajectory(ctx, launcher, settings) {
  if (!settings?.showTrajectoryPreview) return;
  const rad = (launcher.angle * Math.PI) / 180;
  const vx = launcher.facing * launcher.power * Math.cos(rad);
  const vy = launcher.power * Math.sin(rad);
  const pts = simulateTrajectory(launcher.x, 0, vx, vy);
  if (pts.length < 2) return;
  ctx.strokeStyle = 'rgba(68, 170, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y));
  ctx.stroke();
  ctx.setLineDash([]);
}
```

Toggleable via `settings.showTrajectoryPreview` (stored in persistence — wire in Phase 3 settings menu). Default: on.

### 1.D Reload meter

In `renderer.js`, when `launcher.fireCooldown > 0`, draw a small arc or horizontal bar under the launcher filling from empty to full as cooldown drains.

```js
function drawReloadMeter(ctx, launcher) {
  if (launcher.fireCooldown <= 0) return;
  const frac = 1 - (launcher.fireCooldown / FIRE_COOLDOWN);
  const cx = toCanvasX(launcher.x);
  const groundY = toCanvasY(0);
  const barW = 40, barH = 3;
  const y = groundY + 6;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cx - barW/2, y, barW, barH);
  ctx.fillStyle = frac > 0.8 ? '#66ff99' : '#ff9944';
  ctx.fillRect(cx - barW/2, y, barW * frac, barH);
}
```

In `input.js`, when SPACE is pressed but `fireCooldown > 0`:

```js
// play a dry-click once per press (debounced)
if (!keys.spaceWasDown) {
  playSound('dryClick', 0.4);   // 40% volume
}
```

Add `public/audio/dry_click.mp3` — short muted click (~50 ms).

### 1.E Launcher art redesign (procedural canvas)

Replace the current grey-rectangle launcher in `renderer.js`:

```js
function drawLauncher(ctx, state) {
  const launcher = state.launcher;
  const cx = toCanvasX(launcher.x);
  const groundY = toCanvasY(0);

  // Recoil offset along barrel axis
  const recoilAmt = launcher.recoilPx * (launcher.recoilTimer / LAUNCHER_RECOIL_DUR);
  const rad = (launcher.angle * Math.PI) / 180;
  const barrelDx = Math.cos(rad) * launcher.facing * recoilAmt;
  const barrelDy = -Math.sin(rad) * recoilAmt;

  // --- Hull (trapezoid) ---
  ctx.fillStyle = '#3a3a4a';
  ctx.strokeStyle = '#6a6a7a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 22, groundY);
  ctx.lineTo(cx + 22, groundY);
  ctx.lineTo(cx + 16, groundY - 10);
  ctx.lineTo(cx - 16, groundY - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Wheels ---
  ctx.fillStyle = '#222230';
  for (const ox of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.arc(cx + ox, groundY - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Dome turret ---
  ctx.fillStyle = '#4a4a5c';
  ctx.strokeStyle = '#7a7a9a';
  ctx.beginPath();
  ctx.arc(cx, groundY - 10, 9, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // --- Status LED ---
  const ready = launcher.fireCooldown <= 0;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
  ctx.fillStyle = ready ? `rgba(102,255,153,${pulse})` : `rgba(255,80,80,${pulse})`;
  ctx.beginPath();
  ctx.arc(cx - 10, groundY - 4, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // --- Barrel (mirrored on facing) ---
  const barrelBaseX = cx + barrelDx;
  const barrelBaseY = groundY - 10 + barrelDy;
  const barrelLen = LAUNCHER_BARREL_LEN;
  const barrelTipX = barrelBaseX + Math.cos(rad) * barrelLen * launcher.facing;
  const barrelTipY = barrelBaseY - Math.sin(rad) * barrelLen;
  ctx.strokeStyle = '#9a9acc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(barrelBaseX, barrelBaseY);
  ctx.lineTo(barrelTipX, barrelTipY);
  ctx.stroke();

  // --- Charge glow ---
  if (launcher.charging) {
    const powerFrac = (launcher.power - POWER_MIN) / (POWER_MAX - POWER_MIN);
    const grd = ctx.createRadialGradient(barrelTipX, barrelTipY, 0, barrelTipX, barrelTipY, 8 + powerFrac * 8);
    grd.addColorStop(0, `rgba(255, ${180 - powerFrac*120}, 50, ${0.6 + 0.3*powerFrac})`);
    grd.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 8 + powerFrac * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Muzzle flash ---
  if (launcher.muzzleFlashTimer > 0) {
    const flashFrac = launcher.muzzleFlashTimer / MUZZLE_FLASH_DUR;
    ctx.fillStyle = `rgba(255, 240, 180, ${flashFrac})`;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 10 * flashFrac, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 200, 80, ${flashFrac * 0.6})`;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 16 * flashFrac, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Facing indicator ---
  ctx.fillStyle = 'rgba(200,220,255,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(launcher.facing === FACING_RIGHT ? '▶' : '◀', cx, groundY + 12);
}
```

Add constant: `export const LAUNCHER_BARREL_LEN = 18;` in `constants.js`.

### 1.F Interceptor art redesign

Replace current circle draw in `renderer.js`:

```js
function drawInterceptor(ctx, interceptor) {
  const cx = toCanvasX(interceptor.x);
  const cy = toCanvasY(interceptor.y);
  const ang = Math.atan2(-interceptor.vy, interceptor.vx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);

  // Halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
  halo.addColorStop(0, 'rgba(100, 200, 255, 0.5)');
  halo.addColorStop(1, 'rgba(100, 200, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.fillStyle = '#4488ff';
  ctx.strokeStyle = '#66ccff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Fin
  ctx.fillStyle = '#66ccff';
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-7, -5);
  ctx.lineTo(-4, -1);
  ctx.moveTo(-4, 3);
  ctx.lineTo(-7, 5);
  ctx.lineTo(-4, 1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Trail (in world coords)
  for (const pt of interceptor.trail ?? []) {
    const a = pt.age / 0.3;
    ctx.fillStyle = `rgba(100, 200, 255, ${0.5 * (1 - a)})`;
    ctx.beginPath();
    ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), 1.5 * (1 - a), 0, Math.PI * 2);
    ctx.fill();
  }
}
```

**Trail update** in `physics.js` per tick:

```js
export function updateInterceptorTrail(interceptor) {
  interceptor.trail = interceptor.trail ?? [];
  interceptor.trail.push({ x: interceptor.x, y: interceptor.y, age: 0 });
  for (const pt of interceptor.trail) pt.age += DT;
  interceptor.trail = interceptor.trail.filter(pt => pt.age < 0.3);
  if (interceptor.trail.length > 10) interceptor.trail.shift();
}
```

Call after `stepPhysics` in `gameLoop.js`.

## 1.F.1 Missile art redesign

**Goal:** replace the current missile art (fins/nose/flame rectangle) with a more menacing, readable silhouette that supports per-kind variants (standard/courier/splitter/mirv from Phase 4), shows altitude-based danger glow, and feels distinct from the friendly interceptor.

### State additions (`state.js`)

Extend `createMissile`:

```js
let _missileIdCounter = 0;
export function createMissile(x, y, vx, vy, kind = 'standard') {
  return {
    id: ++_missileIdCounter,
    x, y, vx, vy, kind,
    alive: true,
    ageS: 0,
    hasSplit: false,
    trail: [],              // NEW — exhaust particles
    wobblePhase: Math.random() * Math.PI * 2,  // NEW — per-missile oscillation seed (visual only)
  };
}
```

### Trail update (`physics.js`)

Add after `stepObject(m)` in `stepPhysics`:

```js
export function updateMissileTrail(missile) {
  missile.trail.push({ x: missile.x, y: missile.y, age: 0 });
  for (const pt of missile.trail) pt.age += DT;
  missile.trail = missile.trail.filter(pt => pt.age < 0.4);
  if (missile.trail.length > 12) missile.trail.shift();
}
```

Call per tick inside `stepPhysics` for each alive missile.

### Constants (`constants.js`)

Add:

```js
// Missile visual
export const MISSILE_BODY_H = 22;
export const MISSILE_BODY_W = 8;
export const MISSILE_NOSE_H = 12;
export const MISSILE_FIN_W  = 7;
export const MISSILE_FIN_H  = 9;
export const MISSILE_DANGER_GLOW_START_M = 40;  // below this altitude, missile starts glowing red

// Per-kind color tables
export const MISSILE_COLORS = {
  standard: { body: '#c82828', stroke: '#ff5555', core: '#ff8844', trail: 'rgba(255,120,60,' },
  courier:  { body: '#e0a820', stroke: '#ffd755', core: '#fff1a0', trail: 'rgba(255,220,100,' },
  splitter: { body: '#8a2ad8', stroke: '#c670ff', core: '#ff88ff', trail: 'rgba(200,120,255,' },
  mirv:     { body: '#d8265a', stroke: '#ff6b9d', core: '#ffa8c0', trail: 'rgba(255,120,170,' },
};
```

### Replace `drawMissile` entirely (`renderer.js`)

```js
function drawMissile(ctx, missile) {
  const cx = toCanvasX(missile.x);
  const cy = toCanvasY(missile.y);
  const colors = MISSILE_COLORS[missile.kind] ?? MISSILE_COLORS.standard;

  // --- Exhaust trail (world coords, behind missile) ---
  for (const pt of missile.trail) {
    const a = pt.age / 0.4;
    const alpha = (1 - a) * 0.7;
    const r = (1 - a) * 2.5;
    ctx.fillStyle = colors.trail + alpha + ')';
    ctx.beginPath();
    ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Rotation to velocity vector (canvas Y flipped) ---
  const angle = Math.atan2(-missile.vy, missile.vx);

  // --- Subtle wobble (visual only, does not affect physics) ---
  const wobble = Math.sin(performance.now() / 120 + missile.wobblePhase) * 0.04;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2 + wobble);

  // --- Danger glow when approaching ground ---
  if (missile.y < MISSILE_DANGER_GLOW_START_M) {
    const glowIntensity = 1 - (missile.y / MISSILE_DANGER_GLOW_START_M);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    grd.addColorStop(0, `rgba(255, 40, 40, ${glowIntensity * 0.6})`);
    grd.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Exhaust flame (behind body) ---
  const flameLen = 8 + Math.sin(performance.now() / 40 + missile.wobblePhase) * 3;
  const flameGrd = ctx.createLinearGradient(0, MISSILE_BODY_H/2, 0, MISSILE_BODY_H/2 + flameLen);
  flameGrd.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
  flameGrd.addColorStop(0.5, 'rgba(255, 120, 40, 0.6)');
  flameGrd.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = flameGrd;
  ctx.beginPath();
  ctx.moveTo(-3, MISSILE_BODY_H/2);
  ctx.lineTo(3, MISSILE_BODY_H/2);
  ctx.lineTo(0, MISSILE_BODY_H/2 + flameLen);
  ctx.closePath();
  ctx.fill();

  // --- Fins (angular, swept back) ---
  ctx.fillStyle = colors.body;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1;
  // Left fin
  ctx.beginPath();
  ctx.moveTo(-MISSILE_BODY_W/2, MISSILE_BODY_H/2 - 2);
  ctx.lineTo(-MISSILE_BODY_W/2 - MISSILE_FIN_W, MISSILE_BODY_H/2 + MISSILE_FIN_H);
  ctx.lineTo(-MISSILE_BODY_W/2, MISSILE_BODY_H/2 - MISSILE_FIN_H * 0.3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Right fin
  ctx.beginPath();
  ctx.moveTo(MISSILE_BODY_W/2, MISSILE_BODY_H/2 - 2);
  ctx.lineTo(MISSILE_BODY_W/2 + MISSILE_FIN_W, MISSILE_BODY_H/2 + MISSILE_FIN_H);
  ctx.lineTo(MISSILE_BODY_W/2, MISSILE_BODY_H/2 - MISSILE_FIN_H * 0.3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // --- Body (main cylinder) ---
  const bodyGrd = ctx.createLinearGradient(-MISSILE_BODY_W/2, 0, MISSILE_BODY_W/2, 0);
  bodyGrd.addColorStop(0, colors.body);
  bodyGrd.addColorStop(0.5, colors.stroke);
  bodyGrd.addColorStop(1, colors.body);
  ctx.fillStyle = bodyGrd;
  ctx.strokeStyle = colors.stroke;
  ctx.beginPath();
  ctx.rect(-MISSILE_BODY_W/2, -MISSILE_BODY_H/2, MISSILE_BODY_W, MISSILE_BODY_H);
  ctx.fill(); ctx.stroke();

  // --- Kind-specific body detail ---
  if (missile.kind === 'courier') {
    // Gold streak lines (speed marks)
    ctx.strokeStyle = 'rgba(255, 241, 160, 0.7)';
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(i * MISSILE_BODY_W/3, -MISSILE_BODY_H/2 + 4);
      ctx.lineTo(i * MISSILE_BODY_W/3, MISSILE_BODY_H/2 - 4);
      ctx.stroke();
    }
  } else if (missile.kind === 'splitter') {
    // Crack/seam pattern (pre-split visual)
    ctx.strokeStyle = 'rgba(255, 136, 255, 0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -MISSILE_BODY_H/2 + 3);
    ctx.lineTo(0, MISSILE_BODY_H/2 - 3);
    ctx.stroke();
    // Horizontal seam
    ctx.beginPath();
    ctx.moveTo(-MISSILE_BODY_W/2, 0);
    ctx.lineTo(MISSILE_BODY_W/2, 0);
    ctx.stroke();
  } else if (missile.kind === 'mirv') {
    // Segmented body (3 bands for the 3 warheads)
    ctx.strokeStyle = 'rgba(255, 168, 192, 0.9)';
    ctx.lineWidth = 0.8;
    for (const y of [-MISSILE_BODY_H/6, MISSILE_BODY_H/6]) {
      ctx.beginPath();
      ctx.moveTo(-MISSILE_BODY_W/2, y);
      ctx.lineTo(MISSILE_BODY_W/2, y);
      ctx.stroke();
    }
  }

  // --- Warhead core (pulsing glow) ---
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 150 + missile.wobblePhase);
  const coreGrd = ctx.createRadialGradient(0, -MISSILE_BODY_H/3, 0, 0, -MISSILE_BODY_H/3, 4);
  coreGrd.addColorStop(0, colors.core);
  coreGrd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = pulse;
  ctx.fillStyle = coreGrd;
  ctx.beginPath();
  ctx.arc(0, -MISSILE_BODY_H/3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // --- Nose cone (sharp, aggressive) ---
  ctx.fillStyle = colors.stroke;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-MISSILE_BODY_W/2, -MISSILE_BODY_H/2);
  ctx.lineTo(MISSILE_BODY_W/2, -MISSILE_BODY_H/2);
  ctx.lineTo(0, -MISSILE_BODY_H/2 - MISSILE_NOSE_H);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // --- Nose tip highlight ---
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(0, -MISSILE_BODY_H/2 - MISSILE_NOSE_H + 2, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
```

### Tests (add to Phase 1 test file)

**Vitest:**

```js
it('createMissile assigns unique id and wobblePhase', () => {
  const m1 = createMissile(10, 150, 0, -5);
  const m2 = createMissile(20, 150, 0, -5);
  expect(m1.id).not.toBe(m2.id);
  expect(m1.trail).toEqual([]);
  expect(typeof m1.wobblePhase).toBe('number');
});
it('missile trail grows and caps at 12 entries', () => {
  const m = createMissile(10, 150, 0, -5);
  for (let i = 0; i < 20; i++) updateMissileTrail(m);
  expect(m.trail.length).toBeLessThanOrEqual(12);
});
it('MISSILE_COLORS has entries for all kinds', () => {
  for (const k of ['standard','courier','splitter','mirv']) {
    expect(MISSILE_COLORS[k]).toBeDefined();
    expect(MISSILE_COLORS[k].body).toMatch(/^#/);
  }
});
```

**Playwright:** spawn a missile via game state, take canvas screenshot at two adjacent ticks, verify pixel diff in the trail area is non-zero (trail is animating).

### 1.G Launch animation

**On fire in `input.js`:**

```js
// In the fire-release handler, after creating the interceptor:
launcher.recoilTimer = LAUNCHER_RECOIL_DUR;
launcher.recoilPx = LAUNCHER_RECOIL_PX;
launcher.muzzleFlashTimer = MUZZLE_FLASH_DUR;
```

**Decay in `gameLoop.js` each tick:**

```js
if (launcher.recoilTimer > 0) launcher.recoilTimer = Math.max(0, launcher.recoilTimer - DT);
if (launcher.muzzleFlashTimer > 0) launcher.muzzleFlashTimer = Math.max(0, launcher.muzzleFlashTimer - DT);
```

**Smoke puff** on fire — push 6 grey particles to `state.particles`:

```js
for (let i = 0; i < 6; i++) {
  state.particles.push({
    x: launcher.x,
    y: LAUNCHER_DRAW_HEIGHT_M,
    vx: (rng.random() * 2 - 1) * 5 * launcher.facing,
    vy: 3 + rng.random() * 4,
    age: 0, maxAge: 0.4,
    color: `rgba(180,180,180,1)`,
    kind: 'smoke',
  });
}
```

Implement generic particle update + render in `renderer.js` + `physics.js`.

### 1.H Near-miss detection

**In `collision.js`**, inside the interceptor × missile inner loop, when a pair does NOT collide:

```js
const d = distance(interceptor, missile);
if (d <= NEAR_MISS_THRESHOLD && d > COLLISION_RADIUS) {
  if (!interceptor._grazes) interceptor._grazes = new Set();
  if (!interceptor._grazes.has(missile.id)) {
    interceptor._grazes.add(missile.id);
    state.stats.nearMisses += 1;
    if (d < state.stats.closestMissM) state.stats.closestMissM = d;
    playSound('graze');
    // Cyan highlight tick — small particle spawn
    state.particles.push({
      x: (interceptor.x + missile.x)/2, y: (interceptor.y + missile.y)/2,
      vx: 0, vy: 0, age: 0, maxAge: 0.25, color: 'rgba(100,220,255,0.9)', kind: 'spark',
    });
  }
}
```

Missiles need a stable `id` — assign on creation in `state.js`:

```js
let _missileIdCounter = 0;
export function createMissile(x, y, vx, vy, kind = 'standard') {
  return { id: ++_missileIdCounter, x, y, vx, vy, kind, alive: true };
}
```

Add `public/audio/graze.mp3` — short whoosh (~200 ms).

### 1.I Angle flip (Z key)

**In `input.js`:**

```js
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === FLIP_KEY) {
    keys.flipPressed = true;
  }
  // ... existing
});
```

**In `processInput`** (called per tick):

```js
if (keys.flipPressed) {
  launcher.facing = (launcher.facing === FACING_RIGHT) ? FACING_LEFT : FACING_RIGHT;
  keys.flipPressed = false;
}
```

**On fire** — modify vx calculation:

```js
const rad = (launcher.angle * Math.PI) / 180;
const vx = launcher.facing * launcher.power * Math.cos(rad);
const vy = launcher.power * Math.sin(rad);
```

(Angle clamp stays [20°, 80°]; physics math simply mirrors via `facing`.)

Add `Z FLIP` to the controls hint in `index.html`:

```html
<div id="controls-hint">← → MOVE &nbsp; ↑ ↓ AIM &nbsp; SPACE FIRE &nbsp; Z FLIP</div>
```

### 1.J Tests (Phase 1)

**Vitest:**

- `physics.simulateTrajectory`: matches a known parabola within epsilon; terminates on ground hit.
- `launcher.facing` flip toggles between ±1; fire produces correctly signed vx.
- `triggerShake` respects reduceMotion setting (amp × 0.3).
- `near-miss`: two objects passing within [COLLISION_RADIUS, NEAR_MISS_THRESHOLD] register exactly one graze.
- `combo` fields present in state (but not yet triggered — that's Phase 2).

**Playwright — `tests/e2e/phase1-juice.spec.js`:**
- Hit an intercept (programmatically), assert that `state.shake.amp > 0` for 2-3 frames.
- Press `Z`, assert `state.launcher.facing === -1`.
- Press SPACE during cooldown, assert no new interceptor appears.
- Verify trajectory dashed line is rendered (DOM/canvas pixel check at predicted arc location).

### 1.K Acceptance criteria

- [ ] All Phase 1 Vitest + Playwright tests pass.
- [ ] Intercept produces: hitstop + shake + flash + particle debris + pitched audio + low thump layer.
- [ ] Launcher visually redesigned: tracked hull + dome + LED + recoil + muzzle flash on fire.
- [ ] Interceptor shows rotated rocket shape + trail + halo.
- [ ] Trajectory preview arc is drawn from barrel tip to ground/edge, dashed, updates live with angle/power/facing.
- [ ] `Z` flips the launcher facing; physics respects it; firing left-works-left, right-works-right.
- [ ] Near-miss increments `state.stats.nearMisses` and plays graze sound exactly once per pair.
- [ ] 90° angle remains unavailable (angle still clamped [20°, 80°] — flip preserves this).
- [ ] `settings.reduceMotion = true` (set manually in code for testing) scales shake down and disables flash.
- [ ] Missile has pointed nose, swept fins, pulsing warhead core.
- [ ] Missile rotates smoothly to face velocity vector.
- [ ] Missile trails particles fading over ~0.4s behind it.
- [ ] Missiles below 40m altitude emit a red danger halo that intensifies toward ground.
- [ ] Each `kind` (standard/courier/splitter/mirv) is visually distinct via color and body detail — this can be verified by force-spawning each kind via dev console.
- [ ] Subtle wobble is visible but does not affect physics (collision/position math uses only x/y/vx/vy, never `wobblePhase`).
- [ ] No performance regression: 10+ missiles on screen still runs at 60 FPS.

### Important notes

- `wobblePhase` and wobble rotation are **rendering-only**. Never read them in `physics.js`, `collision.js`, or `spawner.js`. Physics uses raw `x, y, vx, vy` exclusively.
- `performance.now()` is a real-time value, not deterministic across replays. This is fine because it only affects wobble/pulse visuals, never the simulation. If you ever need deterministic visual replay, replace with `state.totalElapsedS` instead.
- Kind-specific detail rendering (courier streaks, splitter cracks, MIRV segments) uses the `kind` flag. In Phase 1 only `'standard'` exists; Phase 4 wires the other kinds into spawning. The visual code is ready from Phase 1 onward so Phase 4 is purely data.
---

## Phase 2 — Systems

**Goal:** rebuild the score and progression systems; add telegraphs, combo, waves; redesign the level campaign to 10 levels.

### 2.A Combo system

**State additions (`state.js`):**

```js
state.combo = { count: 0, timerS: 0, multiplier: 1.0, best: 0, decaying: false };
```

**On intercept (`collision.js`)** — replace flat `+15`:

```js
if (FLAGS.SCORE_REBALANCE) {
  state.combo.count += 1;
  state.combo.timerS = COMBO_WINDOW_S;
  state.combo.decaying = false;
  state.combo.multiplier = Math.min(1 + state.combo.count * COMBO_MULT_PER_HIT, COMBO_MULT_CAP);
  if (state.combo.count > state.combo.best) state.combo.best = state.combo.count;

  // Skill-play multipliers
  let skillMult = 1.0;
  if (missile.y >= BONUS_HIGH_ALT_M) skillMult *= BONUS_HIGH_ALT_MULT;
  if (missile.y <= BONUS_CLUTCH_M && missile.y >= MIN_INTERCEPT_ALTITUDE) skillMult *= BONUS_CLUTCH_MULT;
  const horizDist = Math.abs(interceptor.x - state.launcher.x);
  if (horizDist >= BONUS_LONG_RANGE_M) skillMult *= BONUS_LONG_RANGE_MULT;

  // Courier bonus (Phase 4 wires this)
  if (missile.kind === 'courier') skillMult *= COURIER_SCORE_MULT;

  const finalScore = Math.round(BASE_INTERCEPT_SCORE_V2 * state.combo.multiplier * skillMult);
  state.score += finalScore;

  // Event floater for UX
  state.floaters = state.floaters ?? [];
  state.floaters.push({
    x: (interceptor.x + missile.x)/2, y: (interceptor.y + missile.y)/2,
    text: `+${finalScore}`, mult: state.combo.multiplier,
    age: 0, maxAge: 0.8,
  });
} else {
  state.score += INTERCEPT_SCORE; // old behavior when flag off
}
```

**Combo decay in `gameLoop.js`:**

```js
if (state.combo.timerS > 0) {
  state.combo.timerS -= DT;
  if (state.combo.timerS <= 0) {
    state.combo.decaying = true;
    state.combo.timerS = 0;
  }
} else if (state.combo.decaying) {
  const step = (COMBO_MULT_CAP - 1) / (COMBO_DECAY_DUR_S / DT);
  state.combo.multiplier = Math.max(1.0, state.combo.multiplier - step);
  if (state.combo.multiplier <= 1.0) {
    state.combo.count = 0;
    state.combo.decaying = false;
  }
}
```

**Render combo badge** (top-right HUD overlay):

```js
function drawComboBadge(ctx, state) {
  if (state.combo.count < 2) return;
  const txt = `×${state.combo.multiplier.toFixed(2)}  ${state.combo.count} CHAIN`;
  ctx.save();
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = state.combo.decaying ? 'rgba(255,180,80,0.8)' : '#ff9944';
  ctx.textAlign = 'right';
  ctx.fillText(txt, canvas.width - 16, 28);
  ctx.restore();
}
```

Render floaters fading upward per tick.

### 2.B Score rebalance (flagged)

In `gameLoop.js`:

```js
const passiveRate = FLAGS.SCORE_REBALANCE ? PASSIVE_SCORE_RATE_V2 : 1.0;
state.score += passiveRate * DT;
```

On level complete:

```js
if (FLAGS.SCORE_REBALANCE) {
  const bonus = LEVEL_CLEAR_BONUS * state.level;
  state.score += bonus;
  state.floaters.push({
    x: 100, y: 100, text: `+${bonus} LEVEL CLEAR`, mult: 1, age: 0, maxAge: 1.5,
  });
}
```

### 2.C Missile telegraph

**Spawn flow change (`spawner.js`):**

```js
export function updateSpawner(state) {
  const cfg = LEVELS[state.level];
  state.spawnTimer += DT;

  // --- Telegraph resolution ---
  state.warnings = state.warnings ?? [];
  for (const w of state.warnings) w.remainingS -= DT;
  const ready = state.warnings.filter(w => w.remainingS <= 0);
  for (const w of ready) {
    if (state.missiles.filter(m => m.alive).length < cfg.maxMissiles) {
      state.missiles.push(createMissile(w.x, WORLD_HEIGHT, w.vx, w.vy, w.kind));
    }
  }
  state.warnings = state.warnings.filter(w => w.remainingS > 0);

  // --- New telegraph spawn ---
  if (state.spawnTimer >= state.currentSpawnInterval) {
    state.spawnTimer = 0;
    const x  = randomBetween(SPAWN_X_MIN, SPAWN_X_MAX);
    const vy = randomBetween(cfg.missileVyMin, cfg.missileVyMax);
    const vx = cfg.missileVxRange ? randomBetween(-cfg.missileVxRange, cfg.missileVxRange) : 0;
    const telegraphS = state.level >= 4 ? SPAWN_TELEGRAPH_HARD_S : SPAWN_TELEGRAPH_EASY_S;
    state.warnings.push({ x, vx, vy, kind: 'standard', remainingS: telegraphS, totalS: telegraphS });
  }
}
```

**Render warnings** at the top of the screen:

```js
function drawWarnings(ctx, state) {
  for (const w of state.warnings ?? []) {
    const frac = 1 - (w.remainingS / w.totalS);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 80);
    ctx.save();
    ctx.fillStyle = `rgba(255, 80, 80, ${0.4 + 0.4 * pulse})`;
    const cx = toCanvasX(w.x);
    ctx.beginPath();
    ctx.moveTo(cx, 12);
    ctx.lineTo(cx - 8, 2);
    ctx.lineTo(cx + 8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
```

### 2.D Wave system (Plan A)

**State additions:**

```js
state.wave = { phase: 'BUILD', elapsedS: 0, index: 0 };
state.currentSpawnInterval = LEVELS[state.level].spawnInterval; // updated per phase
```

**Per-tick update in `gameLoop.js` before `updateSpawner`:**

```js
state.wave.elapsedS += DT;
const phaseDur = {
  BUILD: WAVE_BUILD_DUR_S, PEAK: WAVE_PEAK_DUR_S, RELEASE: WAVE_RELEASE_DUR_S,
}[state.wave.phase];
if (state.wave.elapsedS >= phaseDur) {
  state.wave.elapsedS = 0;
  state.wave.phase = { BUILD: 'PEAK', PEAK: 'RELEASE', RELEASE: 'BUILD' }[state.wave.phase];
  if (state.wave.phase === 'BUILD') state.wave.index += 1;
  if (state.wave.phase === 'PEAK') playSound('wave_warning');
}
const baseInt = LEVELS[state.level].spawnInterval;
const mult = { BUILD: WAVE_BUILD_SPAWN_MULT, PEAK: WAVE_PEAK_SPAWN_MULT, RELEASE: WAVE_RELEASE_SPAWN_MULT }[state.wave.phase];
state.currentSpawnInterval = baseInt * mult;
```

**Level completion** only fires during RELEASE:

```js
// In gameLoop.js level-advance check:
if (state.score >= levelScoreTarget && state.wave.phase === 'RELEASE') {
  advanceLevel(state);
}
```

**Render wave indicator** (3 dots, left HUD):

```js
function drawWaveIndicator(ctx, state) {
  const phases = ['BUILD', 'PEAK', 'RELEASE'];
  const idx = phases.indexOf(state.wave.phase);
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`WAVE ${state.wave.index + 1}`, 16, 48);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === idx ? '#ff9944' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(24 + i*12, 60, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

### 2.E 10-level campaign redesign

Rewrite `levels.js` completely:

```js
export const LEVELS = [
  null, // index 0 unused

  // L1 — Orientation
  { label: 'LEVEL 1 — ORIENTATION', spawnInterval: 3.0, missileVyMin: -5,  missileVyMax: 0,    missileVxRange: 0,   maxMissiles: Infinity, scoreThreshold: 60,  waveCount: 1, tint: '#0a0a1f', intro: 'Learn the arc.' },
  // L2 — First Contact
  { label: 'LEVEL 2 — FIRST CONTACT', spawnInterval: 2.75, missileVyMin: -15, missileVyMax: -5, missileVxRange: 0,   maxMissiles: Infinity, scoreThreshold: 120, waveCount: 2, tint: '#0a0a22', intro: 'They fall faster now.' },
  // L3 — Crosswinds
  { label: 'LEVEL 3 — CROSSWINDS', spawnInterval: 2.5,  missileVyMin: -20, missileVyMax: -10, missileVxRange: 10, maxMissiles: Infinity, scoreThreshold: 200, waveCount: 3, tint: '#0a1028', intro: 'Track the drift.' },
  // L4 — Saturation
  { label: 'LEVEL 4 — SATURATION', spawnInterval: 2.25, missileVyMin: -25, missileVyMax: -10, missileVxRange: 15, maxMissiles: 7,        scoreThreshold: 320, waveCount: 3, tint: '#0f0a2a', intro: 'Prioritize. Or fall.' },
  // L5 — Couriers (event missiles introduced in Phase 4; until then, L5 has fast vy as proxy)
  { label: 'LEVEL 5 — COURIERS', spawnInterval: 2.25, missileVyMin: -30, missileVyMax: -15, missileVxRange: 15, maxMissiles: 8,        scoreThreshold: 450, waveCount: 3, tint: '#1a0a2c', intro: 'Gold streaks. Fast.', eventWeights: { courier: 0.2 } },
  // L6 — Splitters
  { label: 'LEVEL 6 — SPLITTERS', spawnInterval: 2.1, missileVyMin: -28, missileVyMax: -12, missileVxRange: 15, maxMissiles: 9,        scoreThreshold: 620, waveCount: 3, tint: '#220a1f', intro: 'One becomes three.', eventWeights: { splitter: 0.25 } },
  // L7 — MIRV Storm
  { label: 'LEVEL 7 — MIRV STORM',   spawnInterval: 2.0, missileVyMin: -30, missileVyMax: -15, missileVxRange: 18, maxMissiles: 10,       scoreThreshold: 820, waveCount: 3, tint: '#2a0a15', intro: 'Watch the sky fracture.', eventWeights: { mirv: 0.20 } },
  // L8 — Blackout
  { label: 'LEVEL 8 — BLACKOUT',   spawnInterval: 2.0, missileVyMin: -30, missileVyMax: -15, missileVxRange: 18, maxMissiles: 10,       scoreThreshold: 1050, waveCount: 3, tint: '#18081a', intro: 'Trust the feel.', forceTrajectoryOff: true },
  // L9 — Onslaught
  { label: 'LEVEL 9 — ONSLAUGHT', spawnInterval: 1.9, missileVyMin: -32, missileVyMax: -15, missileVxRange: 20, maxMissiles: 10,       scoreThreshold: 1320, waveCount: 3, tint: '#280828', intro: 'All of it. At once.', eventWeights: { courier: 0.15, splitter: 0.15, mirv: 0.10 } },
  // L10 — Endless
  { label: 'LEVEL 10 — ENDLESS',  spawnInterval: 1.8, missileVyMin: -35, missileVyMax: -15, missileVxRange: 22, maxMissiles: 12,       scoreThreshold: Infinity, waveCount: Infinity, tint: '#000', intro: 'How long can you last?', eventWeights: { courier: 0.18, splitter: 0.18, mirv: 0.12 }, escalatesPeak: true },
];
```

**Per-level background tint:** in `renderer.js` fill with `LEVELS[state.level].tint` instead of `COLOR_BG`.

**Level intro text:** display under the "LEVEL N" overlay title for 2s.

**L8 trajectory override:** in renderer, `if (LEVELS[state.level].forceTrajectoryOff) skipTrajectory()`.

**L10 endless ramp:** every completed wave increases `LEVELS[10].missileVyMin` by 1 (capped at -60) and decreases `spawnInterval` by 0.02 (capped at 1.2). Reset on death.

### 2.F Tests (Phase 2)

**Vitest:**

- Combo multiplier caps at 8×; resets after WINDOW expires + decay completes.
- Skill multipliers stack correctly (high-alt + long-range × combo).
- Wave phase cycle: BUILD→PEAK→RELEASE→BUILD at exact timer thresholds.
- Telegraph warning becomes a missile after `telegraphS` elapses, at same x.
- Level completion does not fire during BUILD or PEAK, only RELEASE.
- LEVELS array has 10 entries + index 0 null; thresholds monotonically increasing except L10 (Infinity).

**Playwright:**

- Play through L1 to L2 transition; verify it occurs only during RELEASE wave phase.
- Kill a missile, verify combo count increments on HUD.
- Wait 3+ seconds without intercepting, verify combo decays and resets.

### 2.G Acceptance criteria

- [ ] Combo badge appears at count ≥ 2, shows multiplier, fades on decay.
- [ ] Skill multipliers verified on test runs (high-alt, clutch, long-range).
- [ ] Wave indicator (3 dots) updates correctly; PEAK plays warning sound.
- [ ] Missiles now telegraph via red arrow at top of screen for 0.5-0.7s.
- [ ] Level up lands during RELEASE only.
- [ ] 10 levels loaded; background tint changes per level; intro text displays.
- [ ] L8 disables trajectory preview; L10 is infinite.
- [ ] Score with `SCORE_REBALANCE=true` is 60-75% lower than old build on the same run (passive dropped, base dropped, but combo recovers skill runs).

---

## Phase 3 — Retention

**Goal:** the game now teaches players to return. Main menu, best scores, daily seed, local leaderboard, share payload, milestone toasts.

### 3.A Main menu

Create a menu overlay that appears on first load. Options:
- **Play Campaign** — start at L1, campaign mode (non-seeded).
- **Daily Challenge** — today's seed, one scored attempt.
- **Level Select** — scroll list of unlocked levels (from `save.progress.unlockedStartLevels`). Starting mid-campaign flags the run `unranked: true`.
- **Leaderboards** — view daily / weekly / all-time local boards.
- **Settings** — reduceMotion toggle, audio volume, trajectoryPreview toggle, colorblindMode.
- **Credits** — one line; attribution to sound sources.

DOM-based overlay (not canvas). Use `<dialog>` or `<div class="menu-overlay">`. Menu state in `state.js`:

```js
state.menuOpen = true;       // start true
state.menuScreen = 'main';   // 'main' | 'levelSelect' | 'leaderboards' | 'settings'
state.mode = 'campaign';     // 'campaign' | 'daily' | 'practice'
```

Game loop gates on `!state.menuOpen`.

### 3.B Best score prompt on game over

In `renderer.js` game-over overlay:

- Count up score from 0 to final, 800 ms duration, ease-out.
- Draw a "PB" marker at previous best.
- When the counter crosses PB, trigger hitstop (animation freeze 100 ms), flash gold, particle burst.
- Bottom line: "NEW BEST!" if exceeded, else `"−${pb - score} from best"`.
- Additional stats: `CLOSEST MISS: X.Xm`, `LONGEST CHAIN: N`.

On game over in `gameLoop.js`:

```js
const save = loadSave();
const result = {
  score: Math.floor(state.score),
  level: state.level,
  longestChain: state.combo.best,
  closestMissM: state.stats.closestMissM,
  intercepts: state.stats.intercepts,
  survivedS: state.totalElapsedS,
  seed: state.mode === 'daily' ? state.seed : null,
  dateISO: new Date().toISOString().slice(0,10),
};
const isPB = updateBest(save, result);
state.lastRun = { ...result, isPB };
if (state.mode === 'daily') {
  const boards = loadBoards();
  submitLocalScore(boards, { anonId: save.player.anonId, name: save.player.displayName ?? 'you', ...result, inputType: state.inputType ?? 'kbd', modifiers: [] });
}
```

### 3.C Daily seed mode

On "Daily Challenge" menu selection:

```js
const dateISO = new Date().toISOString().slice(0,10);
const dailySeed = seedFromDateISO(dateISO);
seed(dailySeed);
state.mode = 'daily';
state.seed = dailySeed;
state.dateISO = dateISO;
// Check if already completed today
const save = loadSave();
if (save.daily.lastCompletedDateISO === dateISO) {
  showToast(`You've already played today (${save.daily.lastScore}). Tomorrow's seed unlocks at midnight.`);
  // Allow unlimited practice but mark unranked
  state.unranked = true;
}
```

Daily mode: always starts at L1 regardless of unlocks; must not be modified mid-run (no DDA, no level select interrupts).

### 3.D Local leaderboard UI

Menu screen "Leaderboards" — three tabs: Daily / Weekly / All-Time.
- Daily: show today's seed's top 20; highlight the player's entry in cyan; always show ±5 around the player if they're not top 5.
- Weekly: collect across 7 daily seeds, aggregate top scores.
- All-Time: campaign mode scores (no seed).

Data comes from `loadBoards()`.

### 3.E Share payload

On game over in daily mode, add a "Share result" button. Clicking it copies to clipboard:

```
ArcZero · Daily 2026-04-17
Score 847 · Lv 5 · Chain ×11 · Closest 2.3m
🟩🟩🟨🟩⬛🟩🟨🟨⬛⬛
arczero.app/?seed=2026-04-17
```

**Emoji grid logic:** 10 tiles representing 10 waves survived (or fewer if died earlier). Color by wave-level accuracy:
- 🟩 green: ≥80% intercept rate that wave
- 🟨 yellow: 50-79%
- 🟧 orange: 30-49%
- ⬛ black: <30% or wave not reached

Per-wave stats captured in `state.stats.waveStats[]` during play.

Implementation in `src/share.js`:

```js
export function buildShareText(runResult, waveStats) {
  const grid = Array.from({length:10}, (_, i) => {
    const w = waveStats[i];
    if (!w) return '⬛';
    const acc = w.intercepts / Math.max(1, w.spawns);
    if (acc >= 0.8) return '🟩';
    if (acc >= 0.5) return '🟨';
    if (acc >= 0.3) return '🟧';
    return '⬛';
  }).join('');
  return [
    `ArcZero · Daily ${runResult.dateISO}`,
    `Score ${runResult.score} · Lv ${runResult.level} · Chain ×${runResult.longestChain} · Closest ${runResult.closestMissM.toFixed(1)}m`,
    grid,
    `arczero.app/?seed=${runResult.dateISO}`
  ].join('\n');
}
```

### 3.F Milestones + streak

Define milestones in `src/milestones.js`:

```js
export const MILESTONES = [
  { id: 'first_intercept',    condition: s => s.stats.intercepts >= 1, toast: 'First blood.' },
  { id: 'ten_intercepts',     condition: s => s.stats.intercepts >= 10, toast: '10 down.' },
  { id: 'hundred_intercepts', condition: s => s.best.totalIntercepts >= 100, toast: 'A centurion.' },
  { id: 'minute_survived',    condition: s => s.totalElapsedS >= 60, toast: 'One minute.' },
  { id: 'first_level_up',     condition: s => s.level >= 2, toast: 'You climb.' },
  { id: 'reach_l5',           condition: s => s.best.allTime.level >= 5, toast: 'Halfway.' },
  { id: 'reach_l10',          condition: s => s.best.allTime.level >= 10, toast: 'The endless.' },
  { id: 'chain_5',            condition: s => s.combo.best >= 5, toast: '×5 chain.' },
  { id: 'chain_10',           condition: s => s.combo.best >= 10, toast: '×10 chain. Machine.' },
  { id: 'daily_first',        condition: s => s.save.daily.lastCompletedDateISO !== null, toast: 'First daily done.' },
  { id: 'streak_3',           condition: s => s.save.streak.current >= 3, toast: '3-day streak.' },
  { id: 'streak_7',           condition: s => s.save.streak.current >= 7, toast: 'A week of fire.' },
];
```

**Check on game over** + **check per intercept**. Mark in `save.progress.milestones[id] = true`. Toast shows for 3 s (non-blocking, top-center).

**Streak:** if daily completed today and `yesterday ≤ lastPlayDateISO ≤ today`, `current += 1`; else if gap > 1 day and shield unused, consume shield; else reset to 1.

### 3.G Backend scaffolding (documented, not implemented)

Create `docs/backend-api.md` describing the REST endpoints for v2 (from analysis §8.4). Do NOT implement yet.

### 3.H Tests (Phase 3)

**Vitest:**
- `buildShareText` produces correct grid from waveStats samples.
- Milestone triggers: only fires once per save; persists across runs.
- Streak logic: 3-day streak, then skip day with shield → continues; without shield → resets.
- Daily seed produces identical spawn sequence across two runs on same date.
- PB detection: fires on exceeding, not tying.

**Playwright:**
- Menu flow: start → Daily → play → game over → Share button copies to clipboard.
- Level select respects unlocked levels only.
- Settings: toggling trajectoryPreview persists after reload.
- Milestone toast appears on first intercept, does not re-appear on second run.

### 3.I Acceptance criteria

- [ ] Main menu functional with 5 options.
- [ ] Campaign and Daily modes both playable.
- [ ] PB prompt with count-up + flash + particle on new best.
- [ ] Local leaderboard shows daily/weekly/all-time entries.
- [ ] Share button copies correctly-formatted text to clipboard.
- [ ] Milestones trigger on first-time events; persist after reload; toast non-blocking.
- [ ] Streak tracks across 3+ sequential days (simulate by changing date in save).
- [ ] Settings persist across reloads (reduceMotion, trajectoryPreview, audio volume, colorblindMode).

---

## Phase 4 — Content & variance

**Goal:** event missile types and mobile touch controls.

### 4.A Event missiles

**Missile `kind` values:** `'standard' | 'courier' | 'splitter' | 'mirv'`.

**Spawn selection** in `spawner.js`:

```js
function pickMissileKind(state) {
  const weights = LEVELS[state.level].eventWeights ?? {};
  const entries = [['standard', 1 - Object.values(weights).reduce((a,b) => a+b, 0)]];
  for (const [kind, w] of Object.entries(weights)) entries.push([kind, w]);
  return pickWeighted(entries);
}
```

**Courier:** on spawn, `vy = randomBetween(COURIER_VY_MIN, COURIER_VY_MAX)`. Gold color render. Intercept multiplier `×1.5` applied in combo handler.

**Splitter:** standard spawn. When `missile.y <= SPLITTER_SPLIT_Y && missile.alive`, spawn two child missiles at current position with `vx = ±SPLITTER_CHILD_VX, vy = SPLITTER_CHILD_VY`. Mark parent destroyed. Children are `kind: 'standard'`. Does NOT deal damage — the split is the threat. Add `missile.hasSplit` flag to prevent repeated splits.

**MIRV:** standard spawn. After `MIRV_SPLIT_AFTER_S` seconds (track `missile.ageS`), split into 3 missiles. Split direction: base velocity rotated by `[-MIRV_SPREAD_DEG, 0, +MIRV_SPREAD_DEG]`. Children are `kind: 'standard'`.

**In `physics.js`**, add to `stepPhysics`:

```js
for (const m of state.missiles) {
  if (!m.alive) continue;
  m.ageS = (m.ageS ?? 0) + DT;
  stepObject(m);
  // MIRV split
  if (m.kind === 'mirv' && !m.hasSplit && m.ageS >= MIRV_SPLIT_AFTER_S) {
    m.hasSplit = true;
    const baseAng = Math.atan2(m.vy, m.vx);
    const speed = Math.hypot(m.vx, m.vy);
    for (const offsetDeg of [-MIRV_SPREAD_DEG, 0, +MIRV_SPREAD_DEG]) {
      const a = baseAng + offsetDeg * Math.PI / 180;
      state.missiles.push(createMissile(m.x, m.y, Math.cos(a)*speed, Math.sin(a)*speed, 'standard'));
    }
    m.alive = false;
  }
  // Splitter split
  if (m.kind === 'splitter' && !m.hasSplit && m.y <= SPLITTER_SPLIT_Y && m.y > MIN_INTERCEPT_ALTITUDE) {
    m.hasSplit = true;
    state.missiles.push(createMissile(m.x, m.y, -SPLITTER_CHILD_VX, SPLITTER_CHILD_VY, 'standard'));
    state.missiles.push(createMissile(m.x, m.y, +SPLITTER_CHILD_VX, SPLITTER_CHILD_VY, 'standard'));
    m.alive = false;
  }
}
```

**Render** per-kind colors in `drawMissile`:

```js
const colorByKind = {
  standard: '#ff4444',
  courier:  '#ffcc33',
  splitter: '#aa44ff',
  mirv:     '#ff6b9d',
};
```

### 4.B Mobile touch controls

Create `src/touchInput.js`:

```js
export function initTouchInput(canvas, state, keys) {
  let dragging = false;
  let dragStart = null;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = (t.clientX - rect.left) / rect.width * WORLD_WIDTH;
    const ty = (1 - (t.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
    dragging = true;
    dragStart = { x: tx, y: ty };
    state.launcher.charging = true;
    // Auto-face toward touch
    state.launcher.facing = tx < state.launcher.x ? FACING_LEFT : FACING_RIGHT;
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = (t.clientX - rect.left) / rect.width * WORLD_WIDTH;
    const ty = (1 - (t.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
    // Launcher x follows touch x, clamped
    state.launcher.x = Math.max(LAUNCHER_X_MIN, Math.min(LAUNCHER_X_MAX, tx));
    // Angle from launcher to touch
    const dx = tx - state.launcher.x;
    const dy = ty;
    let ang = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
    state.launcher.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, ang));
    // Power from drag distance
    const dragDist = Math.hypot(tx - dragStart.x, ty - dragStart.y);
    state.launcher.power = Math.max(POWER_MIN, Math.min(POWER_MAX, POWER_MIN + dragDist * 2));
  });

  canvas.addEventListener('touchend', (e) => {
    if (!dragging) return;
    e.preventDefault();
    dragging = false;
    // Simulate space release
    keys.spaceJustReleased = true;
    state.launcher.charging = false;
    state.inputType = 'touch';
  });
}
```

**Responsive canvas:** in `index.html`/CSS, when `window.innerWidth < 768`, canvas fills viewport with letterboxing. Detect portrait orientation and show "rotate device" prompt or force-reflow for portrait (16:12 aspect → 3:4 with HUD stacked).

**Settings**: `save.settings.mobileTouchMode` values `'auto' | 'on' | 'off'`. Auto detects `ontouchstart`.

### 4.C Tests (Phase 4)

**Vitest:**
- `pickWeighted` distributes correctly over many trials.
- MIRV splits at exact `MIRV_SPLIT_AFTER_S`; produces 3 children with correct angles.
- Splitter splits only once; only below `SPLITTER_SPLIT_Y`; not in danger zone.
- Courier `vy` falls in range.

**Playwright:**
- Simulate touch events, verify launcher angle/power/facing update.
- L5 run: at least one courier spawns within 60 s (statistical — run long enough).

### 4.D Acceptance criteria

- [ ] Couriers visible as gold missiles on L5+; intercepts score ×1.5.
- [ ] Splitters split once below y=60, producing two downward-spreading children.
- [ ] MIRVs split at ~1.5s age into 3 spread children.
- [ ] Touch input: drag on canvas aims + charges; release fires.
- [ ] Portrait mobile view scales canvas; HUD reflows.
- [ ] Leaderboard entries tagged with `inputType: 'touch'`.

---

## Phase 5 — Optional v2 (modifier deck)

Defer until Phase 4 ships and is validated in the wild for at least 2 weeks. Full spec lives in the analysis document §7 Plan C. Implementation pattern:

- New `src/modifiers.js` with pool of 12 modifier definitions, each implementing hooks: `onSpawnMissile(m)`, `onPhysicsStep(obj)`, `onFire(interceptor)`, `onIntercept(combo)`, `scoreMultiplier()`.
- Between levels: show 3 cards drawn from pool; player picks 1.
- Daily seed draws modifier choices deterministically.

Skip details here — Phase 4 must validate before this lands.

---

## Appendix A — Audio sourcing checklist

Claude Code must NOT download files. The project owner will place audio files in `public/audio/`. The code must gracefully degrade if a file is missing (existing `audio.js` already does this via the catch block in `loadBuffer`).

Required new files (project owner task):

| File | Source | Notes |
|---|---|---|
| `thump.mp3`         | freesound.org "low thud" | ~200ms, layer under intercept |
| `graze.mp3`         | freesound.org "whoosh short" | ~200ms |
| `dry_click.mp3`     | Zapsplat UI packs | ~50ms, muted click |
| `combo_up.mp3`      | Zapsplat game UI | ~150ms rising blip |
| `milestone.mp3`     | freesound.org chime | ~400ms short chime |
| `wave_warning.mp3`  | freesound.org alarm | ~500ms low siren |
| `ambient_loop.mp3`  | pixabay music CC0 | Seamless loop, space drone |

All licenses must be CC0 or permissive commercial use. Add `public/audio/ATTRIBUTION.md` listing sources.

---

## Appendix B — Grep checklist (pre-merge verification)

Run these as part of CI:

```bash
# No Math.random outside rng.js and explicit eslint-disable lines
rg "Math\.random" src/ --glob '!src/rng.js' | rg -v 'eslint-disable'

# No direct localStorage outside persistence.js
rg "localStorage" src/ --glob '!src/persistence.js'

# No hardcoded magic numbers in game logic (audit manually per PR)
# No hardcoded strings for GAME_NAME
rg "Missile Maniac" src/
```

All three should produce zero matches.

---

## Appendix C — Development loop

For each phase:

1. Read the phase spec fully.
2. Implement changes in the order listed (each sub-section is sequential).
3. Run `npm run lint` — fix all issues.
4. Run `npm test` — all Vitest specs must pass.
5. Run `npm run test:e2e` — all Playwright specs must pass.
6. Manual smoke test: play for 2+ minutes, exercise every new feature.
7. Commit with `feat(phaseN): <subsection>` granularity (one commit per sub-section, not one per phase).
8. Verify acceptance criteria checklist.
9. Only then move to next phase.

If any acceptance criterion fails, STOP. Do not proceed to the next phase. Ask the project owner for clarification or a scope adjustment.

---

## Appendix D — What NOT to do

- Do NOT remove the hold-SPACE-to-charge mechanic. Tap-to-fire is additive, opt-in.
- Do NOT expand `ANGLE_MAX` past 80°. The flip system preserves the 90° deadzone by design.
- Do NOT change `GRAVITY`, `DT`, or the integration formula in `physics.js`.
- Do NOT replace the fixed-timestep loop with a variable-step one.
- Do NOT add network calls in Phases 0-4.
- Do NOT add analytics or tracking SDKs.
- Do NOT pull in UI frameworks (React, Vue, etc.) for the game core. `CLAUDE.md` states "No `any`, no framework imports in game core."
- Do NOT rename files other than as specified.
- Do NOT delete existing tests without explicit instruction; tests that test old behavior must be updated, not removed.
- Do NOT commit `.env` or any files containing secrets.

---

*End of brief. Begin Phase 0.*
