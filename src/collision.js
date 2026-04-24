import {
  COLLISION_RADIUS,
  MISSILE_DAMAGE,
  INTERCEPT_SCORE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MIN_INTERCEPT_ALTITUDE,
  SHAKE_AMP_INTERCEPT,
  SHAKE_DUR_INTERCEPT,
  SHAKE_AMP_DAMAGE,
  SHAKE_DUR_DAMAGE,
  FLASH_INTERCEPT,
  FLASH_DAMAGE,
  HITSTOP_INTERCEPT,
  COMBO_WINDOW_S,
  COMBO_MULT_PER_HIT,
  COMBO_MULT_CAP,
  BASE_INTERCEPT_SCORE_V2,
  BONUS_ALT_MAX_MULT,
  BONUS_ALT_PRACTICAL_MAX_M,
  BONUS_CLUTCH_M,
  BONUS_CLUTCH_MULT,
  BONUS_LONG_RANGE_M,
  BONUS_LONG_RANGE_MULT,
  COURIER_SCORE_MULT,
  BONUS_ANGLE_LOW_MULT,
  BONUS_ANGLE_HIGH_MULT,
  ANGLE_MIN,
  ANGLE_MAX,
  ANGLE_START,
  STREAK_CALLOUTS,
  BASE_HEALTH,
  AEGIS_MAX, AEGIS_BASE_HEAL, AEGIS_OVERHEALTH_MAX, AEGIS_EMP_HEAL,
  ENERGY_LOW_ANGLE, ENERGY_HIGH_ALT, ENERGY_GRAZE, ENERGY_COURIER,
  ENERGY_SCRAP, ENERGY_MEDIC, ENERGY_COMBO_3, ENERGY_COMBO_5
} from './constants.js';
import { createExplosion } from './state.js';
import { playIntercept, playDamage, playGraze, playComboUp, playComboPeak, playMilestone, playAegisTrigger, playShieldBreak, playScrapCollect, playEmp } from './audio.js';
import { NEAR_MISS_THRESHOLD } from './constants.js';
import { triggerShake, triggerFlash } from './renderer.js';
import { FLAGS } from './flags.js';

// Cache the streak callout element once to avoid repeated DOM lookups in the hot collision path.
let _streakEl = null;
function getStreakEl() {
  return _streakEl ?? (_streakEl = document.getElementById('streak-callout'));
}

export function addAegisEnergy(state, amount, reason) {
  if (state.aegis.broken) return;
  
  state.aegis.energy += amount;
  
  if (reason) {
    state.pendingToasts.push(`${reason} +${amount}`);
  }
  
  if (state.aegis.energy >= AEGIS_MAX) {
    state.aegis.energy = 0;
    if (playAegisTrigger) playAegisTrigger();
    
    // Level 3+: Base Heal (+ Overhealth at Level 10+)
    const maxH = state.level >= 10 ? AEGIS_OVERHEALTH_MAX : BASE_HEALTH;
    state.health = Math.min(maxH, state.health + AEGIS_BASE_HEAL);
    
    // Level 7+: Global Grid
    if (state.level >= 7) {
      state.aegis.activeShield = true;
      state.pendingToasts.push(`DEFENSE GRID ONLINE`);
    } else {
      state.pendingToasts.push(`AEGIS DEPLOYED: +${AEGIS_BASE_HEAL} HP`);
    }
    
    triggerFlash(state, '#ffffff', 0.1);
  }
}

/**
 * Euclidean distance between two physics objects.
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check missile-interceptor collisions.
 * Marks alive=false on both, awards score, spawns explosion.
 */
export function checkCollisions(state) {
  for (const interceptor of state.interceptors) {
    if (!interceptor.alive) continue;
    for (const missile of state.missiles) {
      if (!missile.alive) continue;
      if (
        distance(interceptor, missile) <= COLLISION_RADIUS &&
        missile.y >= MIN_INTERCEPT_ALTITUDE
      ) {
        interceptor.alive = false;
        missile.alive = false;
        const midX = (interceptor.x + missile.x) / 2;
        const midY = (interceptor.y + missile.y) / 2;
        state.explosions.push(createExplosion(midX, midY));
        playIntercept();
        triggerShake(state, SHAKE_AMP_INTERCEPT, SHAKE_DUR_INTERCEPT);
        triggerFlash(state, '#ffffff', FLASH_INTERCEPT);
        state.hitstopRemainingS = HITSTOP_INTERCEPT;
        state.stats.intercepts += 1;

        if (FLAGS.SCORE_REBALANCE) {
          state.combo.count += 1;
          state.combo.timerS = COMBO_WINDOW_S;
          state.combo.decaying = false;
          state.combo.multiplier = Math.min(1 + state.combo.count * COMBO_MULT_PER_HIT, COMBO_MULT_CAP);
          if (state.combo.count > state.combo.best) state.combo.best = state.combo.count;
          if (state.combo.multiplier >= COMBO_MULT_CAP) playComboPeak();
          else if (state.combo.count > 1) playComboUp();

          // Aegis combos
          if (state.level >= 3 && state.combo.count === 3) {
            addAegisEnergy(state, ENERGY_COMBO_3);
          }
          if (state.level >= 3 && state.combo.count === 5) {
            addAegisEnergy(state, ENERGY_COMBO_5);
          }
          if (state.level >= 8 && state.combo.count === 4) {
            // Drop physical scrap
            state.scrapOrbs = state.scrapOrbs || [];
            state.scrapOrbs.push({ x: midX, y: midY, vx: 0, vy: -15, alive: true });
          }

          if (FLAGS.STREAK_CALLOUTS) {
            const callout = STREAK_CALLOUTS.find(c => c.count === state.combo.count && state.combo.count > state.combo.lastCalloutAt);
            if (callout) {
              state.combo.lastCalloutAt = state.combo.count;
              const el = getStreakEl();
              if (el) {
                el.textContent = callout.text;
                // Per-tier color palette — escalates as streak grows
                let color, fontSize;
                if (callout.count >= 10) {
                  color = '#ff4dff'; fontSize = '28px'; // legendary — magenta
                } else if (callout.count >= 8) {
                  color = '#ffd700'; fontSize = '26px'; // godlike — gold
                } else if (callout.count >= 6) {
                  color = '#ff7722'; fontSize = '22px'; // overdrive — orange
                } else if (callout.count >= 4) {
                  color = '#44ffcc'; fontSize = '18px'; // quad — teal
                } else if (callout.count >= 3) {
                  color = '#88aaff'; fontSize = '17px'; // triple — blue
                } else {
                  color = 'rgba(255,255,255,0.9)'; fontSize = '16px'; // double — white
                }
                el.style.color = color;
                el.style.fontSize = fontSize;
                el.className = 'active';

                if (el._timer) clearTimeout(el._timer);
                el._timer = setTimeout(() => { el.className = ''; }, 2000);
              }
              playMilestone();
              if (callout.flash) {
                triggerFlash(state, '#ffd700', FLASH_INTERCEPT * 2);
              }
            }
          }

          // Continuous altitude multiplier: 1.0× at MIN_INTERCEPT_ALTITUDE → BONUS_ALT_MAX_MULT× at practical ceiling
          const altFrac = Math.min(
            (missile.y - MIN_INTERCEPT_ALTITUDE) / (BONUS_ALT_PRACTICAL_MAX_M - MIN_INTERCEPT_ALTITUDE), 1.0
          );
          let skillMult = 1.0 + altFrac * (BONUS_ALT_MAX_MULT - 1.0);

          // Angle multiplier: low angle → more points (BONUS_ANGLE_LOW_MULT), high angle → fewer (BONUS_ANGLE_HIGH_MULT)
          const launchAngle = interceptor.launchAngle ?? ANGLE_START;
          const angleFrac = (launchAngle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
          skillMult *= BONUS_ANGLE_LOW_MULT - angleFrac * (BONUS_ANGLE_LOW_MULT - BONUS_ANGLE_HIGH_MULT);

          if (missile.y <= BONUS_CLUTCH_M && missile.y >= MIN_INTERCEPT_ALTITUDE) skillMult *= BONUS_CLUTCH_MULT;
          const horizDist = Math.abs(interceptor.x - state.launcher.x);
          if (horizDist >= BONUS_LONG_RANGE_M) skillMult *= BONUS_LONG_RANGE_MULT;
          if (missile.kind === 'courier') skillMult *= COURIER_SCORE_MULT;

          const finalScore = Math.round(BASE_INTERCEPT_SCORE_V2 * state.combo.multiplier * skillMult);
          state.score += finalScore;

          // Aegis checks
          if (state.level >= 3 && launchAngle < 45) {
            addAegisEnergy(state, ENERGY_LOW_ANGLE, 'LOW ANGLE');
          }
          if (state.level >= 5 && missile.y > 70) {
            addAegisEnergy(state, ENERGY_HIGH_ALT, 'ALTITUDE');
          }
          if (state.level >= 6 && missile.kind === 'courier') {
            addAegisEnergy(state, ENERGY_COURIER, 'COURIER SIPHON');
          }
          if (state.level >= 9 && missile.kind === 'medic') {
            addAegisEnergy(state, ENERGY_MEDIC, 'SUPPLY SECURED');
          }

          state.floaters.push({
            x: midX, y: midY,
            text: `+${finalScore}`,
            mult: state.combo.multiplier,
            age: 0, maxAge: 0.8,
          });
        } else {
          state.score += INTERCEPT_SCORE;
        }
      } else {
        // Near-miss detection
        const d = distance(interceptor, missile);
        if (d <= NEAR_MISS_THRESHOLD && missile.y >= MIN_INTERCEPT_ALTITUDE) {
          interceptor._grazes = interceptor._grazes ?? new Set();
          if (!interceptor._grazes.has(missile.id)) {
            interceptor._grazes.add(missile.id);
            state.stats.nearMisses += 1;
            if (d < state.stats.closestMissM) state.stats.closestMissM = d;
            playGraze();
            state.particles = state.particles ?? [];
            state.particles.push({
              x: (interceptor.x + missile.x) / 2,
              y: (interceptor.y + missile.y) / 2,
              vx: 0, vy: 0, age: 0, maxAge: 0.25,
              color: 'rgba(100,220,255,0.9)', kind: 'spark',
            });
            if (state.level >= 4) {
              addAegisEnergy(state, ENERGY_GRAZE, 'GRAZE');
            }
          }
        }
      }
    }
  }
}

/**
 * Check if missiles hit the ground (y <= 0).
 * Marks alive=false and applies health damage.
 */
export function checkMissileGroundHit(state) {
  for (const missile of state.missiles) {
    if (!missile.alive) continue;
    if (missile.y <= 0) {
      missile.alive = false;
      if (missile.x >= 0 && missile.x <= WORLD_WIDTH) {
        if (state.aegis.activeShield) {
          state.aegis.activeShield = false;
          if (playShieldBreak) playShieldBreak();
          triggerFlash(state, 'rgba(68,170,255,0.6)', 0.15); // blue flash
        } else {
          state.health -= MISSILE_DAMAGE;
          playDamage();
          triggerShake(state, SHAKE_AMP_DAMAGE, SHAKE_DUR_DAMAGE);
          triggerFlash(state, '#ff3535', FLASH_DAMAGE);
          
          if (state.level >= 10 && state.health <= 0 && state.aegis.energy >= 50 && !state.aegis.broken) {
            state.health = AEGIS_EMP_HEAL;
            state.aegis.energy = 0;
            state.aegis.broken = true;
            if (playEmp) playEmp();
            triggerFlash(state, '#ffffff', 0.5);
            for (const m of state.missiles) { m.alive = false; }
          }
        }
      }
    }
  }
}

/**
 * Check if interceptors are out of bounds.
 * Marks alive=false on out-of-bounds interceptors.
 */
export function checkInterceptorBounds(state) {
  for (const interceptor of state.interceptors) {
    if (!interceptor.alive) continue;
    if (
      interceptor.y <= 0 ||
      interceptor.y > WORLD_HEIGHT ||
      interceptor.x < 0 ||
      interceptor.x > WORLD_WIDTH
    ) {
      interceptor.alive = false;
    }
  }
}

/**
 * Check if the launcher caught any scrap orbs.
 */
export function checkScrapCollection(state) {
  if (!state.scrapOrbs) return;
  const lx = state.launcher.x;
  for (const orb of state.scrapOrbs) {
    if (!orb.alive) continue;
    if (orb.y <= 5 && orb.x >= lx - 8 && orb.x <= lx + 8) {
      orb.alive = false;
      if (playScrapCollect) playScrapCollect();
      addAegisEnergy(state, ENERGY_SCRAP, 'SCRAP RECYCLED');
    } else if (orb.y < -5) {
      orb.alive = false;
    }
  }
  state.scrapOrbs = state.scrapOrbs.filter(o => o.alive);
}
