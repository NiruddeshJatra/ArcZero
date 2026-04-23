/**
 * Level configuration. All per-level tuning lives here.
 * Index 0 is unused — levels are 1-based.
 *
 * Fields:
 *   label            — display string for the intro overlay
 *   spawnInterval    — base seconds between missile spawns (modulated by wave system)
 *   missileVyMin/Max — initial downward velocity range at spawn
 *   missileVxRange   — symmetric horizontal velocity range (0 = vertical only)
 *   maxMissiles      — max simultaneous alive missiles (Infinity = uncapped)
 *   scoreThreshold   — level score to advance (Infinity = final level)
 *   minIntercepts    — must intercept at least this many during the level
 *   minWaves         — must complete at least this many wave cycles
 *   tint             — background color for this level
 *   intro            — short intro line shown in level overlay
 *   eventWeights     — optional { kind: fraction } for Phase 4 event missiles
 *   forceTrajectoryOff — if true, disable trajectory preview regardless of settings
 *   escalatesPeak    — if true (L10), ramp difficulty each wave
 */
export const LEVELS = [
  null, // index 0 unused

  // L1 — Orientation
  { label: 'LEVEL 1 — ORIENTATION',   spawnInterval: 3.0,  missileVyMin: -5,  missileVyMax: 0,   missileVxRange: 0,  maxMissiles: Infinity, scoreThreshold: 200,   minIntercepts: 12,  minWaves: 2, tint: '#0a0a1f', intro: 'Learn the arc.' },
  // L2 — First Contact
  { label: 'LEVEL 2 — FIRST CONTACT', spawnInterval: 2.75, missileVyMin: -15, missileVyMax: -5,  missileVxRange: 0,  maxMissiles: Infinity, scoreThreshold: 400,   minIntercepts: 18,  minWaves: 3, tint: '#0a0a22', intro: 'They fall faster now.' },
  // L3 — Crosswinds
  { label: 'LEVEL 3 — CROSSWINDS',    spawnInterval: 2.5,  missileVyMin: -20, missileVyMax: -10, missileVxRange: 10, maxMissiles: Infinity, scoreThreshold: 500,   minIntercepts: 24,  minWaves: 3, tint: '#0a1028', intro: 'Track the drift.' },
  // L4 — Saturation
  { label: 'LEVEL 4 — SATURATION',    spawnInterval: 2.25, missileVyMin: -25, missileVyMax: -10, missileVxRange: 15, maxMissiles: 7,        scoreThreshold: 650,   minIntercepts: 30,  minWaves: 3, tint: '#0f0a2a', intro: 'Prioritize. Or fall.' },
  // L5 — Couriers
  { label: 'LEVEL 5 — COURIERS',      spawnInterval: 2.25, missileVyMin: -30, missileVyMax: -15, missileVxRange: 15, maxMissiles: 8,        scoreThreshold: 900,  minIntercepts: 36,  minWaves: 3, tint: '#1a0a2c', intro: 'Gold streaks. Fast.',          eventWeights: { courier: 0.2 } },
  // L6 — Splitters
  { label: 'LEVEL 6 — SPLITTERS',     spawnInterval: 2.1,  missileVyMin: -28, missileVyMax: -12, missileVxRange: 15, maxMissiles: 9,        scoreThreshold: 1000,  minIntercepts: 42,  minWaves: 4, tint: '#220a1f', intro: 'One becomes three.',            eventWeights: { splitter: 0.25 } },
  // L7 — MIRV Storm
  { label: 'LEVEL 7 — MIRV STORM',    spawnInterval: 2.0,  missileVyMin: -30, missileVyMax: -15, missileVxRange: 18, maxMissiles: 10,       scoreThreshold: 1200,  minIntercepts: 48,  minWaves: 4, tint: '#2a0a15', intro: 'Watch the sky fracture.',        eventWeights: { mirv: 0.20 } },
  // L8 — Blackout
  { label: 'LEVEL 8 — BLACKOUT',      spawnInterval: 2.0,  missileVyMin: -30, missileVyMax: -15, missileVxRange: 18, maxMissiles: 10,       scoreThreshold: 1500,  minIntercepts: 54,  minWaves: 4, tint: '#18081a', intro: 'Trust the feel.',               forceTrajectoryOff: true },
  // L9 — Onslaught
  { label: 'LEVEL 9 — ONSLAUGHT',     spawnInterval: 1.9,  missileVyMin: -32, missileVyMax: -15, missileVxRange: 20, maxMissiles: 10,       scoreThreshold: 1800,  minIntercepts: 60,  minWaves: 5, tint: '#280828', intro: 'All of it. At once.',            eventWeights: { courier: 0.15, splitter: 0.15, mirv: 0.10 } },
  // L10 — Endless
  { label: 'LEVEL 10 — ENDLESS',      spawnInterval: 1.8,  missileVyMin: -35, missileVyMax: -15, missileVxRange: 22, maxMissiles: 12,       scoreThreshold: Infinity, minIntercepts: Infinity, minWaves: Infinity, tint: '#000', intro: 'How long can you last?', eventWeights: { courier: 0.18, splitter: 0.18, mirv: 0.12 }, escalatesPeak: true },
];
