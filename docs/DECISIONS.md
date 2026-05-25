# ArcZero — Locked Decisions & Workflow Rules

Read this before making a structural change. These decisions are settled; re-litigating them costs time without benefit.

---

## Locked Decisions

### World Geometry
- Portrait world = device-conditional constants: 100×150m on `(pointer: coarse)`, 200×150m otherwise.
- `IS_PORTRAIT` evaluated once at module load in `constants.js`. No other file calls `window.matchMedia`.
- `bootstrap()` emits `data-portrait="true"` on `<body>`; portrait CSS keys off that attribute. Do not use an orientation media query for canvas sizing.

### Level Config Source of Truth
- `DESKTOP_LEVELS` in `levels.js` is the single source. Portrait configs derived via `toPortraitLevel` (vx ×0.5, maxMissiles ÷2 with floor 4).
- Never duplicate level tuning; never edit portrait configs directly. Edit `DESKTOP_LEVELS` only.

### Leaderboard Architecture
- **CrazyGames leaderboard** is the cross-player competitive surface — metric = Daily score, `POINTS/DESC`, weekly seasons, portal build only.
- **Campaign and Level Select** stay local-only (localStorage). No global leaderboard planned for these modes.
- Own-domain build is ad-free/pristine; portal build (`MODE === 'portal'`) enables CrazyGames SDK, guarded by `src/crazygames.js`.

### Dual Build
- Own-domain: `npm run build` → base path `/`; no CrazyGames SDK.
- Portal: `npm run build:portal` → includes CrazyGames SDK integration; SDK calls gated by `MODE === 'portal'`.

### Asset Paths
- All audio URLs use `AUDIO_BASE = ${import.meta.env.BASE_URL}audio/` in `audio.js`. Root-absolute `/audio/` paths break subpath deploys.
- Favicon `<link>` hrefs in `index.html` use relative paths (no leading slash) so Vite rewrites them under the base path.

### physicsVersion Gap (Pending)
- `PHYSICS_VERSION = 1` exists in `constants.js` but is **not** in `buildRunResult`.
- Before backend integration: add via a `toApiPayload(runResult)` mapper that appends `physicsVersion` from the constant. Do NOT add it to `buildRunResult` directly — that struct is the persistence integration boundary (additive-only, no renames without migration).
- Document the gap in `docs/backend-api.md` until resolved.

---

## Workflow Rules

### 1. PHYSICS_VERSION Bump Rule
Bump `PHYSICS_VERSION` in `constants.js` when ANY of these change:
- `GRAVITY`, `DT`, `COLLISION_RADIUS`, `MIN_INTERCEPT_ALTITUDE`
- `stepObject` in `physics.js`
- `checkCollisions` in `collision.js`

Never bump mid-season (while a Daily is in progress for the current UTC date).

### 2. buildRunResult / Contract Test Gate
Contract tests (`tests/contract.test.js`) must pass before merging anything touching:
- `buildRunResult` in `gameLoop.js`
- `updateBest` in `persistence.js`
- `loadSave` in `persistence.js`

`buildRunResult` is the integration boundary between the game loop and persistence/leaderboard. It is **additive-only**: add fields, never rename or remove without a migration. Current fields (verified 2026-05-24):
`score`, `levelScore`, `level`, `startLevel`, `rankingMode`, `longestChain`, `closestMissM` (Infinity→null), `intercepts`, `survivedS`, `waveStats`, `seed`, `dateISO`, `criteriaCleared`.

### 3. Randomness Routing
All simulation randomness routes through `rng.js` (mulberry32 seeded PRNG). `Math.random()` is banned by ESLint rule. Visual-only jitter (particle position, spark scatter) may use `Math.random()` with an `// eslint-disable-line no-restricted-properties` comment explaining the visual-only reason.

### 4. Daily Seed Immutability
The Daily seed is derived from the UTC calendar date and is immutable for that date. Even a confirmed bug fix to `rng.js`, `spawner.js`, or spawn constants must wait for the next UTC midnight before deploying if a Daily run is in progress. Mid-day seed changes break the "same spawns for all players" guarantee.

### 5. Before Backend Integration Checklist
- [ ] Add `physicsVersion` to `buildRunResult` via `toApiPayload(runResult)` mapper.
- [ ] Audit `docs/backend-api.md` — field names must match mapper output exactly.
- [ ] Backend derives daily seed server-side from `dateISO`; never trusts client `seed` value.
- [ ] `physicsVersion` mismatch → reject submission (prevents modified-physics exploits).

---

## Known Reality (Not Bugs to Fix Here)

- `closestMissM` round-trips `Infinity → null` through `buildRunResult` (intentional: JSON can't encode Infinity). `updateBest` in `persistence.js` treats `null` as "no data" and skips comparison. `DEFAULT_SAVE` stores `Infinity` in memory; `JSON.stringify` converts it to `null` in localStorage. This is correct behavior.
- `PHYSICS_VERSION` is not in `buildRunResult` — documented above as a future step.
