# ArcZero — TODOs

## Design

### Create DESIGN.md via /design-consultation

**What:** Run `/design-consultation` to produce a `DESIGN.md` design system document for ArcZero.

**Why:** Every design decision (colors, typography, spacing, component patterns) is currently only discoverable by reading `index.html`. As UI grows — backend leaderboards, new overlays, mobile improvements — decisions will drift and new elements will deviate from the established aesthetic.

**Pros:** Single source of truth for all design decisions; future PRs reference DESIGN.md instead of reconstructing conventions from code; `/design-review` and `/plan-design-review` both calibrate against it automatically.

**Cons:** ~30 minutes of time; conventions are currently implicit and consistent, so no immediate breakage without it.

**Context:** Identified in design review of the scoring/leaderboard overhaul PR (2026-04-21). ArcZero's existing aesthetic is strong (Courier New monospace, #0a0a0f dark, #44aaff blue, ghost buttons, no rounded cards). A DESIGN.md would codify this before the backend API sprint introduces more UI surface area.

**Depends on / blocked by:** Nothing. Can be done at any time before the next UI-heavy sprint.

---

## Code Quality

### dailyModifier() NaN guard

**What:** Add `if (isNaN(dayIndex)) return 'standard';` to `dailyModifier()` in `src/rng.js`, plus 1 unit test in `rng.test.js`.

**Why:** `Date.parse(dateISO)` returns `NaN` for malformed date strings. `NaN % 4 = NaN`. `MODIFIERS[NaN] = undefined`. Result: `state.dailyModifier = undefined`, modifier toast fires with undefined text.

**Pros:** Eliminates a real (if unlikely) failure mode. 2 lines of code.

**Cons:** None — trivially small fix.

**Context:** Identified in CEO review of scoring/leaderboard PR (2026-04-21). Production date strings come from `new Date().toISOString().slice(0,10)` which is always valid, but a defensive guard costs nothing.

**Effort:** XS (CC ~2 min). **Priority:** P2.

**Depends on / blocked by:** Implement `dailyModifier()` in `src/rng.js` first (Days 12-14 of the plan).

---

### RANKING_MODES constant in constants.js

**What:** Add `export const RANKING_MODES = Object.freeze({ CAMPAIGN: 'campaign', LEVELRUN: 'levelrun', DAILY: 'daily', UNRANKED: 'unranked' });` to `src/constants.js`. Replace raw string literals at all 7 call sites.

**Why:** The `rankingMode` enum string literals (`'campaign'`, `'levelrun'`, `'daily'`, `'unranked'`) appear at 7+ call sites in `main.js` and `share.js`. A typo (e.g. `'levelRun'` vs `'levelrun'`) is silently wrong in vanilla JS — no type checker catches it.

**Pros:** Prevents future typo bugs at zero runtime cost. IDE autocomplete works with named exports.

**Cons:** Extra import statement at each call site. Minimal overhead.

**Context:** Identified in CEO review (2026-04-21). Pattern follows existing `FLAGS` object in `flags.js`.

**Effort:** XS (CC ~5 min). **Priority:** P3.

**Depends on / blocked by:** rankingMode refactor (Days 3-4 of the plan).

---

### isChainPB unit tests

**What:** Add 3 unit tests for the streak PB notification logic (cherry-pick B from CEO review) to `tests/persistence.test.js` or a new `tests/phase5.test.js`:
- `prevBest=0, chain=3` → `isChainPB=true`
- `prevBest=3, chain=3` → `isChainPB=false` (equal, not new record)
- `prevBest=0, chain=1` → `isChainPB=false` (guard: chain ≤ 1 not a streak)

**Why:** The streak PB detection has a non-obvious ordering constraint (snapshot must be taken before `currentSave = loadSave()`). Without tests, a future refactor of the onGameOver flow could silently break it.

**Pros:** Cheap safety net for a non-obvious invariant.

**Cons:** None — 3 small test cases.

**Context:** Identified in CEO review (2026-04-21). Covers cherry-pick B: `isChainPB` computation in `main.js` `onGameOver`.

**Effort:** XS (CC ~5 min). **Priority:** P2.

**Depends on / blocked by:** Cherry-pick B implementation (game-over screen streak PB line).
