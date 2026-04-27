# Graph Report - .  (2026-04-27)

## Corpus Check
- Corpus is ~34,783 words - fits in a single context window. You may not need a graph.

## Summary
- 289 nodes · 554 edges · 28 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Aegis Protocol & Design Docs|Aegis Protocol & Design Docs]]
- [[_COMMUNITY_Audio System|Audio System]]
- [[_COMMUNITY_Renderer & Canvas|Renderer & Canvas]]
- [[_COMMUNITY_Collision & Aegis Logic|Collision & Aegis Logic]]
- [[_COMMUNITY_Spawner & RNG|Spawner & RNG]]
- [[_COMMUNITY_Game Bootstrap & UI|Game Bootstrap & UI]]
- [[_COMMUNITY_Save & Persistence|Save & Persistence]]
- [[_COMMUNITY_Progression & Level Select|Progression & Level Select]]
- [[_COMMUNITY_Input & State|Input & State]]
- [[_COMMUNITY_Physics Engine|Physics Engine]]
- [[_COMMUNITY_Test Setup|Test Setup]]
- [[_COMMUNITY_Design & Aesthetics|Design & Aesthetics]]
- [[_COMMUNITY_Milestones & Streaks|Milestones & Streaks]]
- [[_COMMUNITY_Touch Controls|Touch Controls]]
- [[_COMMUNITY_Score Sharing|Score Sharing]]
- [[_COMMUNITY_Utilities 15|Utilities 15]]
- [[_COMMUNITY_Utilities 16|Utilities 16]]
- [[_COMMUNITY_Utilities 43|Utilities 43]]
- [[_COMMUNITY_Utilities 44|Utilities 44]]
- [[_COMMUNITY_Utilities 45|Utilities 45]]
- [[_COMMUNITY_Utilities 46|Utilities 46]]
- [[_COMMUNITY_Utilities 47|Utilities 47]]
- [[_COMMUNITY_Utilities 48|Utilities 48]]
- [[_COMMUNITY_Utilities 49|Utilities 49]]
- [[_COMMUNITY_Utilities 50|Utilities 50]]
- [[_COMMUNITY_Utilities 51|Utilities 51]]
- [[_COMMUNITY_Utilities 52|Utilities 52]]
- [[_COMMUNITY_Utilities 53|Utilities 53]]

## God Nodes (most connected - your core abstractions)
1. `_play()` - 30 edges
2. `gameTick()` - 19 edges
3. `render()` - 19 edges
4. `getCtx()` - 17 edges
5. `checkCollisions()` - 14 edges
6. `ArcZero Game Project` - 14 edges
7. `toCanvasY()` - 13 edges
8. `toCanvasX()` - 12 edges
9. `loadSave()` - 9 edges
10. `stepPhysics()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `addAegisEnergy()` --calls--> `playAegisTrigger()`  [INFERRED]
  E:\Projects\missile-maniac\src\aegis.js → E:\Projects\missile-maniac\src\audio.js
- `triggerAegisEmp()` --calls--> `playEmp()`  [INFERRED]
  E:\Projects\missile-maniac\src\aegis.js → E:\Projects\missile-maniac\src\audio.js
- `_buildBuses()` --calls--> `loadSave()`  [INFERRED]
  E:\Projects\missile-maniac\src\audio.js → E:\Projects\missile-maniac\src\persistence.js
- `_play()` --calls--> `random()`  [INFERRED]
  E:\Projects\missile-maniac\src\audio.js → E:\Projects\missile-maniac\src\rng.js
- `gameTick()` --calls--> `startPeakBed()`  [INFERRED]
  E:\Projects\missile-maniac\src\gameLoop.js → E:\Projects\missile-maniac\src\audio.js

## Hyperedges (group relationships)
- **Core Game Loop Modules** — claude_gameloop_js, claude_physics_js, claude_collision_js, claude_spawner_js, claude_renderer_js, claude_input_js [EXTRACTED 1.00]
- **Three Game Modes (Campaign, Daily, LEVELRUN)** — progression_campaign_mode, progression_daily_mode, progression_levelrun_mode [EXTRACTED 1.00]
- **Aegis Full System (gauge, energy, payloads, UI)** — aegis_protocol_gauge, aegis_protocol_energy_mechanics, aegis_protocol_payloads, aegis_protocol_ui_audio [EXTRACTED 1.00]
- **State & Persistence Boundary (no direct localStorage, all via persistence.js)** — claude_state_js, claude_persistence_js, claude_gameloop_js [EXTRACTED 1.00]
- **Randomness Routing (all Math.random banned, route via rng.js)** — claude_rng_js, claude_spawner_js, claude_main_js [EXTRACTED 1.00]
- **Level Advancement Triple Gate (Score + Intercept + Wave)** — progression_advancement_gates, progression_grace_period, claude_gameloop_js [EXTRACTED 1.00]
- **Design System Components (typography, colors, buttons, overlays, toasts)** — design_aesthetic, design_typography, design_color_palette, design_buttons, design_overlays, design_toasts [EXTRACTED 1.00]
- **Backend Leaderboard Endpoints (daily, all-time, weekly)** — backend_get_leaderboard_daily, backend_get_leaderboard_alltime, backend_get_leaderboard_weekly [EXTRACTED 1.00]

## Communities

### Community 0 - "Aegis Protocol & Design Docs"
Cohesion: 0.05
Nodes (52): Rationale: Aegis Mitigates Difficulty Spike at Level 3, Aegis Energy Generation Mechanics, Aegis Gauge (100 Energy, cyan, Level 3+), Aegis Payloads (Base Heal, Defense Grid, Over-Health, EMP Last Stand), Aegis Recovery Protocol System, Aegis UI & Audio (gauge, shield, scrap orbs, medic missiles), Anonymous Auth (X-ArcZero-AnonId bearer token), Backend API v2 Scaffold (NOT IMPLEMENTED — local leaderboards only) (+44 more)

### Community 1 - "Audio System"
Cohesion: 0.13
Nodes (43): _buildBuses(), _duck(), getCtx(), getVolumes(), initAudio(), isMuted(), _loadBuffer(), _persistVolumes() (+35 more)

### Community 2 - "Renderer & Canvas"
Cohesion: 0.24
Nodes (25): toCanvasX(), toCanvasY(), drawAegisSystem(), drawBackground(), drawComboBadge(), drawDangerZone(), drawExplosion(), drawFloaters() (+17 more)

### Community 3 - "Collision & Aegis Logic"
Cohesion: 0.22
Nodes (14): addAegisEnergy(), triggerAegisEmp(), checkCollisions(), checkInterceptorBounds(), checkMissileGroundHit(), checkScrapCollection(), distance(), getStreakEl() (+6 more)

### Community 4 - "Spawner & RNG"
Cohesion: 0.22
Nodes (12): dailyModifier(), pickWeighted(), random(), randomBetween(), randomInt(), seed(), seedFromDateISO(), seedFromString() (+4 more)

### Community 5 - "Game Bootstrap & UI"
Cohesion: 0.3
Nodes (14): applySettings(), bindHowToPlay(), bindSettingsControls(), bootstrap(), maybePromptFirstRunName(), openMenu(), renderLeaderboard(), renderLevelSelect() (+6 more)

### Community 6 - "Save & Persistence"
Cohesion: 0.37
Nodes (12): checkIsChainPB(), deepMerge(), generateAnonId(), loadBoards(), loadSave(), pushSortedTopN(), saveBoards(), saveSave() (+4 more)

### Community 7 - "Progression & Level Select"
Cohesion: 0.2
Nodes (11): share.js — Daily Share Payload Builder, Level Select Overlay, Campaign Mode (rankingMode=campaign), Daily Mode (seeded RNG, one ranked attempt/day), Level Select / LEVELRUN Mode (endless survival, per-level leaderboard), Per-Level Best Score (LEVELRUN only, save.best.perLevel), Rationale: Criteria Clear Toast Educates Player on Unlock Mechanics, Rationale: Level Select Is Endless (unbounded ceiling for fair leaderboard) (+3 more)

### Community 8 - "Input & State"
Cohesion: 0.29
Nodes (6): initInput(), processInput(), createExplosion(), createInterceptor(), createMissile(), createState()

### Community 9 - "Physics Engine"
Cohesion: 0.62
Nodes (5): simulateTrajectory(), stepObject(), stepPhysics(), updateInterceptorTrail(), updateMissileTrail()

### Community 10 - "Test Setup"
Cohesion: 0.33
Nodes (1): MockAudioContext

### Community 11 - "Design & Aesthetics"
Cohesion: 0.33
Nodes (6): renderer.js — Canvas Drawing & HUD, Design Aesthetic: Neo-Arcade / Retro-Futuristic HUD, Typography: Courier New Monospace, HTML5 Canvas (1000×750px game-canvas), HUD (level, score, health, aegis, angle, power, mute), TODO: Create DESIGN.md via /design-consultation

### Community 12 - "Milestones & Streaks"
Cohesion: 0.67
Nodes (2): checkMilestones(), updateStreak()

### Community 13 - "Touch Controls"
Cohesion: 0.67
Nodes (2): initTouchInput(), shouldUseTouchInput()

### Community 14 - "Score Sharing"
Cohesion: 0.67
Nodes (1): buildShareText()

### Community 15 - "Utilities 15"
Cohesion: 0.67
Nodes (1): makeState()

### Community 16 - "Utilities 16"
Cohesion: 0.67
Nodes (1): makeState()

### Community 43 - "Utilities 43"
Cohesion: 1.0
Nodes (1): input.js — Keyboard Tracking

### Community 44 - "Utilities 44"
Cohesion: 1.0
Nodes (1): audio.js — Sound Effects

### Community 45 - "Utilities 45"
Cohesion: 1.0
Nodes (1): touchInput.js — Mobile Touch Controls

### Community 46 - "Utilities 46"
Cohesion: 1.0
Nodes (1): Settings Overlay (name, trajectory, motion, volume)

### Community 47 - "Utilities 47"
Cohesion: 1.0
Nodes (1): How to Play Overlay

### Community 48 - "Utilities 48"
Cohesion: 1.0
Nodes (1): Game Over Overlay (score, PB, stats, share)

### Community 49 - "Utilities 49"
Cohesion: 1.0
Nodes (1): Level Summary Overlay (level complete, stats grid)

### Community 50 - "Utilities 50"
Cohesion: 1.0
Nodes (1): Level Intro Overlay (countdown before level starts)

### Community 51 - "Utilities 51"
Cohesion: 1.0
Nodes (1): Button Style: Ghost Buttons with 1px Border

### Community 52 - "Utilities 52"
Cohesion: 1.0
Nodes (1): Overlay Style (rgba(10,10,15,0.92) dark wash, no cards)

### Community 53 - "Utilities 53"
Cohesion: 1.0
Nodes (1): Toast Style (slide-up fade-in, dark bordered blocks)

## Knowledge Gaps
- **42 isolated node(s):** `input.js — Keyboard Tracking`, `levels.js — Per-Level Config Array`, `audio.js — Sound Effects`, `share.js — Daily Share Payload Builder`, `touchInput.js — Mobile Touch Controls` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Test Setup`** (6 nodes): `setup.js`, `MockAudioContext`, `.createBuffer()`, `.destination()`, `.state()`, `setup.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Milestones & Streaks`** (4 nodes): `milestones.js`, `checkMilestones()`, `updateStreak()`, `milestones.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Touch Controls`** (4 nodes): `touchInput.js`, `touchInput.js`, `initTouchInput()`, `shouldUseTouchInput()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Score Sharing`** (3 nodes): `share.js`, `buildShareText()`, `share.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 15`** (3 nodes): `phase3.test.js`, `makeState()`, `phase3.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 16`** (3 nodes): `phase4.test.js`, `makeState()`, `phase4.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 43`** (1 nodes): `input.js — Keyboard Tracking`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 44`** (1 nodes): `audio.js — Sound Effects`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 45`** (1 nodes): `touchInput.js — Mobile Touch Controls`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 46`** (1 nodes): `Settings Overlay (name, trajectory, motion, volume)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 47`** (1 nodes): `How to Play Overlay`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 48`** (1 nodes): `Game Over Overlay (score, PB, stats, share)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 49`** (1 nodes): `Level Summary Overlay (level complete, stats grid)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 50`** (1 nodes): `Level Intro Overlay (countdown before level starts)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 51`** (1 nodes): `Button Style: Ghost Buttons with 1px Border`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 52`** (1 nodes): `Overlay Style (rgba(10,10,15,0.92) dark wash, no cards)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utilities 53`** (1 nodes): `Toast Style (slide-up fade-in, dark bordered blocks)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gameTick()` connect `Collision & Aegis Logic` to `Audio System`, `Renderer & Canvas`, `Spawner & RNG`, `Input & State`, `Physics Engine`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `render()` connect `Renderer & Canvas` to `Collision & Aegis Logic`, `Spawner & RNG`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `_play()` connect `Audio System` to `Spawner & RNG`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `_play()` (e.g. with `.createBufferSource()` and `random()`) actually correct?**
  _`_play()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `gameTick()` (e.g. with `render()` and `playWaveWarning()`) actually correct?**
  _`gameTick()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `render()` (e.g. with `gameTick()` and `random()`) actually correct?**
  _`render()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `checkCollisions()` (e.g. with `createExplosion()` and `playIntercept()`) actually correct?**
  _`checkCollisions()` has 10 INFERRED edges - model-reasoned connections that need verification._