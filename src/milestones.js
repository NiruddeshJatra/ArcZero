/**
 * Milestone definitions and checker for ArcZero.
 * Check on game over and on each intercept.
 */

export const MILESTONES = [
  { id: 'first_intercept',    condition: (s) => s.stats.intercepts >= 1,             toast: 'First blood.' },
  { id: 'ten_intercepts',     condition: (s) => s.stats.intercepts >= 10,            toast: '10 down.' },
  { id: 'hundred_intercepts', condition: (s) => s.save?.best?.totalIntercepts >= 100, toast: 'A centurion.' },
  { id: 'minute_survived',    condition: (s) => s.totalElapsedS >= 60,              toast: 'One minute.' },
  { id: 'first_level_up',     condition: (s) => s.level >= 2,                        toast: 'You climb.' },
  { id: 'reach_l5',           condition: (s) => s.save?.best?.allTime?.level >= 5,   toast: 'Halfway.' },
  { id: 'reach_l10',          condition: (s) => s.save?.best?.allTime?.level >= 10,  toast: 'The endless.' },
  { id: 'chain_5',            condition: (s) => s.combo.best >= 5,                   toast: '×5 chain.' },
  { id: 'chain_10',           condition: (s) => s.combo.best >= 10,                  toast: '×10 chain. Machine.' },
  { id: 'daily_first',        condition: (s) => s.save?.daily?.lastCompletedDateISO !== null, toast: 'First daily done.' },
  { id: 'streak_3',           condition: (s) => s.save?.streak?.current >= 3,        toast: '3-day streak.' },
  { id: 'streak_7',           condition: (s) => s.save?.streak?.current >= 7,        toast: 'A week of fire.' },
];

/**
 * Check all milestones against current state + save. Returns array of newly
 * triggered milestone ids (and marks them in save.progress.milestones).
 * Caller is responsible for calling saveSave(save) afterwards.
 *
 * @param {object} state - current game state
 * @param {object} save  - loaded save object (mutated in place)
 * @returns {string[]} newly triggered toasts
 */
export function checkMilestones(state, save) {
  const toasts = [];
  const achieved = save.progress.milestones;
  // Attach save to state for condition access
  const ctx = { ...state, save };
  for (const m of MILESTONES) {
    if (!achieved[m.id] && m.condition(ctx)) {
      achieved[m.id] = true;
      toasts.push(m.toast);
    }
  }
  return toasts;
}

/**
 * Update the daily streak. Call after a daily run completes.
 * Mutates save.streak in place.
 * @param {object} save
 * @param {string} todayISO - 'YYYY-MM-DD'
 */
export function updateStreak(save, todayISO) {
  const streak = save.streak;
  const last = streak.lastPlayDateISO;

  if (!last) {
    streak.current = 1;
    streak.best = Math.max(streak.best, 1);
    streak.lastPlayDateISO = todayISO;
    return;
  }

  const lastDate = new Date(last);
  const todayDate = new Date(todayISO);
  const diffDays = Math.round((todayDate - lastDate) / 86400000);

  if (diffDays === 0) {
    // Already played today — no change
    return;
  } else if (diffDays === 1) {
    streak.current += 1;
    streak.best = Math.max(streak.best, streak.current);
  } else if (diffDays > 1) {
    // Gap — try shield
    if (streak.shield) {
      streak.shield = false;
      streak.current += 1;
      streak.best = Math.max(streak.best, streak.current);
    } else {
      streak.current = 1;
    }
  }
  streak.lastPlayDateISO = todayISO;
}
