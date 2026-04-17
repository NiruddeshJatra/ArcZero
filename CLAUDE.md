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
├── main.js        ← bootstrap, level countdown, canvas init
├── gameLoop.js    ← fixed timestep loop, level-complete detection
├── state.js       ← all game state (no globals)
├── physics.js     ← position/velocity update
├── input.js       ← keyboard tracking, fire cooldown
├── spawner.js     ← missile spawn timing (config-driven per level)
├── collision.js   ← distance checks, altitude guard
├── renderer.js    ← all canvas drawing, HUD, overlays
├── constants.js   ← single source of truth for all numbers
├── levels.js      ← per-level config array (L1–L6)
└── audio.js       ← sound effects (loads public/audio/*.mp3)
public/
└── audio/
    ├── shoot.mp3
    ├── intercept.mp3
    ├── damage.mp3
    ├── game-over.mp3
    └── level-up.mp3
index.html
```

## Game Spec

### World & Physics
- World: 200m × 150m, origin bottom-left, y increases upward
- Canvas: scale 5px/m → 1000×750px, CSS-responsive
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
| Enemy Missile | 3m | Per level config, x=rand(30–180), y=150 | vy/vx set by level |
| Interceptor | 2m | On space release (with cooldown) | Same physics as missile |
| Launcher | — | x=100, y=0 (fixed to ground) | Moves x only |

### Launcher Controls
| Input | Effect |
|-------|--------|
| ←/→ | Move x ±50m/s, clamp [0,200] |
| ↑/↓ | Angle ±30°/s, clamp [20°,80°] |
| Space hold | Charge power +30/s, clamp [20,80] (blocked during cooldown) |
| Space release | Fire interceptor, start 1s cooldown, reset power to 20 |

### Firing
```
vx = power * cos(angle_rad)
vy = power * sin(angle_rad)
spawn at (launcher.x, 0)
1 second cooldown before next shot (FIRE_COOLDOWN in constants.js)
```

### Interceptor Removal
Destroy if: `y ≤ 0` OR `y > 150` OR `x < 0` OR `x > 200`

### Collision
`distance(interceptor, missile) ≤ 5` AND `missile.y ≥ MIN_INTERCEPT_ALTITUDE (20m)`
→ destroy both, score += 15
(no interception below 20m — exploit prevention)

### Scoring
- +15 per interception
- +dt per tick (= +1 per second survived), display as `Math.floor(points)`

### Health
- Start: 100, carries over between levels
- Missile hits ground: -10
- Game over: health ≤ 0

### Rules
- Multiple interceptors allowed (separate shots)
- 1 second fire cooldown between shots (no rapid fire)
- Power resets to 20 after each fire
- No interception in bottom 20m danger zone

## Level System
Levels defined in `src/levels.js`. Each level has:
- `label` — display name
- `spawnInterval` — seconds between spawns
- `missileVyMin/Max` — initial downward velocity range at spawn
- `missileVxRange` — symmetric horizontal velocity range (0 = vertical only)
- `maxMissiles` — simultaneous missile cap
- `scoreThreshold` — level score to advance (Infinity = final level, no advance)

| Level | Spawn | vy range | vx range | Max | Threshold |
|-------|-------|----------|----------|-----|-----------|
| 1 | 4s | 0 | 0 | ∞ | 100 |
| 2 | 4s | -10 to -20 | 0 | ∞ | 120 |
| 3 | 3.5s | -10 to -20 | ±15 | ∞ | 200 |
| 4 | 2.5s | -10 to -20 | ±15 | 6 | 300 |
| 5 | 2.5s | -15 to -35 | ±15 | 8 | 450 |
| 6 | 2.0s | -15 to -35 | ±20 | 10 | ∞ |

Level intro: overlay shows "LEVEL X" + 3,2,1 countdown before each level starts.
Health carries forward between levels. Restart resets to Level 1, full health.

## Game Loop Order (per tick)
1. Input (+ fire cooldown tick-down)
2. Spawn check
3. Physics update (missiles + interceptors)
4. Ground/bounds check
5. Collision check (altitude-guarded)
6. Cleanup (filter dead objects)
7. Scoring (survival points)
8. Level advancement check
9. Game over check
10. Render

## Commands
```bash
npm run dev       # Start dev server (e.g. vite or live-server)
npm run build     # Production build
npm test          # Run test suite
npm run lint      # Lint check
npm run lint:fix  # Auto-fix lint issues
```

## Conventions
- No global state — all state in `state.js` object, passed explicitly
- Physics logic lives only in `physics.js`
- Rendering logic lives only in `renderer.js`
- All constants in `constants.js` — never hardcode numbers elsewhere
- No `any`, no framework imports in game core
- Commit format: `type: description` (fix/feat/refactor/chore/docs/test)

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
- `karpathy-guidelines` — Global coding behavior rules (think first, simplify, surgical changes, goal-driven)
- `code-review-excellence` — Multi-language review (global skill)
- `debugging-code` — DAP interactive debugger (requires `dap` CLI)
- `playwright-skill` — Playwright E2E best practices
- `frontend-design` — Design system: colors, typography, spacing

## Security Notes
- Never commit `.env` files
- No user input reaches eval/innerHTML
