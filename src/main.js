import { createState } from './state.js';
import { initInput } from './input.js';
import { startGameLoop } from './gameLoop.js';
import { seed, seedFromDateISO, dailyModifier } from './rng.js';
import { FLAGS } from './flags.js';
import { initAudio, playLevelUp, toggleMute, isMuted } from './audio.js';
import { LEVELS } from './levels.js';
import { BASE_HEALTH, STREAK_CALLOUTS, RANKING_MODES } from './constants.js';
import { loadSave, saveSave, loadBoards, submitLocalScore, submitDailyScore, submitLevelRunScore, checkIsChainPB } from './persistence.js';
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
const levelSummaryOverlay = document.getElementById('level-summary-overlay');

const allOverlays = [
  menuOverlay, levelSelectOverlay, leaderboardOverlay,
  settingsOverlay, creditsOverlay, gameOverOverlay, levelIntroOverlay,
  howtoOverlay, firstRunOverlay, levelSummaryOverlay,
];

let transitionActive = false;

function showOnly(overlay) {
  if (overlay !== levelSummaryOverlay && overlay !== levelIntroOverlay) {
    transitionActive = false;
  }
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
let currentLbLevel = null;

function renderLeaderboard() {
  const boards = loadBoards();
  const list = document.getElementById('leaderboard-list');
  const controls = document.getElementById('leaderboard-controls');
  list.innerHTML = '';
  controls.style.display = 'none';
  if (currentLbTab === 'achievements') {
    currentSave = loadSave(); // ensure we have the freshest data (e.g. just finished a run)
    const b = currentSave.best;
    const ch = b.longestChain;
    const cl = (b.closestMissM == null || b.closestMissM === Infinity) ? '—' : b.closestMissM.toFixed(1) + 'm';
    const inter = b.totalIntercepts;
    const surv = Math.floor(b.totalSurvivedS / 3600) + 'h ' + Math.floor((b.totalSurvivedS % 3600) / 60) + 'm';

    if (b.totalIntercepts === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:13px;';
      msg.textContent = 'play your first run to see personal records';
      list.appendChild(msg);
      return;
    }
    const statsData = [
      ['Longest Chain',    `\u00d7${ch}`,     '#ffd700'],
      ['Closest Miss',     cl,               '#ff9944'],
      ['Total Intercepts', String(inter),    '#44aaff'],
      ['Total Survived',   surv,             '#44ffee'],
      ['Best Level',       String(b.allTime.level ?? 1), 'rgba(255,255,255,0.75)'],
    ];
    const note = document.createElement('div');
    note.style.cssText = 'text-align:center;color:rgba(255,255,255,0.3);margin-bottom:12px;font-size:11px;';
    note.textContent = 'Personal Records — vs. others coming in v2';
    list.appendChild(note);
    const grid = document.createElement('div');
    grid.style.cssText = 'font-size:13px;line-height:2.2em;margin-top:6px;width:100%;';
    for (const [label, value, color] of statsData) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);padding:2px 0;';
      const lbl = document.createElement('span');
      lbl.style.color = 'rgba(255,255,255,0.55)';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.style.cssText = `color:${color};font-weight:700;`;
      val.textContent = value;
      row.appendChild(lbl);
      row.appendChild(val);
      grid.appendChild(row);
    }
    list.appendChild(grid);
    return;
  }

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
  } else if (currentLbTab === 'levelrun') {
    controls.style.display = 'block';
    if (currentLbLevel === null) currentLbLevel = currentSave.progress.highestLevelReached ?? 1;
    let selectHtml = `<select id="lb-level-select" aria-label="Select starting level for Level Runs leaderboard" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-family: 'Courier New', monospace; font-size: 12px; border-radius: 3px; padding: 4px 8px">`;
    for(let i = 1; i < LEVELS.length; i++) {
      selectHtml += `<option value="${i}" ${i === currentLbLevel ? 'selected' : ''}>LEVEL ${i}</option>`;
    }
    selectHtml += `</select>`;
    controls.innerHTML = selectHtml;
    document.getElementById('lb-level-select').addEventListener('change', (e) => {
      currentLbLevel = parseInt(e.target.value, 10);
      renderLeaderboard();
    });
    entries = boards.levelRuns[currentLbLevel] ?? [];
  } else {
    entries = boards.allTime;
  }

  if (entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:13px;line-height:1.5em';
    const msgs = {
      allTime:  ['no runs yet', 'play a campaign to get on the board'],
      daily:    ['no attempts today', "today's challenge resets at midnight"],
      weekly:   ['no daily runs this week', 'play the daily challenge to appear here'],
      levelrun: ['no level runs yet', 'start from level select to rank here'],
    };
    const [main, sub] = msgs[currentLbTab] ?? ['no entries', ''];
    emptyDiv.textContent = main;
    if (sub) {
      const subEl = document.createElement('span');
      subEl.style.cssText = 'font-size:11px;opacity:0.5;display:block;';
      subEl.textContent = sub;
      emptyDiv.appendChild(subEl);
    }
    list.appendChild(emptyDiv);
    return;
  }

  const myId = currentSave.player.anonId;
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (e.anonId === myId ? ' me' : '');

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(i + 1);

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = e.name ?? 'you';

    const score = document.createElement('span');
    score.className = 'lb-score';

    row.appendChild(rank);
    if (currentLbTab === 'levelrun') {
      const lvlTag = document.createElement('span');
      lvlTag.style.cssText = 'color:rgba(255,255,255,0.5);font-size:11px;margin-right:12px';
      lvlTag.textContent = `L${e.startLevel ?? '?'}`;
      row.appendChild(name);
      row.appendChild(lvlTag);
      score.textContent = String(e.levelScore ?? 0);
    } else {
      if (e.modifier && e.modifier !== 'standard') {
        const modTag = document.createElement('span');
        modTag.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4)';
        modTag.title = e.modifier;
        modTag.textContent = ` ${e.modifier.slice(0, 3).toUpperCase()}`;
        name.appendChild(modTag);
      }
      row.appendChild(name);
      score.textContent = String(e.score);
    }
    row.appendChild(score);
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
  currentSave = loadSave();
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
        startLevel(lvl, BASE_HEALTH, RANKING_MODES.LEVELRUN);
      });
    }
    list.appendChild(btn);
  }
}

// ── Game-over PB overlay ──────────────────────────────────────────────────────
function showGameOverScreen(runResult, isPB, prevLvlBest, isChainPB) {
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
  const closest = (runResult.closestMissM == null || runResult.closestMissM === Infinity) ? '—' : runResult.closestMissM.toFixed(1) + 'm';
  if (isChainPB) {
    statChain.textContent = `CHAIN \u00d7${runResult.longestChain} `;
    const badge = document.createElement('span');
    badge.style.color = '#ffd700';
    badge.textContent = '(NEW BEST!)';
    statChain.appendChild(badge);
  } else {
    statChain.textContent = `CHAIN \u00d7${runResult.longestChain}`;
  }
  statClosest.textContent = `CLOSEST ${closest}`;

  // Share button (daily only)
  if (runResult.seed !== null && runResult.rankingMode !== RANKING_MODES.UNRANKED) {
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
function startLevel(level, carryHealth = BASE_HEALTH, mode = RANKING_MODES.CAMPAIGN, dailySeed = null, carryScore = 0, initialStartLevel = null, carryAegis = null) {
  playUiConfirm();
  const safeLevel = Math.min(level, LEVELS.length - 1);
  transitionActive = true;
  showOnly(levelIntroOverlay);

  const introEl = document.getElementById('level-intro-title');
  const introText = document.getElementById('level-intro-text');
  const cdEl = document.getElementById('level-intro-countdown');
  const cfg = LEVELS[safeLevel];
  introEl.textContent = cfg.label ?? `LEVEL ${safeLevel}`;
  
  let modText = '';
  if (mode === RANKING_MODES.DAILY && FLAGS.DAILY_MODIFIERS) {
    const fakeIso = dailySeed ? new Date().toISOString().slice(0, 10) : null;
    const dm = dailyModifier(fakeIso);
    if (dm === 'speedrun') modText = 'SPEEDRUN: 1.5X SPAWNS';
    if (dm === 'noradar') modText = 'NO RADAR: PREVIEWS DISABLED';
    if (dm === 'precision') modText = 'PRECISION: PREVIEWS FORCED ON';
  }
  introText.textContent = modText || (cfg.intro ?? '');
  
  cdEl.textContent = '3';

  let count = 3;
  const tick = () => {
    if (!transitionActive) return;
    count--;
    if (count <= 0) {
      showOnly(null);
      const state = createState(safeLevel, carryHealth, carryScore, carryAegis);
      state.startLevel = initialStartLevel !== null ? initialStartLevel : safeLevel;
      state.mode   = mode;
      state.seed   = dailySeed;
      state.dateISO = dailySeed ? new Date().toISOString().slice(0, 10) : null;
      state.rankingMode = mode;
      
      state.dailyModifier = (mode === RANKING_MODES.DAILY && FLAGS.DAILY_MODIFIERS) ? dailyModifier(state.dateISO) : 'standard';
      
      activeState = state;
      state.settings.showTrajectoryPreview = currentSave.settings.showTrajectoryPreview;
      state.settings.reduceMotion = currentSave.settings.reduceMotion;
      
      if (state.dailyModifier === 'noradar') {
        state.settings.showTrajectoryPreview = false;
      }
      if (state.dailyModifier === 'precision') {
        state.modifierOverrideTrajectory = true;
      }

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
          const carryScore = (mode === RANKING_MODES.CAMPAIGN || mode === RANKING_MODES.DAILY) ? state.score : 0;
          const pointsEarned = state.score - state.levelStartScore;
          
          transitionActive = true;
          showOnly(levelSummaryOverlay);
          
          document.getElementById('level-summary-title').textContent = `LEVEL ${completedLevel} COMPLETE`;
          const scoreEl = document.getElementById('level-summary-score');
          
          if (pointsEarned > 0) {
            let current = 0;
            const start = performance.now();
            const dur = 600;
            function animateScore(ts) {
              if (!transitionActive) return;
              const t = Math.min((ts - start) / dur, 1);
              const eased = 1 - Math.pow(1 - t, 3);
              current = Math.floor(eased * pointsEarned);
              scoreEl.textContent = `+${current}`;
              if (t < 1) requestAnimationFrame(animateScore);
              else scoreEl.textContent = `+${Math.floor(pointsEarned)}`;
            }
            requestAnimationFrame(animateScore);
          } else {
            scoreEl.textContent = '+0';
          }
          
          let achText = '';
          if (state.combo && state.combo.best >= 2) {
            const bestCallout = STREAK_CALLOUTS.slice().reverse().find(c => c.count <= state.combo.best);
            if (bestCallout) {
              achText = `BEST CHAIN: ${bestCallout.text.toUpperCase()} (×${state.combo.best})`;
            }
          }
          document.getElementById('level-summary-achievement').textContent = achText;

          // Stat grid
          const shots = state.stats.shots ?? 0;
          const intercepts = state.stats.intercepts ?? 0;
          const nearMisses = state.stats.nearMisses ?? 0;
          const levelElapsed = state.totalElapsedS ?? 0;
          const accPct = shots > 0 ? Math.round((intercepts / shots) * 100) : 100;
          const mins = Math.floor(levelElapsed / 60);
          const secs = Math.floor(levelElapsed % 60);
          document.getElementById('lss-intercepts').textContent  = intercepts;
          document.getElementById('lss-accuracy').textContent    = `${accPct}%`;
          document.getElementById('lss-nearmisses').textContent  = nearMisses;
          document.getElementById('lss-time').textContent        = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

          const onClickNext = () => {
            if (!transitionActive) return;
            startLevel(completedLevel + 1, BASE_HEALTH, mode, dailySeed, carryScore, state.startLevel, state.aegis);
          };
          levelSummaryOverlay.addEventListener('click', onClickNext, { once: true });
        },
        onGameOver(runResult) {
          stopAmbient();
          // Persist
          const lvlBest = currentSave.best.perLevel[runResult.level] ?? 0;
          const prevChainBest = currentSave.best.longestChain ?? 0;
          const isPB = runResult.score > lvlBest;
          const isChainPB = checkIsChainPB(runResult.longestChain, prevChainBest);
          
          // updateBest is called inside gameLoop now; reload save
          currentSave = loadSave();

          // Milestone toasts
          const toasts = checkMilestones(state, currentSave);
          for (const t of toasts) showToast(t);
          saveSave(currentSave);

          // Submit to local boards based on ranking mode
          if (state.rankingMode !== RANKING_MODES.UNRANKED) {
            const boards = loadBoards();
            const baseEntry = {
              anonId: currentSave.player.anonId,
              name: currentSave.player.displayName ?? 'you',
              ...runResult,
              levelScore: runResult.levelScore,   // explicit — ensures levelRuns board sorts correctly
              inputType: state.inputType ?? 'kbd',
              modifiers: [],
            };
            if (state.rankingMode === RANKING_MODES.CAMPAIGN) {
              submitLocalScore(boards, 'allTime', { ...baseEntry, seed: null });
            }
            if (state.rankingMode === RANKING_MODES.DAILY && runResult.seed) {
              submitDailyScore(boards, runResult.seed, baseEntry);
              currentSave.daily.lastCompletedDateISO = state.dateISO;
              currentSave.daily.lastScore = runResult.score;
              currentSave.daily.lastSeed = dailySeed;
              updateStreak(currentSave, state.dateISO);
              saveSave(currentSave);
            }
            if (state.rankingMode === RANKING_MODES.LEVELRUN) {
              submitLevelRunScore(boards, baseEntry, state.startLevel);
            }
          }

          showGameOverScreen({ ...runResult, waveStats: state.stats.waveStats, rankingMode: state.rankingMode }, isPB, lvlBest, isChainPB);
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
  startLevel(1, BASE_HEALTH, RANKING_MODES.CAMPAIGN);
});

document.getElementById('menu-daily-btn').addEventListener('click', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const dailySeed = seedFromDateISO(todayISO);
  seed(dailySeed);
  if (currentSave.daily.lastCompletedDateISO === todayISO) {
    showToast(`Already played today (${currentSave.daily.lastScore}). Replaying unranked.`);
    startLevel(1, BASE_HEALTH, RANKING_MODES.UNRANKED, dailySeed);
    return;
  }
  startLevel(1, BASE_HEALTH, RANKING_MODES.DAILY, dailySeed);
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
  if (loop) loop.stop();
  showOnly(null);
  
  if (!activeState) {
    seed(Date.now() & 0xFFFFFFFF);
    startLevel(1, BASE_HEALTH, RANKING_MODES.CAMPAIGN);
    return;
  }

  const mode = activeState.rankingMode;
  const startLvl = activeState.startLevel;
  const prevSeed = activeState.seed;

  if (mode === RANKING_MODES.DAILY || mode === RANKING_MODES.UNRANKED) {
    seed(prevSeed);
    startLevel(startLvl, BASE_HEALTH, RANKING_MODES.UNRANKED, prevSeed);
  } else if (mode === RANKING_MODES.LEVELRUN) {
    seed(Date.now() & 0xFFFFFFFF);
    startLevel(startLvl, BASE_HEALTH, RANKING_MODES.LEVELRUN);
  } else {
    seed(Date.now() & 0xFFFFFFFF);
    startLevel(1, BASE_HEALTH, RANKING_MODES.CAMPAIGN);
  }
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
