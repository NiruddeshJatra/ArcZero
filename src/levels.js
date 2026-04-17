/**
 * Level configuration. All per-level tuning lives here.
 * Index 0 is unused — levels are 1-based.
 *
 * Fields:
 *   label          — display string for the intro overlay
 *   spawnInterval  — seconds between missile spawns
 *   missileVyMin   — min initial vy at spawn (negative = downward)
 *   missileVyMax   — max initial vy at spawn (0/0 = pure free-fall)
 *   missileVxRange — symmetric horizontal range: vx = rand(-range, +range)
 *   maxMissiles    — max simultaneous alive missiles (Infinity = uncapped)
 *   scoreThreshold — level score needed to advance (Infinity = final level)
 */
export const LEVELS = [
  null, // index 0 unused

  // Level 1 — pure free-fall, slow spawns, learning the controls
  {
    label: 'LEVEL 1',
    spawnInterval: 4,
    missileVyMin: 0,
    missileVyMax: 0,
    missileVxRange: 0,
    maxMissiles: Infinity,
    scoreThreshold: 100,
  },

  // Level 2 — missiles arrive pre-accelerated (faster impact)
  {
    label: 'LEVEL 2',
    spawnInterval: 4,
    missileVyMin: -20,
    missileVyMax: -10,
    missileVxRange: 0,
    maxMissiles: Infinity,
    scoreThreshold: 120,
  },

  // Level 3 — diagonal trajectories added
  {
    label: 'LEVEL 3',
    spawnInterval: 3.5,
    missileVyMin: -20,
    missileVyMax: -10,
    missileVxRange: 15,
    maxMissiles: Infinity,
    scoreThreshold: 200,
  },

  // Level 4 — faster spawn rate + simultaneous cap
  {
    label: 'LEVEL 4',
    spawnInterval: 2.5,
    missileVyMin: -20,
    missileVyMax: -10,
    missileVxRange: 15,
    maxMissiles: 6,
    scoreThreshold: 300,
  },

  // Level 5 — faster missiles, more pressure
  {
    label: 'LEVEL 5',
    spawnInterval: 2.5,
    missileVyMin: -35,
    missileVyMax: -15,
    missileVxRange: 15,
    maxMissiles: 8,
    scoreThreshold: 450,
  },

  // Level 6 — maximum difficulty, no end condition (survive until death)
  {
    label: 'LEVEL 6',
    spawnInterval: 2.0,
    missileVyMin: -35,
    missileVyMax: -15,
    missileVxRange: 20,
    maxMissiles: 10,
    scoreThreshold: Infinity,
  },
];
