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
└── backend-api.md   ← v2 REST API scaffold (not implemented)
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
- Start: 100, carries over between levels
- Missile hits ground: -10
- Game over: health ≤ 0

### Game Modes
- **Campaign** — start L1, non-seeded, fully ranked
- **Daily** — today's ISO date → seeded RNG, one ranked attempt per day
- **Practice / Level Select** — mid-campaign start, marked unranked

## Level System (10 levels)
Levels defined in `src/levels.js`. L10 is endless with per-wave escalation.

| Level | Name | Spawn | vy range | vx | Max | Threshold |
|-------|------|-------|----------|----|-----|-----------|
| 1 | Orientation | 3.0s | -5 to 0 | 0 | ∞ | 60 |
| 2 | First Contact | 2.75s | -15 to -5 | 0 | ∞ | 120 |
| 3 | Crosswinds | 2.5s | -20 to -10 | ±10 | ∞ | 200 |
| 4 | Saturation | 2.25s | -25 to -10 | ±15 | 7 | 320 |
| 5 | Couriers | 2.25s | -30 to -15 | ±15 | 8 | 450 |
| 6 | Splitters | 2.1s | -28 to -12 | ±15 | 9 | 620 |
| 7 | MIRV Storm | 2.0s | -30 to -15 | ±18 | 10 | 820 |
| 8 | Blackout | 2.0s | -30 to -15 | ±18 | 10 | 1050 |
| 9 | Onslaught | 1.9s | -32 to -15 | ±20 | 10 | 1320 |
| 10 | Endless | 1.8s | -35 to -15 | ±22 | 12 | ∞ |

Wave system: BUILD (14s) → PEAK (8s, faster spawns) → RELEASE (8s, slowest) → repeat.
Level advance only fires during RELEASE phase.

## Event Missiles (Phase 4, FLAGS.EVENT_MISSILES=true)
| Kind | Behavior | Color |
|------|----------|-------|
| standard | Normal | Red |
| courier | Fast vy (-35 to -50), ×1.5 score | Gold |
| splitter | Splits at y≤60 into 2 children | Purple |
| mirv | Splits after 1.5s into 3 spread children | Pink |

## Audio
Required files in `public/audio/`. Code in `audio.js` fails silently if missing.

| Slot | File | Current status |
|------|------|---------------|
| shoot | shoot.mp3 | ✓ present |
| intercept | intercept.mp3 | ✓ present |
| damage | damage.mp3 | ✓ present |
| gameOver | game-over.mp3 | ✓ present |
| levelUp | level-up.mp3 | ✓ present |
| thump | thump.mp3 | ✗ missing (low thud, layer under intercept) |
| graze | graze.mp3 | ✗ missing (near-miss whoosh) |
| dryClick | dry_click.mp3 | ✗ missing (fire-during-cooldown click) |
| waveWarning | wave_warning.mp3 | ✗ missing (PEAK phase alert) |
| milestone | milestone.mp3 | ✗ missing (achievement chime) |
| ambientLoop | ambient_loop.mp3 | ✗ missing (space drone loop) |

New files in public/audio/ not yet wired: see audio.js section below.

## Game Loop Order (per tick)
1. Shake/flash decay
2. Hitstop gate (skip sim if active)
3. Combo decay
4. Floater aging
5. Wave tick
6. Input
7. Spawn
8. Physics (+ MIRV/splitter splits)
9. Ground/bounds checks
10. Collision (+ combo scoring + near-miss)
11. In-game milestone check → pendingToasts
12. Cleanup
13. Explosion aging
14. Passive scoring
15. Level advancement check (RELEASE only)
16. Game over check
17. Render + HUD

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

## Security Notes
- Never commit `.env` files
- No user input reaches eval/innerHTML
- `ArcZero_ClaudeCode_Brief.md` is gitignored — never commit it
