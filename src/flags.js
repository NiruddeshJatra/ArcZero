export const FLAGS = {
  // Risky / physics-adjacent — flip to true when ready to enable
  SCORE_REBALANCE: true,      // Phase 2 — passive 1.0→0.25, base intercept 15→10
  DDA_ENABLED: false,          // reserved for v3; keep false
  SEEDED_RNG: true,            // Phase 0 — deterministic runs
  // Content
  EVENT_MISSILES: true,        // Phase 4 — couriers/splitters/MIRV
  MOBILE_TOUCH: true,          // Phase 4 — touch controls
  STREAK_CALLOUTS: true,       // Phase 5 — visual combo texts
  DAILY_MODIFIERS: false,      // Phase 5 — daily modifiers
  // Accessibility
  REDUCE_MOTION: false,        // user setting override
};
