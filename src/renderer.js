import { LEVELS } from './levels.js';
import {
  SCALE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLOR_BG,
  COLOR_GROUND,
  MISSILE_RADIUS,
  INTERCEPTOR_RADIUS,
  POWER_MIN,
  POWER_MAX,
  MIN_INTERCEPT_ALTITUDE,
  FIRE_COOLDOWN,
  TRAJECTORY_PREVIEW_STEPS,
  FACING_RIGHT,
  LAUNCHER_BARREL_LEN,
  LAUNCHER_RECOIL_DUR,
  LAUNCHER_RECOIL_PX,
  MUZZLE_FLASH_DUR,
  MISSILE_BODY_H,
  MISSILE_BODY_W,
  MISSILE_FIN_W,
  MISSILE_FIN_H,
  MISSILE_DANGER_GLOW_START_M,
  MISSILE_COLORS,
} from './constants.js';
import { toCanvasX, toCanvasY, simulateTrajectory } from './physics.js';

export function triggerShake(state, amp, durS) {
  if (state.settings?.reduceMotion) { amp *= 0.3; }
  state.shake = { amp, dur: durS, elapsed: 0 };
}

export function triggerFlash(state, color, durS) {
  if (state.settings?.reduceMotion) return;
  state.flash = { color, dur: durS, elapsed: 0 };
}

/**
 * Render a complete frame.
 */
export function render(ctx, state) {
  // Per-level background tint
  const levelCfg = LEVELS[state.level];
  ctx.fillStyle = (levelCfg && levelCfg.tint) ? levelCfg.tint : COLOR_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Screen shake
  const shakeActive = state.shake && state.shake.amp > 0;
  // eslint-disable-next-line no-restricted-properties -- visual jitter only
  const shakeX = shakeActive ? (Math.random() * 2 - 1) * state.shake.amp * (1 - state.shake.elapsed / state.shake.dur) : 0;
  // eslint-disable-next-line no-restricted-properties -- visual jitter only
  const shakeY = shakeActive ? (Math.random() * 2 - 1) * state.shake.amp * (1 - state.shake.elapsed / state.shake.dur) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawGround(ctx);
  drawDangerZone(ctx);

  // L8 forceTrajectoryOff overrides settings
  const showTraj = !(levelCfg && levelCfg.forceTrajectoryOff);
  drawTrajectory(ctx, state.launcher, showTraj ? state.settings : { showTrajectoryPreview: false });

  drawWarnings(ctx, state);
  drawLauncher(ctx, state);

  for (const missile of state.missiles) {
    if (missile.alive) drawMissile(ctx, missile);
  }
  for (const interceptor of state.interceptors) {
    if (interceptor.alive) drawInterceptor(ctx, interceptor);
  }
  for (const explosion of state.explosions) {
    drawExplosion(ctx, explosion);
  }

  drawReloadMeter(ctx, state.launcher);
  drawFloaters(ctx, state);
  drawComboBadge(ctx, state);
  drawWaveIndicator(ctx, state);

  ctx.restore();

  // Full-screen flash overlay (drawn above everything, no shake translate)
  if (state.flash && state.flash.color && state.flash.dur > 0) {
    const a = (1 - state.flash.elapsed / state.flash.dur) * 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = state.flash.color;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }
}

function drawGround(ctx) {
  const groundY = toCanvasY(0);
  ctx.strokeStyle = COLOR_GROUND;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(CANVAS_WIDTH, groundY);
  ctx.stroke();
}

function drawTrajectory(ctx, launcher, settings) {
  if (settings && !settings.showTrajectoryPreview) return;
  const rad = (launcher.angle * Math.PI) / 180;
  const vx = launcher.facing * launcher.power * Math.cos(rad);
  const vy = launcher.power * Math.sin(rad);
  const pts = simulateTrajectory(launcher.x, 0, vx, vy, TRAJECTORY_PREVIEW_STEPS);
  if (pts.length < 2) return;
  ctx.strokeStyle = 'rgba(68, 170, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLauncher(ctx, state) {
  const launcher = state.launcher;
  const cx = toCanvasX(launcher.x);
  const groundY = toCanvasY(0);

  // Recoil offset along barrel axis
  const recoilAmt = launcher.recoilTimer > 0
    ? LAUNCHER_RECOIL_PX * (launcher.recoilTimer / LAUNCHER_RECOIL_DUR)
    : 0;
  const rad = (launcher.angle * Math.PI) / 180;
  const barrelDx = Math.cos(rad) * launcher.facing * recoilAmt;
  const barrelDy = -Math.sin(rad) * recoilAmt;

  // --- Hull (trapezoid) ---
  ctx.fillStyle = '#3a3a4a';
  ctx.strokeStyle = '#6a6a7a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 22, groundY);
  ctx.lineTo(cx + 22, groundY);
  ctx.lineTo(cx + 16, groundY - 10);
  ctx.lineTo(cx - 16, groundY - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Wheels ---
  ctx.fillStyle = '#222230';
  for (const ox of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.arc(cx + ox, groundY - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Dome turret ---
  ctx.fillStyle = '#4a4a5c';
  ctx.strokeStyle = '#7a7a9a';
  ctx.beginPath();
  ctx.arc(cx, groundY - 10, 9, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // --- Status LED ---
  const ready = launcher.fireCooldown <= 0;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
  ctx.fillStyle = ready ? `rgba(102,255,153,${pulse})` : `rgba(255,80,80,${pulse})`;
  ctx.beginPath();
  ctx.arc(cx - 10, groundY - 4, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // --- Barrel (mirrored on facing) ---
  const barrelBaseX = cx + barrelDx;
  const barrelBaseY = groundY - 10 + barrelDy;
  const barrelTipX = barrelBaseX + Math.cos(rad) * LAUNCHER_BARREL_LEN * launcher.facing;
  const barrelTipY = barrelBaseY - Math.sin(rad) * LAUNCHER_BARREL_LEN;
  ctx.strokeStyle = '#9a9acc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(barrelBaseX, barrelBaseY);
  ctx.lineTo(barrelTipX, barrelTipY);
  ctx.stroke();

  // --- Charge glow ---
  if (launcher.charging) {
    const powerFrac = (launcher.power - POWER_MIN) / (POWER_MAX - POWER_MIN);
    const grd = ctx.createRadialGradient(barrelTipX, barrelTipY, 0, barrelTipX, barrelTipY, 8 + powerFrac * 8);
    grd.addColorStop(0, `rgba(255, ${180 - powerFrac * 120}, 50, ${0.6 + 0.3 * powerFrac})`);
    grd.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 8 + powerFrac * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Muzzle flash ---
  if (launcher.muzzleFlashTimer > 0) {
    const flashFrac = launcher.muzzleFlashTimer / MUZZLE_FLASH_DUR;
    ctx.fillStyle = `rgba(255, 240, 180, ${flashFrac})`;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 10 * flashFrac, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 200, 80, ${flashFrac * 0.6})`;
    ctx.beginPath();
    ctx.arc(barrelTipX, barrelTipY, 16 * flashFrac, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Facing indicator ---
  ctx.fillStyle = 'rgba(200,220,255,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(launcher.facing === FACING_RIGHT ? '▶' : '◀', cx, groundY + 12);
}

function drawReloadMeter(ctx, launcher) {
  if (launcher.fireCooldown <= 0) return;
  const frac = 1 - (launcher.fireCooldown / FIRE_COOLDOWN);
  const cx = toCanvasX(launcher.x);
  const groundY = toCanvasY(0);
  const barW = 40, barH = 3;
  const y = groundY + 6;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cx - barW / 2, y, barW, barH);
  ctx.fillStyle = frac > 0.8 ? '#66ff99' : '#ff9944';
  ctx.fillRect(cx - barW / 2, y, barW * frac, barH);
}

function drawDangerZone(ctx) {
  const groundY = toCanvasY(0);
  const thresholdY = toCanvasY(MIN_INTERCEPT_ALTITUDE);

  // Shaded band from ground to min-intercept line
  ctx.fillStyle = 'rgba(255, 60, 60, 0.08)';
  ctx.fillRect(0, thresholdY, CANVAS_WIDTH, groundY - thresholdY);

  // Dashed threshold line
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(CANVAS_WIDTH, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMissile(ctx, missile) {
  const cx = toCanvasX(missile.x);
  const cy = toCanvasY(missile.y);
  const colors = MISSILE_COLORS[missile.kind] ?? MISSILE_COLORS.standard;

  // --- Exhaust trail (world coords, behind missile) ---
  for (const pt of missile.trail ?? []) {
    const a = pt.age / 0.4;
    const alpha = (1 - a) * 0.7;
    const r = (1 - a) * 2.5;
    ctx.fillStyle = colors.trail + alpha + ')';
    ctx.beginPath();
    ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  const angle = Math.atan2(-missile.vy, missile.vx);
  const wobble = Math.sin(performance.now() / 120 + (missile.wobblePhase ?? 0)) * 0.04;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2 + wobble);

  // --- Danger glow when approaching ground ---
  if (missile.y < MISSILE_DANGER_GLOW_START_M) {
    const glowIntensity = 1 - (missile.y / MISSILE_DANGER_GLOW_START_M);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    grd.addColorStop(0, `rgba(255, 40, 40, ${glowIntensity * 0.6})`);
    grd.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Exhaust flame ---
  const flameLen = 8 + Math.sin(performance.now() / 40 + (missile.wobblePhase ?? 0)) * 3;
  const flameGrd = ctx.createLinearGradient(0, MISSILE_BODY_H / 2, 0, MISSILE_BODY_H / 2 + flameLen);
  flameGrd.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
  flameGrd.addColorStop(0.5, 'rgba(255, 120, 40, 0.6)');
  flameGrd.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = flameGrd;
  ctx.beginPath();
  ctx.moveTo(-3, MISSILE_BODY_H / 2);
  ctx.lineTo(3, MISSILE_BODY_H / 2);
  ctx.lineTo(0, MISSILE_BODY_H / 2 + flameLen);
  ctx.closePath();
  ctx.fill();

  // --- Fins ---
  ctx.fillStyle = colors.body;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-MISSILE_BODY_W / 2, MISSILE_BODY_H / 2 - 2);
  ctx.lineTo(-MISSILE_BODY_W / 2 - MISSILE_FIN_W, MISSILE_BODY_H / 2 + MISSILE_FIN_H);
  ctx.lineTo(-MISSILE_BODY_W / 2, MISSILE_BODY_H / 2 - MISSILE_FIN_H * 0.3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(MISSILE_BODY_W / 2, MISSILE_BODY_H / 2 - 2);
  ctx.lineTo(MISSILE_BODY_W / 2 + MISSILE_FIN_W, MISSILE_BODY_H / 2 + MISSILE_FIN_H);
  ctx.lineTo(MISSILE_BODY_W / 2, MISSILE_BODY_H / 2 - MISSILE_FIN_H * 0.3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // --- Body ---
  const bodyGrd = ctx.createLinearGradient(-MISSILE_BODY_W / 2, 0, MISSILE_BODY_W / 2, 0);
  bodyGrd.addColorStop(0, colors.body);
  bodyGrd.addColorStop(0.5, colors.stroke);
  bodyGrd.addColorStop(1, colors.body);
  ctx.fillStyle = bodyGrd;
  ctx.strokeStyle = colors.stroke;
  ctx.beginPath();
  ctx.rect(-MISSILE_BODY_W / 2, -MISSILE_BODY_H / 2, MISSILE_BODY_W, MISSILE_BODY_H);
  ctx.fill(); ctx.stroke();

  // --- Nose cone ---
  ctx.fillStyle = colors.core;
  ctx.strokeStyle = colors.stroke;
  ctx.beginPath();
  ctx.moveTo(-MISSILE_BODY_W / 2, -MISSILE_BODY_H / 2);
  ctx.lineTo(MISSILE_BODY_W / 2, -MISSILE_BODY_H / 2);
  ctx.lineTo(0, -MISSILE_BODY_H / 2 - 12);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

function drawInterceptor(ctx, interceptor) {
  const cx = toCanvasX(interceptor.x);
  const cy = toCanvasY(interceptor.y);
  const ang = Math.atan2(-interceptor.vy, interceptor.vx);

  // Trail
  for (const pt of interceptor.trail ?? []) {
    const a = pt.age / 0.3;
    ctx.fillStyle = `rgba(100, 200, 255, ${0.5 * (1 - a)})`;
    ctx.beginPath();
    ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), 1.5 * (1 - a), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);

  // Halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
  halo.addColorStop(0, 'rgba(100, 200, 255, 0.5)');
  halo.addColorStop(1, 'rgba(100, 200, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

  // Body (arrow pointing in velocity direction)
  ctx.fillStyle = '#4488ff';
  ctx.strokeStyle = '#66ccff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Fins
  ctx.fillStyle = '#66ccff';
  ctx.beginPath();
  ctx.moveTo(-4, -3); ctx.lineTo(-7, -5); ctx.lineTo(-4, -1);
  ctx.moveTo(-4, 3);  ctx.lineTo(-7, 5);  ctx.lineTo(-4, 1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawExplosion(ctx, explosion) {
  const cx = toCanvasX(explosion.x);
  const cy = toCanvasY(explosion.y);
  const progress = explosion.age / explosion.maxAge;
  const alpha = 1 - progress;
  const r = (MISSILE_RADIUS + INTERCEPTOR_RADIUS) * SCALE * progress * 1.5;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,107,53,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,68,68,${alpha * 0.6})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawWarnings(ctx, state) {
  for (const w of state.warnings ?? []) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 80);
    ctx.save();
    ctx.fillStyle = `rgba(255, 80, 80, ${0.4 + 0.4 * pulse})`;
    const cx = toCanvasX(w.x);
    ctx.beginPath();
    ctx.moveTo(cx, 12);
    ctx.lineTo(cx - 8, 2);
    ctx.lineTo(cx + 8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawFloaters(ctx, state) {
  for (const f of state.floaters ?? []) {
    const frac = f.age / f.maxAge;
    const alpha = 1 - frac;
    const cy = toCanvasY(f.y) - frac * 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${f.mult > 2 ? 18 : 14}px monospace`;
    ctx.fillStyle = f.mult >= 2 ? '#ffcc44' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, toCanvasX(f.x), cy);
    ctx.restore();
  }
}

function drawComboBadge(ctx, state) {
  if (!state.combo || state.combo.count < 2) return;
  const txt = `×${state.combo.multiplier.toFixed(2)}  ${state.combo.count} CHAIN`;
  ctx.save();
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = state.combo.decaying ? 'rgba(255,180,80,0.8)' : '#ff9944';
  ctx.textAlign = 'right';
  ctx.fillText(txt, CANVAS_WIDTH - 16, 28);
  ctx.restore();
}

function drawWaveIndicator(ctx, state) {
  if (!state.wave) return;
  const phases = ['BUILD', 'PEAK', 'RELEASE'];
  const idx = phases.indexOf(state.wave.phase);
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${state.wave.index + 1}`, 16, 48);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === idx ? '#ff9944' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(24 + i * 12, 60, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Update HUD DOM elements.
 */
export function updateHUD(state) {
  document.getElementById('hud-level').textContent = state.level;
  document.getElementById('hud-score').textContent = Math.floor(state.score);
  document.getElementById('hud-health').textContent = Math.max(0, state.health);
  document.getElementById('hud-angle').textContent = Math.round(state.launcher.angle) + '°';
  document.getElementById('hud-power').textContent = Math.round(state.launcher.power);
}

/**
 * Show game-over overlay with final score.
 */
export function showGameOver(score) {
  document.getElementById('final-score-value').textContent = Math.floor(score);
  document.getElementById('game-over-overlay').classList.add('visible');
}

/**
 * Hide game-over overlay.
 */
export function hideGameOver() {
  document.getElementById('game-over-overlay').classList.remove('visible');
}

/**
 * Show level intro overlay with the level label and countdown starting at 3.
 */
export function showLevelIntro(level) {
  const cfg = LEVELS[level];
  document.getElementById('level-intro-title').textContent = cfg.label;
  document.getElementById('level-intro-countdown').textContent = '3';
  const introEl = document.getElementById('level-intro-text');
  if (introEl) introEl.textContent = cfg.intro ?? '';
  document.getElementById('level-intro-overlay').classList.add('visible');
}

/**
 * Hide level intro overlay.
 */
export function hideLevelIntro() {
  document.getElementById('level-intro-overlay').classList.remove('visible');
}

/**
 * Update the countdown number shown on the level intro overlay.
 */
export function updateCountdown(n) {
  document.getElementById('level-intro-countdown').textContent = String(n);
}
