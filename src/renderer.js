import { LEVELS } from './levels.js';
import {
  SCALE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLOR_BG,
  COLOR_GROUND,
  COLOR_MISSILE,
  COLOR_MISSILE_STROKE,
  COLOR_INTERCEPTOR,
  COLOR_INTERCEPTOR_STROKE,
  COLOR_LAUNCHER,
  COLOR_LAUNCHER_STROKE,
  COLOR_TRAJECTORY,
  MISSILE_RADIUS,
  INTERCEPTOR_RADIUS,
  LAUNCHER_DRAW_WIDTH_M,
  LAUNCHER_DRAW_HEIGHT_M,
  LAUNCHER_BARREL_LENGTH_M,
  POWER_MIN,
  POWER_MAX,
  MIN_INTERCEPT_ALTITUDE,
} from './constants.js';
import { toCanvasX, toCanvasY } from './physics.js';

/**
 * Render a complete frame.
 */
export function render(ctx, state) {
  // Clear
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawGround(ctx);
  drawDangerZone(ctx);
  drawTrajectory(ctx, state.launcher);
  drawLauncher(ctx, state.launcher);

  for (const missile of state.missiles) {
    if (missile.alive) drawMissile(ctx, missile);
  }
  for (const interceptor of state.interceptors) {
    if (interceptor.alive) drawInterceptor(ctx, interceptor);
  }
  for (const explosion of state.explosions) {
    drawExplosion(ctx, explosion);
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

function drawTrajectory(ctx, launcher) {
  const cx = toCanvasX(launcher.x);
  const barrelTopY = toCanvasY(0) - LAUNCHER_DRAW_HEIGHT_M * SCALE;
  const rad = (launcher.angle * Math.PI) / 180;
  const guideLen = 10 * SCALE;

  ctx.strokeStyle = COLOR_TRAJECTORY;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, barrelTopY);
  ctx.lineTo(
    cx + Math.cos(rad) * guideLen,
    barrelTopY - Math.sin(rad) * guideLen
  );
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLauncher(ctx, launcher) {
  const cx = toCanvasX(launcher.x);
  const groundY = toCanvasY(0);
  const w = LAUNCHER_DRAW_WIDTH_M * SCALE;
  const h = LAUNCHER_DRAW_HEIGHT_M * SCALE;
  const bodyTop = groundY - h;

  // Body
  ctx.fillStyle = COLOR_LAUNCHER;
  ctx.fillRect(cx - w / 2, bodyTop, w, h);
  ctx.strokeStyle = COLOR_LAUNCHER_STROKE;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, bodyTop, w, h);

  // Barrel
  const rad = (launcher.angle * Math.PI) / 180;
  const barrelLen = LAUNCHER_BARREL_LENGTH_M * SCALE;
  ctx.strokeStyle = COLOR_LAUNCHER_STROKE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, bodyTop);
  ctx.lineTo(
    cx + Math.cos(rad) * barrelLen,
    bodyTop - Math.sin(rad) * barrelLen
  );
  ctx.stroke();

  // Power charge bar
  if (launcher.charging) {
    drawPowerBar(ctx, cx, bodyTop - 8, launcher.power);
  }
}

function drawPowerBar(ctx, cx, y, power) {
  const fraction = (power - POWER_MIN) / (POWER_MAX - POWER_MIN);
  const barW = 30;
  const barH = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - barW / 2, y - barH, barW, barH);
  ctx.fillStyle = '#ff6b35';
  ctx.fillRect(cx - barW / 2, y - barH, barW * fraction, barH);
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

  // Canvas heading: negate vy because canvas Y is flipped.
  // Falling missile (vy<0) → angle=PI/2. +PI/2 offset maps local-up to canvas-down.
  const angle = Math.atan2(-missile.vy, missile.vx);

  // Visual dimensions in pixels
  const bodyH = 20;
  const bodyW = 8;
  const noseH = 10;
  const finW  = 6;
  const finH  = 8;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2);

  // Flame trail (behind missile = positive local Y)
  ctx.fillStyle = 'rgba(255,150,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, bodyH / 2 + 6, 3, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fins
  ctx.fillStyle = COLOR_MISSILE;
  ctx.beginPath(); // left fin
  ctx.moveTo(-bodyW / 2, bodyH / 2);
  ctx.lineTo(-bodyW / 2 - finW, bodyH / 2 + finH);
  ctx.lineTo(-bodyW / 2, bodyH / 2 - finH * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); // right fin
  ctx.moveTo(bodyW / 2, bodyH / 2);
  ctx.lineTo(bodyW / 2 + finW, bodyH / 2 + finH);
  ctx.lineTo(bodyW / 2, bodyH / 2 - finH * 0.4);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = COLOR_MISSILE;
  ctx.strokeStyle = COLOR_MISSILE_STROKE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  ctx.fill();
  ctx.stroke();

  // Nose cone (slightly lighter for contrast)
  ctx.fillStyle = COLOR_MISSILE_STROKE;
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2, -bodyH / 2);
  ctx.lineTo(bodyW / 2, -bodyH / 2);
  ctx.lineTo(0, -bodyH / 2 - noseH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLOR_MISSILE_STROKE;
  ctx.stroke();

  ctx.restore();
}

function drawInterceptor(ctx, interceptor) {
  const cx = toCanvasX(interceptor.x);
  const cy = toCanvasY(interceptor.y);
  const r = INTERCEPTOR_RADIUS * SCALE;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_INTERCEPTOR;
  ctx.fill();
  ctx.strokeStyle = COLOR_INTERCEPTOR_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();
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
  document.getElementById('level-intro-title').textContent = LEVELS[level].label;
  document.getElementById('level-intro-countdown').textContent = '3';
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
