import { createState } from './state.js';
import { initInput } from './input.js';
import { startGameLoop } from './gameLoop.js';
import { seed, seedFromDateISO } from './rng.js';
import { initAudio, playLevelUp, toggleMute, isMuted } from './audio.js';
import { LEVELS } from './levels.js';
import { BASE_HEALTH } from './constants.js';
import { loadSave, saveSave, loadBoards, submitLocalScore } from './persistence.js';
import { initTouchInput, shouldUseTouchInput } from './touchInput.js';
import { playMilestone, startAmbient, stopAmbient, playUiClick, playUiConfirm } from './audio.js';
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
const howtoOverlay      = document.getElementById('howto-overlay');
const firstRunOverlay   = document.getElementById('first-run-overlay');

const allOverlays = [
  menuOverlay, levelSelectOverlay, leaderboardOverlay,
  settingsOverlay, creditsOverlay, gameOverOverlay, levelIntroOverlay,
  howtoOverlay, firstRunOverlay,
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
let activeState = null; // current game state, set in startLevel — used by pause handler

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
  document.getElementById('setting-name').value = save.player.displayName ?? '';
  document.getElementById('setting-trajectory').checked = save.settings.showTrajectoryPreview;
  document.getElementById('setting-reduce-motion').checked = save.settings.reduceMotion;
  document.getElementById('setting-volume').value = save.settings.soundVolume;
}

function sanitizeName(raw) {
  // eslint-disable-next-line no-control-regex
  const cleaned = String(raw).replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 16);
  return cleaned.length ? cleaned : null;
}

function bindSettingsControls() {
  document.getElementById('setting-name').addEventListener('change', (e) => {
    const name = sanitizeName(e.target.value);
    currentSave.player.displayName = name;
    e.target.value = name ?? '';
    saveSave(currentSave);
  });
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
function showGameOverScreen(runResult, isPB, prevLvlBest) {
  const scoreEl  = document.getElementById('final-score-value');
  const pbLine   = document.getElementById('pb-line');
  const statChain   = document.getElementById('stat-chain');
  const statClosest = document.getElementById('stat-closest');
  const shareBtn = document.getElementById('share-btn');
  const shareConfirm = document.getElementById('share-confirm');

  // Count-up animation
  const finalScore = runResult.score;
  const prevBest   = isPB ? finalScore : prevLvlBest;
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
      // eslint-disable-next-line no-undef -- browser globals not in ESLint env
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
      activeState = state;
      state.settings.showTrajectoryPreview = currentSave.settings.showTrajectoryPreview;
      state.settings.reduceMotion = currentSave.settings.reduceMotion;

      if (shouldUseTouchInput(currentSave.settings)) {
        initTouchInput(canvas, state, keys);
      }

      startAmbient();

      loop = startGameLoop(ctx, state, keys, {
        onToast(text) { showToast(text); playMilestone(); },
        onLevelComplete(completedLevel) {
          loop.stop();
          keys.reset();
          playLevelUp();
          startLevel(completedLevel + 1, BASE_HEALTH, mode, dailySeed);
        },
        onGameOver(runResult) {
          stopAmbient();
          // Persist
          const lvlBest = currentSave.best.perLevel[runResult.level] ?? 0;
          const isPB = runResult.score > lvlBest;
          // updateBest is called inside gameLoop now; reload save
          currentSave = loadSave();

          // Milestone toasts
          const toasts = checkMilestones(state, currentSave);
          for (const t of toasts) showToast(t);
          saveSave(currentSave);

          // Submit to local boards. Campaign + daily both feed the all-time board;
          // daily additionally feeds the seeded daily bucket. Practice is never ranked.
          if (!state.unranked) {
            const boards = loadBoards();
            const baseEntry = {
              anonId: currentSave.player.anonId,
              name: currentSave.player.displayName ?? 'you',
              ...runResult,
              inputType: state.inputType ?? 'kbd',
              modifiers: [],
            };
            // Always submit an all-time entry (seed stripped so it hits the allTime bucket).
            submitLocalScore(boards, { ...baseEntry, seed: null });
            if (mode === 'daily' && runResult.seed) {
              // Seeded daily-bucket entry for the daily leaderboard tab.
              submitLocalScore(boards, baseEntry);
              currentSave.daily.lastCompletedDateISO = state.dateISO;
              currentSave.daily.lastScore = runResult.score;
              currentSave.daily.lastSeed = dailySeed;
              updateStreak(currentSave, state.dateISO);
              saveSave(currentSave);
            }
          }

          showGameOverScreen({ ...runResult, waveStats: state.stats.waveStats, unranked: state.unranked }, isPB, lvlBest);
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
  playUiConfirm();
  seed(Date.now() & 0xFFFFFFFF);
  startLevel(1, BASE_HEALTH, 'campaign');
});

document.getElementById('menu-daily-btn').addEventListener('click', () => {
  playUiConfirm();
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
  playUiClick();
  renderLevelSelect();
  showOnly(levelSelectOverlay);
});
document.getElementById('level-select-back-btn').addEventListener('click', () => { playUiClick(); openMenu(); });

document.getElementById('menu-leaderboard-btn').addEventListener('click', () => {
  playUiClick();
  currentLbTab = 'daily';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'daily'));
  renderLeaderboard();
  showOnly(leaderboardOverlay);
});
document.getElementById('leaderboard-back-btn').addEventListener('click', () => { playUiClick(); openMenu(); });

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playUiClick();
    currentLbTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderLeaderboard();
  });
});

document.getElementById('menu-settings-btn').addEventListener('click', () => {
  playUiClick();
  applySettings(currentSave);
  showOnly(settingsOverlay);
});
document.getElementById('settings-back-btn').addEventListener('click', () => { playUiClick(); openMenu(); });

document.getElementById('menu-credits-btn').addEventListener('click', () => {
  playUiClick();
  showOnly(creditsOverlay);
});
document.getElementById('credits-back-btn').addEventListener('click', () => { playUiClick(); openMenu(); });

// ── Restart / main menu from game over ────────────────────────────────────────
document.getElementById('restart-btn').addEventListener('click', () => {
  playUiConfirm();
  if (loop) loop.stop();
  showOnly(null);
  seed(Date.now() & 0xFFFFFFFF);
  startLevel(1, BASE_HEALTH, 'campaign');
});

document.getElementById('menu-from-gameover-btn').addEventListener('click', () => {
  playUiClick();
  if (loop) loop.stop();
  openMenu();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
function togglePause() {
  if (!activeState || !activeState.running) return;
  activeState.paused = !activeState.paused;
  if (keys && keys.reset) keys.reset();
}

function maybePromptFirstRunName() {
  if (currentSave.player.displayName) return;
  const modal = document.getElementById('first-run-overlay');
  if (!modal) return;
  const input = document.getElementById('first-run-name');
  const btn   = document.getElementById('first-run-save');
  const skip  = document.getElementById('first-run-skip');
  showOnly(modal);
  input.value = '';
  input.focus();
  const commit = (name) => {
    currentSave.player.displayName = name;
    saveSave(currentSave);
    showOnly(menuOverlay);
  };
  btn.onclick = () => {
    const name = sanitizeName(input.value);
    if (!name) { input.focus(); return; }
    playUiConfirm();
    commit(name);
  };
  skip.onclick = () => { playUiClick(); commit(null); };
  input.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
}

function bootstrap() {
  // Pre-warm AudioContext on first keydown
  document.addEventListener('keydown', () => initAudio(), { once: true });

  // Mute toggle — button + M key
  const muteBtn = document.getElementById('mute-btn');
  const syncMuteBtn = () => muteBtn.classList.toggle('muted', isMuted());
  muteBtn.addEventListener('click', () => { toggleMute(); syncMuteBtn(); });
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' && e.target.tagName !== 'INPUT') {
      toggleMute(); syncMuteBtn();
    }
  });

  keys = initInput(togglePause);
  bindSettingsControls();
  bindHowToPlay();
  // First-run name prompt, then main menu.
  if (!currentSave.player.displayName) maybePromptFirstRunName();
  else showOnly(menuOverlay);
}

function bindHowToPlay() {
  const btn = document.getElementById('menu-howto-btn');
  const back = document.getElementById('howto-back-btn');
  const overlay = document.getElementById('howto-overlay');
  if (btn)   btn.addEventListener('click', () => { playUiClick(); showOnly(overlay); });
  if (back) back.addEventListener('click', () => { playUiClick(); openMenu(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
