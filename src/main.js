import { createState } from './state.js';
import { initInput } from './input.js';
import { startGameLoop } from './gameLoop.js';
import { seed, seedFromDateISO } from './rng.js';
import { initAudio, playLevelUp } from './audio.js';
import { LEVELS } from './levels.js';
import { BASE_HEALTH } from './constants.js';
import { loadSave, saveSave, loadBoards, submitLocalScore } from './persistence.js';
import { buildShareText } from './share.js';
import { checkMilestones, updateStreak } from './milestones.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas            = document.getElementById('game-canvas');
const ctx               = canvas.getContext('2d');

const menuOverlay       = document.getElementById('menu-overlay');
const levelSelectOverlay= document.getElementById('level-select-overlay');
const leaderboardOverlay= document.getElementById('leaderboard-overlay');
const settingsOverlay   = document.getElementById('settings-overlay');
const creditsOverlay    = document.getElementById('credits-overlay');
const gameOverOverlay   = document.getElementById('game-over-overlay');
const levelIntroOverlay = document.getElementById('level-intro-overlay');

const allOverlays = [
  menuOverlay, levelSelectOverlay, leaderboardOverlay,
  settingsOverlay, creditsOverlay, gameOverOverlay, levelIntroOverlay,
];

function showOnly(overlay) {
  for (const o of allOverlays) o.classList.remove('visible');
  if (overlay) overlay.classList.add('visible');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const toastContainer = document.getElementById('toast-container');

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Global state ──────────────────────────────────────────────────────────────
let keys = null;
let loop = null;
let currentSave = loadSave();

// ── Leaderboard rendering ─────────────────────────────────────────────────────
let currentLbTab = 'daily';

function renderLeaderboard() {
  const boards = loadBoards();
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '';

  let entries = [];
  if (currentLbTab === 'daily') {
    const todayISO = new Date().toISOString().slice(0, 10);
    const todaySeed = seedFromDateISO(todayISO);
    entries = boards.daily[todaySeed] ?? [];
  } else if (currentLbTab === 'weekly') {
    // Aggregate last 7 days
    const agg = {};
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const s = seedFromDateISO(date);
      for (const e of boards.daily[s] ?? []) {
        if (!agg[e.anonId] || e.score > agg[e.anonId].score) agg[e.anonId] = e;
      }
    }
    entries = Object.values(agg).sort((a, b) => b.score - a.score).slice(0, 20);
  } else {
    entries = boards.allTime;
  }

  if (entries.length === 0) {
    list.innerHTML = '<div style="color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:12px;">NO ENTRIES YET</div>';
    return;
  }

  const myId = currentSave.player.anonId;
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (e.anonId === myId ? ' me' : '');
    row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name">${e.name ?? 'you'}</span><span class="lb-score">${e.score}</span>`;
    list.appendChild(row);
  });
}

// ── Settings persistence ──────────────────────────────────────────────────────
function applySettings(save) {
  document.getElementById('setting-trajectory').checked = save.settings.showTrajectoryPreview;
  document.getElementById('setting-reduce-motion').checked = save.settings.reduceMotion;
  document.getElementById('setting-volume').value = save.settings.soundVolume;
}

function bindSettingsControls() {
  document.getElementById('setting-trajectory').addEventListener('change', (e) => {
    currentSave.settings.showTrajectoryPreview = e.target.checked;
    saveSave(currentSave);
  });
  document.getElementById('setting-reduce-motion').addEventListener('change', (e) => {
    currentSave.settings.reduceMotion = e.target.checked;
    saveSave(currentSave);
  });
  document.getElementById('setting-volume').addEventListener('input', (e) => {
    currentSave.settings.soundVolume = parseFloat(e.target.value);
    saveSave(currentSave);
  });
}

// ── Level select ──────────────────────────────────────────────────────────────
function renderLevelSelect() {
  const list = document.getElementById('level-select-list');
  list.innerHTML = '';
  const unlocked = currentSave.progress.unlockedStartLevels;
  for (let lvl = 1; lvl < LEVELS.length; lvl++) {
    const cfg = LEVELS[lvl];
    const btn = document.createElement('button');
    const isUnlocked = unlocked.includes(lvl);
    btn.className = 'lvl-btn' + (isUnlocked ? '' : ' locked');
    btn.textContent = cfg.label ?? `LEVEL ${lvl}`;
    if (isUnlocked) {
      btn.addEventListener('click', () => {
        showOnly(null);
        startLevel(lvl, BASE_HEALTH, 'practice');
      });
    }
    list.appendChild(btn);
  }
}

// ── Game-over PB overlay ──────────────────────────────────────────────────────
function showGameOverScreen(runResult, isPB) {
  const scoreEl  = document.getElementById('final-score-value');
  const pbLine   = document.getElementById('pb-line');
  const statChain   = document.getElementById('stat-chain');
  const statClosest = document.getElementById('stat-closest');
  const shareBtn = document.getElementById('share-btn');
  const shareConfirm = document.getElementById('share-confirm');

  // Count-up animation
  const finalScore = runResult.score;
  const prevBest   = isPB ? finalScore : currentSave.best.allTime.score;
  let current = 0;
  const start = performance.now();
  const dur = 800;

  function animateScore(ts) {
    const t = Math.min((ts - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    current = Math.floor(eased * finalScore);
    scoreEl.textContent = current;
    if (t < 1) {
      requestAnimationFrame(animateScore);
    } else {
      scoreEl.textContent = finalScore;
    }
  }
  requestAnimationFrame(animateScore);

  // PB line
  if (isPB) {
    pbLine.textContent = 'NEW BEST!';
    pbLine.className = 'new-best';
  } else {
    const diff = prevBest - finalScore;
    pbLine.textContent = diff > 0 ? `−${diff} FROM BEST` : 'BEST MATCHED';
    pbLine.className = '';
  }

  // Stats
  const closest = runResult.closestMissM === Infinity ? '—' : runResult.closestMissM.toFixed(1) + 'm';
  statChain.textContent   = `CHAIN ×${runResult.longestChain}`;
  statClosest.textContent = `CLOSEST ${closest}`;

  // Share button (daily only)
  if (runResult.seed !== null && !runResult.unranked) {
    shareBtn.classList.add('visible');
    shareBtn.onclick = () => {
      const text = buildShareText(runResult, runResult.waveStats ?? []);
      navigator.clipboard.writeText(text).then(() => {
        shareConfirm.textContent = 'COPIED!';
        setTimeout(() => { shareConfirm.textContent = ''; }, 2000);
      });
    };
  } else {
    shareBtn.classList.remove('visible');
  }
  shareConfirm.textContent = '';

  showOnly(gameOverOverlay);
}

// ── Core start/loop ───────────────────────────────────────────────────────────
function startLevel(level, carryHealth = BASE_HEALTH, mode = 'campaign', dailySeed = null) {
  const safeLevel = Math.min(level, LEVELS.length - 1);
  showOnly(levelIntroOverlay);

  const introEl = document.getElementById('level-intro-title');
  const introText = document.getElementById('level-intro-text');
  const cdEl = document.getElementById('level-intro-countdown');
  const cfg = LEVELS[safeLevel];
  introEl.textContent = cfg.label ?? `LEVEL ${safeLevel}`;
  introText.textContent = cfg.intro ?? '';
  cdEl.textContent = '3';

  let count = 3;
  const tick = () => {
    count--;
    if (count <= 0) {
      showOnly(null);
      const state = createState(safeLevel, carryHealth);
      state.mode   = mode;
      state.seed   = dailySeed;
      state.dateISO = dailySeed ? new Date().toISOString().slice(0, 10) : null;
      state.unranked = mode === 'practice';
      state.settings.showTrajectoryPreview = currentSave.settings.showTrajectoryPreview;
      state.settings.reduceMotion = currentSave.settings.reduceMotion;

      loop = startGameLoop(ctx, state, keys, {
        onToast(text) { showToast(text); },
        onLevelComplete(completedLevel, finalHealth) {
          loop.stop();
          keys.reset();
          playLevelUp();
          startLevel(completedLevel + 1, finalHealth, mode, dailySeed);
        },
        onGameOver(runResult) {
          // Persist
          const isPB = runResult.score > currentSave.best.allTime.score;
          // updateBest is called inside gameLoop now; reload save
          currentSave = loadSave();

          // Milestone toasts
          const toasts = checkMilestones(state, currentSave);
          for (const t of toasts) showToast(t);
          saveSave(currentSave);

          // Submit to local boards
          if (mode === 'daily' && !state.unranked) {
            const boards = loadBoards();
            submitLocalScore(boards, {
              anonId: currentSave.player.anonId,
              name: currentSave.player.displayName ?? 'you',
              ...runResult,
              inputType: state.inputType ?? 'kbd',
              modifiers: [],
            });
            // Update daily record
            currentSave.daily.lastCompletedDateISO = state.dateISO;
            currentSave.daily.lastScore = runResult.score;
            currentSave.daily.lastSeed = dailySeed;
            // Streak
            updateStreak(currentSave, state.dateISO);
            saveSave(currentSave);
          }

          showGameOverScreen({ ...runResult, waveStats: state.stats.waveStats, unranked: state.unranked }, isPB);
        },
      });
    } else {
      cdEl.textContent = String(count);
      setTimeout(tick, 1000);
    }
  };

  setTimeout(tick, 1000);
}

// ── Menu wiring ───────────────────────────────────────────────────────────────
function openMenu() {
  showOnly(menuOverlay);
}

document.getElementById('menu-campaign-btn').addEventListener('click', () => {
  seed(Date.now() & 0xFFFFFFFF);
  startLevel(1, BASE_HEALTH, 'campaign');
});

document.getElementById('menu-daily-btn').addEventListener('click', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const dailySeed = seedFromDateISO(todayISO);
  seed(dailySeed);
  if (currentSave.daily.lastCompletedDateISO === todayISO) {
    showToast(`Already played today (${currentSave.daily.lastScore}). Replaying unranked.`);
    startLevel(1, BASE_HEALTH, 'daily', dailySeed);
    // mark unranked handled inside startLevel via state.unranked=true after onGameOver
    return;
  }
  startLevel(1, BASE_HEALTH, 'daily', dailySeed);
});

document.getElementById('menu-levelselect-btn').addEventListener('click', () => {
  renderLevelSelect();
  showOnly(levelSelectOverlay);
});
document.getElementById('level-select-back-btn').addEventListener('click', openMenu);

document.getElementById('menu-leaderboard-btn').addEventListener('click', () => {
  currentLbTab = 'daily';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'daily'));
  renderLeaderboard();
  showOnly(leaderboardOverlay);
});
document.getElementById('leaderboard-back-btn').addEventListener('click', openMenu);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLbTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderLeaderboard();
  });
});

document.getElementById('menu-settings-btn').addEventListener('click', () => {
  applySettings(currentSave);
  showOnly(settingsOverlay);
});
document.getElementById('settings-back-btn').addEventListener('click', openMenu);

document.getElementById('menu-credits-btn').addEventListener('click', () => {
  showOnly(creditsOverlay);
});
document.getElementById('credits-back-btn').addEventListener('click', openMenu);

// ── Restart / main menu from game over ────────────────────────────────────────
document.getElementById('restart-btn').addEventListener('click', () => {
  if (loop) loop.stop();
  showOnly(null);
  seed(Date.now() & 0xFFFFFFFF);
  startLevel(1, BASE_HEALTH, 'campaign');
});

document.getElementById('menu-from-gameover-btn').addEventListener('click', () => {
  if (loop) loop.stop();
  openMenu();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
function bootstrap() {
  // Pre-warm AudioContext on first keydown
  document.addEventListener('keydown', () => initAudio(), { once: true });
  keys = initInput();
  bindSettingsControls();
  // Show main menu
  showOnly(menuOverlay);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
