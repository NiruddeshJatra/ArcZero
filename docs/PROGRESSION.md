# Game Progression System

## Overview

ArcZero features a tiered progression system with three distinct game modes: **Campaign**, **Daily**, and **Level Select**. Each mode progresses through 10 levels with increasingly difficult missile patterns, but with fundamentally different rules about scoring, advancement, and unlocking.

This document is the authoritative reference for level unlock gates, advancement mechanics, per-level scoring, and mode differences. All progression state lives in `save.progress` and `save.best` (persisted via `persistence.js`); advancement logic is in `gameLoop.js` (lines 228–264).

---

## Game Modes

### Campaign
**`rankingMode = 'campaign'`** — All-time ranked progression.

**Characteristics:**
- Always starts at Level 1. Score carries across all levels in a single run.
- Advances through Levels 1–10. All intercepts, wave clears, and kills contribute to a cumulative score.
- **Advances only when all three gates are met** (see Level Advancement Gates, below).
- Once gates are met, a 3-second grace period begins. A floater displays `ADVANCING...`. After 3 seconds, level automatically clears, award bonus is applied (if `FLAGS.SCORE_REBALANCE = true`), and the player advances.
- **No wave-phase restriction** — advancement can trigger during BUILD, PEAK, or RELEASE phases.
- On game over: the run result is submitted to the `allTime` leaderboard. Best score is tracked globally.
- **Unlocks levels for Level Select:** When `runResult.level > highestLevelReached`, that level is pushed to `unlockedStartLevels` and becomes selectable in the Level Select menu.

**Example:**
Player reaches L3 with 550 score, 24 intercepts, 3 waves completed. All gates met (threshold 500, minIntercepts 24, minWaves 3). Grace period starts. At T+3s, level clears, +150 bonus awarded (50 × 3), player advances to L4 with 700 total score.

---

### Daily
**`rankingMode = 'daily'`** — Seeded daily challenge.

**Characteristics:**
- Seeded RNG using today's ISO date. Every player worldwide sees the same missile spawns for that day.
- Same advancement mechanics as Campaign (all three gates, 3-second grace).
- **One ranked attempt per calendar day (UTC).** The day boundary is determined by UTC midnight (`new Date().toISOString().slice(0,10)`). After the first completion, subsequent attempts are marked unranked.
- Best daily score for a given seed is tracked separately from Campaign best.
- On game over: submitted to the `daily` leaderboard, indexed by seed (date). Also updates the daily streak if applicable (see `milestones.js`).

**Example:**
On 2026-04-26, the daily seed generates a specific RNG sequence. Player completes the run with score 2500. This result posts to `boards.daily[seed]`. If they replay the level, the second attempt posts as unranked.

---

### Level Select (LEVELRUN)
**`rankingMode = 'levelrun'`** — Per-level survival challenge.

**Characteristics:**
- Player selects any **unlocked level** to play. Score resets to 0 at start.
- **Endless survival** — the level never advances automatically. The player plays until they lose all health.
- Score climbs unbounded. Each level has its own isolated score pool.
- **Unlock via Campaign/Daily:** Advancing past a level in Campaign or Daily permanently unlocks that level for selection (via `updateBest`).
- **Unlock via LEVELRUN Criteria Clear:** If all three gates are met during a LEVELRUN run (`criteriaCleared = true`), the next level unlocks when the run ends. An in-game toast fires: `CRITERIA MET · L{n+1} UNLOCKS`. On game over, the unlock is saved to `unlockedStartLevels`.
- **Per-level best score** is stored in `save.best.perLevel[startLevel]` — only updated from LEVELRUN runs, never from Campaign or Daily (which would pollute the scoring).
- On game over: the survival score is compared against the level's previous best. A Personal Best (PB) is flagged if `levelScore > perLevel[startLevel]`.
- Level Select shows unlocked levels as clickable buttons and locked levels as greyed-out `.locked` buttons.

**Example:**
Player starts LEVELRUN on L5 (unlocked via Campaign). They score 1200 before dying. On game over, `updateBest` compares 1200 against `save.best.perLevel[5]` (previous best: 950). This is a PB. If all three gates were met during the run, L6 also unlocks.

---

## Level Advancement Gates (Campaign & Daily Only)

Advancement in Campaign and Daily modes requires **all three gates to be true simultaneously:**

1. **Score Gate:** `levelScore >= config.scoreThreshold`
   - `levelScore = state.score - state.levelStartScore`
   - The score earned since the start of this level, not including carryover from previous levels.

2. **Intercept Gate:** `levelIntercepts >= config.minIntercepts`
   - `levelIntercepts = state.stats.intercepts - state.levelStartIntercepts`
   - The number of successful intercepts since this level started.

3. **Wave Gate:** `wavesCompleted >= config.minWaves`
   - `wavesCompleted = state.wave.index - state.levelStartWaveIndex`
   - The number of **complete wave cycles** (BUILD → PEAK → RELEASE) since this level started.
   - `state.wave.index` increments at the start of each BUILD phase.
   - One full cycle takes 30 seconds (14s BUILD + 8s PEAK + 8s RELEASE).

### Grace Period Logic

Once all three gates are true:
1. `state.advanceGraceRemaining` is set to `LEVEL_ADVANCE_GRACE_S` (3 seconds).
2. A floater is spawned: `ADVANCING...` centered at (100m, 90m), lasts 3.3 seconds.
3. Each tick, `advanceGraceRemaining` decrements by `DT` (0.05s).
4. When `advanceGraceRemaining <= 0`, the level clears:
   - If `FLAGS.SCORE_REBALANCE = true`, a level clear bonus is awarded: `LEVEL_CLEAR_BONUS * state.level` (50 × level number).
   - A floater displays the bonus: `+{bonus} LEVEL CLEAR`.
   - The player advances to the next level with score, health, Aegis state, and cumulative run record totals carried over.
   - For Level 10 (Endless), this gate is never triggered (threshold is `Infinity`; the `isFinite` check blocks grace initiation).

### Why 3 Seconds?

The grace period provides a brief "breath" between passing criteria and advancing. It's long enough to feel intentional, short enough to prevent frustration. Earlier designs used wave-phase restrictions (up to 90 seconds of phantom waiting); 3 seconds achieves clarity without delay.

---

## Level Configuration (Authoritative)

All per-level values defined in `src/levels.js`. Index 0 is unused (levels are 1-based).

| Level | Label | Threshold | minIntercepts | minWaves | spawnInterval | missileVyMin | missileVyMax | missileVxRange | maxMissiles | Notes |
|-------|-------|-----------|---------------|----------|---------------|--------------|--------------|----------------|-------------|-------|
| 1 | ORIENTATION | 200 | 12 | 2 | 3.0s | -5 | 0 | 0 | ∞ | Learn the arc. |
| 2 | FIRST CONTACT | 400 | 18 | 3 | 2.75s | -15 | -5 | 0 | ∞ | They fall faster now. |
| 3 | CROSSWINDS | 500 | 24 | 3 | 2.5s | -20 | -10 | 10 | ∞ | Track the drift. Aegis begins. |
| 4 | SATURATION | 650 | 30 | 3 | 2.25s | -25 | -10 | 15 | 7 | Prioritize. Or fall. |
| 5 | COURIERS | 900 | 36 | 3 | 2.25s | -30 | -15 | 15 | 8 | Gold streaks. Fast. (20% courier events) |
| 6 | SPLITTERS | 1000 | 42 | 4 | 2.1s | -28 | -12 | 15 | 9 | One becomes three. (25% splitter events) |
| 7 | MIRV STORM | 1200 | 48 | 4 | 2.0s | -30 | -15 | 18 | 10 | Watch the sky fracture. (20% MIRV events) |
| 8 | BLACKOUT | 1500 | 54 | 4 | 2.0s | -30 | -15 | 18 | 10 | Trust the feel. Trajectory OFF. |
| 9 | ONSLAUGHT | 1800 | 60 | 5 | 1.9s | -32 | -15 | 20 | 10 | All of it. At once. (Mixed events) |
| 10 | ENDLESS | ∞ | ∞ | ∞ | 1.8s | -35* | -15 | 22 | 12 | How long can you last? (Escalates each wave) |

**Level 10 Special:** Threshold, minIntercepts, and minWaves are all `Infinity`. No grace period will ever fire, making Level 10 a true endless survival level.

**L10 Escalation:** Each completed wave cycle (BUILD→PEAK→RELEASE), the per-run snapshot `state.escalation.vyMin` decreases by 1 (floor −60) and `state.escalation.spawnInterval` decreases by 0.02s (floor 1.2s). This is stored in `state.escalation` — the shared `LEVELS[10]` object is **never mutated**, so L10 difficulty resets correctly on every new run.

---

## Unlock System

### Unlocked Levels Storage
- `save.progress.unlockedStartLevels` — array of level numbers the player can select in Level Select.
- Initialized with `[1]` (Level 1 always unlocked).
- Highest level reached tracked separately in `save.progress.highestLevelReached`.

### Campaign/Daily Unlock Path
When a Campaign or Daily run ends:
- `updateBest(save, runResult)` is called.
- If `runResult.level > highestLevelReached`, that level is unlocked:
  - The new level is appended to `unlockedStartLevels` (if not already present).
  - `highestLevelReached` is updated.
- Example: Player beats L1 in Campaign, advancing to L2. On game over, L2 is unlocked and added to `unlockedStartLevels`. Level Select now shows L1 and L2 as buttons.

### LEVELRUN Unlock Path
During a LEVELRUN run:
1. When all three gates are met for the first time, `state.criteriaCleared` is set to `true`.
2. An in-game toast fires: `CRITERIA MET · L{nextLevel} UNLOCKS`.
3. On game over, if `runResult.criteriaCleared = true`:
   - `updateBest` checks if `nextLevel < LEVELS.length` and is not already in `unlockedStartLevels`.
   - If so, the level is appended and `highestLevelReached` is updated.
   - A toast confirms: `LEVEL {nextLevel} UNLOCKED`.
- Example: Player plays LEVELRUN L4. They accumulate 650 score, 30 intercepts, and 3 waves. All gates met. Toast fires in-game. They continue playing (endless) and eventually die. On game over, L5 is unlocked.

### UI Representation
- **Unlocked levels:** Rendered as clickable buttons with visible label (e.g., `LEVEL 5 — COURIERS`).
- **Locked levels:** Rendered as greyed-out buttons with `.locked` CSS class, non-interactive.
- Clicking an unlocked button starts a LEVELRUN at that level with `rankingMode = RANKING_MODES.LEVELRUN`.

---

## Per-Level Best Score (Leaderboard)

### Why Separate Per-Level Storage?
- **Campaign/Daily runs span multiple levels.** A Campaign L5 score includes carryover from L1–L4, making it incomparable to a fresh L5 LEVELRUN start.
- **Per-level best only tracks LEVELRUN survival scores.** This ensures a fair, apples-to-apples comparison for skill-based level selection.

### Storage and Updates
- Stored in `save.best.perLevel[startLevel]` — a sparse object keyed by level number.
- **Only updated from LEVELRUN runs:**
  ```javascript
  if (runResult.rankingMode === RANKING_MODES.LEVELRUN) {
    const lvlBest = save.best.perLevel[runResult.startLevel] ?? 0;
    if (runResult.levelScore > lvlBest) {
      save.best.perLevel[runResult.startLevel] = runResult.levelScore;
    }
  }
  ```
- Campaign and Daily runs do **not** update `perLevel`, only `allTime.score`.

### Personal Best (PB) Detection
On game over, the UI compares the current run against the appropriate best:
- **LEVELRUN:** `isPB = levelScore > perLevel[startLevel]`
- **Campaign/Daily:** `isPB = score > allTime.score`

A PB is displayed on the game-over screen with a visual highlight.

### Leaderboard Submission
- **Campaign:** Submitted to `boards.allTime` (all players, all runs, ranked).
- **Daily:** Submitted to `boards.daily[seed]` (seed-specific, one attempt per day ranked, rest unranked).
- **LEVELRUN:** Submitted to `boards.levelRuns[startLevel]` (per-level, all runs ranked).

Each entry includes `levelScore` (the survival score) to ensure correct sorting.

---

## State Fields (Progression-Related)

| Field | Type | Scope | Notes |
|-------|------|-------|-------|
| `state.level` | number | Active | Current level (1–10). |
| `state.startLevel` | number | Active | Starting level for this run (same as `level` in Campaign; configurable in LEVELRUN). |
| `state.score` | number | Active | Cumulative score (carries across levels in Campaign/Daily; resets in LEVELRUN). |
| `state.levelStartScore` | number | Active | Score baseline at level start. `levelScore = score - levelStartScore`. |
| `state.levelStartIntercepts` | number | Active | Intercept baseline at level start. |
| `state.levelStartWaveIndex` | number | Active | Wave index baseline at level start. |
| `state.advanceGraceRemaining` | number \| null | Active | Null if grace not started. Counts down from 3s. Triggers advance when ≤ 0. Campaign/Daily only. |
| `state.criteriaCleared` | boolean | Active | Sticky flag. Set once all 3 gates true in LEVELRUN. Persisted in `runResult.criteriaCleared`. |
| `state.levelProgress` | object | Active | Debug/UI: `{ scoreDone, interceptsDone, wavesDone, levelScore, levelIntercepts, wavesCompleted }`. Recomputed each tick. |
| `state.runTotals` | object | Active | Cumulative Campaign/Daily record stats already earned in prior level states: `{ intercepts, survivedS, longestChain, closestMissM, waveStats }`. |
| `state.rankingMode` | string | Active | `'campaign'`, `'daily'`, `'levelrun'`, or `'unranked'`. |
| `save.progress.unlockedStartLevels` | array | Persistent | Levels player can select in Level Select. |
| `save.progress.highestLevelReached` | number | Persistent | Highest level ever reached (for display / unlock tracking). |
| `save.best.allTime` | object | Persistent | `{ score, level, date, seed }` — best Campaign/Daily result. |
| `save.best.perLevel` | object | Persistent | `{ [level]: score, ... }` — best LEVELRUN survival score per level. |

---

## Game Loop Integration

Each tick (0.05s):

1. **Lines 228–240:** Compute current level gates.
   - `levelScore`, `levelIntercepts`, `wavesCompleted` derived from baselines.
   - `scoreDone`, `interceptsDone`, `wavesDone` booleans computed.
   - `state.levelProgress` updated (for UI).

2. **Lines 243–251 (LEVELRUN path):**
   - If all gates met and `criteriaCleared = false`, set `criteriaCleared = true` and fire toast.
   - Endless survival continues; no advancement.

3. **Lines 252–264 (Campaign/Daily path):**
   - If all gates met and threshold is finite (not L10):
     - Initiate grace period (if not already started).
     - Decrement `advanceGraceRemaining`.
     - On grace timeout, apply level clear bonus and advance to next level.

---

## Design Rationale

### 1. Why Level Select Is Endless (No Advancing)

A per-level survival score needs an unbounded ceiling to be a meaningful metric. If Level Select advanced like Campaign, the score would reset after 3 seconds of meeting criteria, making high scores impossible. Endless survival ensures scores can grow indefinitely, enabling fair leaderboard comparison.

### 2. Why 3-Second Grace (Not Wave-Phase Gates)

Older implementations required advancement to occur only during the RELEASE phase of a wave. This caused players to wait up to 90 seconds after meeting all gates before advancing — a source of player frustration and confusion. The 3-second grace period is a compromise: long enough to feel intentional, short enough to keep pacing tight.

### 3. Why Per-Level Best Only from LEVELRUN

Campaign and Daily scores are cumulative across multiple levels. A Campaign L5 score includes earned points from L1–L4 in the same session. Comparing a Campaign L5 score (with carryover) to a fresh LEVELRUN L5 start would be misleading. Per-level best is isolated to LEVELRUN to maintain integrity of the leaderboard.

### 4. Why Criteria Clear Toast in LEVELRUN

LEVELRUN players may not realize they've unlocked the next level. The in-game toast (`CRITERIA MET · L{n+1} UNLOCKS`) provides immediate, celebratory feedback and educates the player about unlock mechanics.

---

## Run Result Object

When a run ends, `gameLoop.buildRunResult(state)` returns an object passed to `updateBest` and leaderboard submission:

```javascript
{
  score,                  // Total final score
  levelScore,             // Score earned this level (for perLevel comparison)
  level,                  // Final level reached
  startLevel,             // Level run started on
  rankingMode,            // 'campaign', 'daily', 'levelrun', 'unranked'
  longestChain,           // Longest combo multiplier achieved
  closestMissM,           // Closest near-miss distance in meters (or null)
  intercepts,             // Total intercepts this run
  survivedS,              // Total time survived in seconds
  waveStats,              // Per-wave accuracy summaries carried across the run
  seed,                   // RNG seed (Campaign: null; Daily/LEVELRUN: seed value)
  dateISO,                // ISO date string at run start
  criteriaCleared,        // Boolean; true if all 3 gates met in LEVELRUN
}
```

For Campaign and Daily, `buildRunResult(state)` uses `collectRunTotals(state)` so the final record includes every completed level plus the current level. Do not read `state.stats` or `state.totalElapsedS` directly for final run records; those fields are per-level because each level transition creates a fresh `state`.

---

## Persistence

All progression state is persisted via `save.json` in localStorage:

- **On game start:** `loadSave()` reads existing save or initializes defaults.
- **On game over:** `updateBest(save, runResult)` mutates save; `saveSave(save)` writes to localStorage.
- **Leaderboards:** Stored separately in `boards.json` and submitted locally (no backend yet).
- **Unlock changes:** Reflected immediately in Level Select UI on next menu render.

---

## Testing Notes

- Use `buildRunResult(state)` to generate a run result object for testing `updateBest` logic.
- Mock `save` objects with `progress: { unlockedStartLevels: [...], highestLevelReached: N }` and `best: { allTime: {...}, perLevel: {...} }`.
- Test unlock paths separately: Campaign unlock (level > highestLevelReached), LEVELRUN unlock (criteriaCleared = true), and duplicate prevention.
- Verify per-level best is never updated by Campaign or Daily runs; only LEVELRUN updates `perLevel`.
- Verify Campaign/Daily records aggregate across level transitions with `collectRunTotals(state)`, especially intercepts, survival time, closest miss, and longest chain.

## Known Fix: Graze Double-Count on Collision (fixed)

**Bug:** When an interceptor collided with a missile, the inner missile loop continued iterating. Any remaining alive missile within `NEAR_MISS_THRESHOLD` (10m) of the now-dead interceptor was incorrectly counted as a graze/near-miss and awarded Aegis energy.

**Fix (collision.js):** `break` out of the inner missile loop immediately after a collision is registered (`interceptor.alive = false`). Since the interceptor is dead, no further missile checks against it are valid.

**Affected stats:** `state.stats.nearMisses`, `state.stats.closestMissM`, Aegis energy via `ENERGY_GRAZE`, and the Level Summary graze count — all were inflated by this bug.

## Known Fix: Campaign Records Final-Level Only (fixed)

**Bug:** Campaign and Daily level transitions created a fresh state for the next level, carrying only score, health, and Aegis. Personal records on game over read `state.stats`, `state.combo.best`, and `state.totalElapsedS` from the final level only, so records undercounted total intercepts, survival time, and best chain.

**Fix:** `state.runTotals` carries cumulative record stats between level states. `collectRunTotals(state)` merges prior totals with the current level, and `buildRunResult(state)` uses that aggregate for persistence and leaderboard records.

**Affected stats:** `save.best.longestChain`, `save.best.closestMissM`, `save.best.totalIntercepts`, `save.best.totalSurvivedS`, shared `waveStats`, and the Records leaderboard tab.

## Code Review Fixes (Records)
**2026-05-02 — Refined normalizeRunTotals and closestMissM**

- Simplified `normalizeRunTotals` in `state.js` to safely handle `null` initialization and avoid unnecessary `waveStats` copies.
- Normalized `closestMissM` from `Infinity` to `null` in `buildRunResult` to correctly match documented data models.
- Cleaned up `showGameOverScreen` call in `main.js` by dropping redundant `waveStats` fallbacks.
- Corrected typo "share waveStats" to "shared waveStats" in documentation.
- Expanded testing suite in `regression.test.js` to properly validate `waveStats` aggregation array across campaign level changes.
