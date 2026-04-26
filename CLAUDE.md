# ArcZero — Project Brain

## What This Is
2D physics-based missile interception game. Browser-based. Vanilla JS + HTML5 Canvas.
Goal: correct simulation first, game second.

## Stack
- Runtime: Browser (vanilla JS, no frameworks in game core)
- Language: JavaScript (ES modules)
- Renderer: HTML5 Canvas
- Testing: Playwright (E2E), Vitest (unit)
- Linting: ESLint + Prettier
- Future: integrates into React + backend web app

## File Structure
```
src/
├── main.js          ← bootstrap, menu wiring, daily mode, PB overlay
├── gameLoop.js      ← fixed timestep loop, milestone drain, persistence on game over
├── state.js         ← all game state (no globals)
├── physics.js       ← position/velocity update, MIRV/splitter splits
├── input.js         ← keyboard tracking, fire cooldown
├── spawner.js       ← missile spawn timing, event-missile kind selection
├── aegis.js         ← Aegis energy logic (addAegisEnergy, triggerAegisEmp); all Aegis rules live here
├── collision.js     ← distance checks, altitude guard, near-miss, combo scoring
├── renderer.js      ← all canvas drawing, HUD, overlays, combo badge, wave indicator
├── constants.js     ← single source of truth for all numbers
├── levels.js        ← per-level config array (L1–L10)
├── audio.js         ← sound effects (loads public/audio/*.mp3|wav)
├── rng.js           ← seeded PRNG (mulberry32); all randomness routes here
├── persistence.js   ← localStorage save/load; all localStorage access routes here
├── flags.js         ← feature flags (SCORE_REBALANCE, EVENT_MISSILES, etc.)
├── share.js         ← daily share payload builder (emoji grid)
├── milestones.js    ← milestone definitions + checkMilestones + updateStreak
└── touchInput.js    ← mobile touch controls (drag-to-aim, release-to-fire)
docs/
├── backend-api.md      ← v2 REST API scaffold (not implemented)
├── AEGIS_PROTOCOL.md   ← Aegis energy system, payloads, UI, audio
└── PROGRESSION.md      ← Level unlock, Campaign vs Level Select, per-level scoring, gates
public/
└── audio/           ← see Audio section below
tests/
├── collision.test.js
├── persistence.test.js
├── phase2.test.js
├── phase3.test.js
├── phase4.test.js
├── physics.test.js
├── rng.test.js
├── setup.js
└── spawner.test.js
index.html
```

## Game Spec

### World & Physics
- World: 200m × 150m, origin bottom-left, y increases upward
- Canvas: scale 5px/m → 1000×750px, CSS-responsive (mobile letterbox)
- Gravity: g = -12 m/s²
- Timestep: dt = 0.05s (fixed, 20 ticks/sec)
- Physics update per tick:
  ```
  x  += vx * dt
  y  += vy * dt + 0.5 * g * dt²
  vy += g * dt
  ```
- Canvas Y conversion: `canvasY = (150 - physicsY) * 5`

### Objects
| Object | Radius | Spawn | Notes |
|--------|--------|-------|-------|
| Enemy Missile | 3m | Per level config, x=rand(30–180), y=150 | vy/vx set by level; kind: standard/courier/splitter/mirv |
| Interceptor | 2m | On space release (with cooldown) | Same physics as missile |
| Launcher | — | x=100, y=0 (fixed to ground) | Moves x only; facing ±1 |

### Launcher Controls
| Input | Effect |
|-------|--------|
| ←/→ | Move x ±50m/s, clamp [0,200] |
| ↑/↓ | Angle ±30°/s, clamp [20°,80°] |
| Space hold | Charge power +30/s, clamp [20,80] (blocked during cooldown) |
| Space release | Fire interceptor, start 1s cooldown, reset power to 20 |
| Z | Flip launcher facing (left/right) |
| Touch drag | Aim angle + power; release fires |

### Firing
```
vx = facing * power * cos(angle_rad)
vy = power * sin(angle_rad)
spawn at (launcher.x, 0)
1 second cooldown before next shot
```

### Interceptor Removal
Destroy if: `y ≤ 0` OR `y > 150` OR `x < 0` OR `x > 200`

### Collision
`distance(interceptor, missile) ≤ 5` AND `missile.y ≥ MIN_INTERCEPT_ALTITUDE (20m)`
→ destroy both, score += combo-weighted points
(no interception below 20m — exploit prevention)

Near-miss: distance ≤ 10m but > 5m → graze sound, spark particle, stats.nearMisses++

### Scoring (SCORE_REBALANCE=true)
- Base intercept: 10 × combo multiplier × skill multipliers
- Combo: +0.25× per intercept within 3s window, cap 8×, decays over 1s after window
- Skill multipliers: high-alt (≥100m ×1.25), clutch (≤35m ×1.5), long-range (≥50m ×1.2)
- Passive: +0.25 per second survived
- Level clear bonus: 50 × level number

### Health
- Start: 100 per level (resets to BASE_HEALTH on every level transition)
- Missile hits ground: -10
- Game over: health ≤ 0

### Game Modes
- **Campaign** — start L1, non-seeded, fully ranked. Advances through levels; all-time score board.
- **Daily** — today's ISO date → seeded RNG, one ranked attempt per day. Advances through levels.
- **Level Select (LEVELRUN)** — start at any unlocked level; endless survival on that level (never advances). Score resets to 0 each run. Per-level leaderboard keyed on `startLevel`. Unlocks next level when all 3 criteria are first met (toast in-game; unlock persists at game over).

## Level System (10 levels)
Levels defined in `src/levels.js`. L10 is endless with per-wave escalation.

| Level | Name | Spawn | vy range | vx | Max | Threshold |
|-------|------|-------|----------|----|-----|-----------|
| 1 | Orientation | 3.0s | -5 to 0 | 0 | ∞ | 200 |
| 2 | First Contact | 2.75s | -15 to -5 | 0 | ∞ | 400 |
| 3 | Crosswinds | 2.5s | -20 to -10 | ±10 | ∞ | 500 |
| 4 | Saturation | 2.25s | -25 to -10 | ±15 | 7 | 650 |
| 5 | Couriers | 2.25s | -30 to -15 | ±15 | 8 | 900 |
| 6 | Splitters | 2.1s | -28 to -12 | ±15 | 9 | 1000 |
| 7 | MIRV Storm | 2.0s | -30 to -15 | ±18 | 10 | 1200 |
| 8 | Blackout | 2.0s | -30 to -15 | ±18 | 10 | 1500 |
| 9 | Onslaught | 1.9s | -32 to -15 | ±20 | 10 | 1800 |
| 10 | Endless | 1.8s | -35 to -15 | ±22 | 12 | ∞ |

Wave system: BUILD (14s) → PEAK (8s, faster spawns) → RELEASE (8s, slowest) → repeat.
Level advance (Campaign/Daily): all 3 gates met → 3-second grace (`ADVANCING...` floater) → advance. No phase restriction.

## Event Missiles (Phase 4, FLAGS.EVENT_MISSILES=true)
| Kind | Behavior | Color |
|------|----------|-------|
| standard | Normal | Red |
| courier | Fast vy (-35 to -50), ×1.5 score | Gold |
| splitter | Splits at y≤60 into 2 children | Purple |
| mirv | Splits after 1.5s into 3 spread children | Pink |

## Audio
All slots wired in `audio.js`. Files in `public/audio/`. Fails silently if a file is absent.
In-game mute toggle: `[M]` key or the `♪` button in the HUD (session-only, not persisted).
Full volume controls in Settings overlay (master slider, persisted via `persistence.js`).

## Game Loop Order (per tick)
1. Shake/flash decay
2. Hitstop gate (skip sim if active)
3. Combo decay
4. Floater aging
5. Wave tick
6. Input
7. Spawn (including Aegis Medic)
8. Physics (+ MIRV/splitter splits + Scrap Orb gravity)
9. Ground/bounds checks (+ Aegis Shield block)
10. Collision (+ combo scoring + near-miss + Aegis triggers)
11. Scrap Orb collection
12. In-game milestone check → pendingToasts
13. Cleanup
14. Explosion aging
15. Passive scoring
16. Level advancement check (all phases; 3s grace for Campaign/Daily; criteria-cleared tracking for LEVELRUN)
17. Game over check
18. Render + HUD

## Commands
```bash
npm run dev       # Start dev server
npm run build     # Production build
npm test          # Run Vitest unit tests
npm run test:e2e  # Run Playwright E2E
npm run lint      # Lint check
npm run lint:fix  # Auto-fix lint issues
```

## Conventions
- No global state — all state in `state.js`, passed explicitly
- Physics logic only in `physics.js`
- Rendering logic only in `renderer.js`
- All randomness via `rng.js` — `Math.random()` banned (ESLint rule)
- All localStorage via `persistence.js` — direct calls banned (ESLint rule)
- All constants in `constants.js` — never hardcode numbers elsewhere
- All Aegis energy mutations via `aegis.js` (`addAegisEnergy`, `triggerAegisEmp`) — never mutate `state.aegis` directly in collision or gameLoop
- `state.pendingToasts` entries are `string | {text, kind}` — use `{text, kind: 'aegis'}` for styled Aegis toasts; `showToast` in `main.js` handles both forms
- Floaters accept an optional `color` string property — if omitted, defaults to white/gold by combo multiplier
- Commit format: `type(phaseN): description`

## AI Agents Available
| Agent | Purpose |
|-------|---------|
| `code-reviewer` | Review code for bugs, security, quality |
| `debugger` | Interactive debugging with DAP protocol |
| `test-writer` | Write unit and E2E Playwright tests |
| `refactorer` | Clean up code without changing behavior |
| `doc-writer` | Write documentation and comments |
| `security-auditor` | Audit for OWASP vulnerabilities |

## Custom Commands
- `/fix-issue <number>` — Fix a GitHub issue end-to-end
- `/deploy <env>` — Deploy to staging or production
- `/pr-review <number>` — Full PR review and comment

## Skills Active
- `karpathy-guidelines` — Global: think first, simplify, surgical changes, goal-driven
- `code-review-skill` — Global: multi-language review
- `debugging-code` — Global: DAP interactive debugger
- `playwright-skill` — Global: Playwright E2E best practices
- `frontend-design` — Project: HUD, overlays, menus — use when touching renderer.js or index.html
- `game-physics` — Project: physics correctness — use when touching physics.js, collision.js, spawner.js, gameLoop.js
- `gsap-core` — Animation: tweens, easing, stagger, defaults — use whenever writing JS animations
- `gsap-timeline` — Animation: sequencing, position parameter, nesting — use for choreographed animation
- `gsap-plugins` — Animation: ScrollToPlugin, Flip, Draggable, SplitText, etc — use when a GSAP plugin is needed
- `gsap-scrolltrigger` — Animation: scroll-linked, pinning, scrub — use for any scroll-driven animation
- `gsap-react` — Animation: useGSAP, refs, cleanup — use when animating inside React components
- `gsap-performance` — Animation: transforms, batching, will-change — use when optimizing animation FPS
- `gsap-utils` — Animation: clamp, mapRange, snap, random — use when needing GSAP utility helpers
- `gsap-frameworks` — Animation: Vue/Svelte lifecycle + cleanup — use for non-React framework animation

## gstack
gstack installed at `~/.claude/skills/gstack`. Use `/browse` for all web browsing — never use `mcp__claude-in-chrome__*` tools.

Available skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Security Notes
- Never commit `.env` files
- No user input reaches eval/innerHTML
- `ArcZero_ClaudeCode_Brief.md` is gitignored — never commit it
