import { inject } from '@vercel/analytics';
import { collectRunTotals, createState } from './state.js';
import { initCrazyGames, cgLoadingStart, cgLoadingStop, cgGameplayStart, cgGameplayStop, cgSubmitDailyScore, cgRequestMidgameAd } from './crazygames.js';
import { initInput } from './input.js';
import { startGameLoop } from './gameLoop.js';
import { seed, seedFromDateISO, dailyModifier } from './rng.js';
import { FLAGS } from './flags.js';
import { initAudio, playLevelUp, toggleMute, isMuted, setMasterVolume } from './audio.js';
import { LEVELS } from './levels.js';
import { BASE_HEALTH, STREAK_CALLOUTS, RANKING_MODES, CANVAS_WIDTH, CANVAS_HEIGHT, IS_PORTRAIT } from './constants.js';
import { loadSave, saveSave, loadBoards, submitLocalScore, submitDailyScore, submitLevelRunScore, checkIsChainPB } from './persistence.js';
import { initMobileControls, shouldUseTouchInput } from './touchInput.js';
import { playMilestone, startAmbient, stopAmbient, playUiClick, playUiConfirm } from './audio.js';
import { buildShareText } from './share.js';
import { checkMilestones, updateStreak } from './milestones.js';
import { startRun, submitScore, getDailyTop, getAllTimeTop } from './net/leaderboard.js';
import { getOrCreatePlayerId, getHandle, setHandle } from './net/identity.js';
import { detectDevice } from './net/device.js';

// ── Initialize Vercel Analytics ───────────────────────────────────────────────
inject();

// ── Ad audio helpers ──────────────────────────────────────────────────────────
let _adWasMuted = false;
function adMuteForAd() {
  _adWasMuted = isMuted();
  if (!_adWasMuted) toggleMute();
}
function adRestoreAfterAd() {
  if (!_adWasMuted) toggleMute();
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.classList.toggle('muted', isMuted());
}

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

function showToast(msg) {
  const text = typeof msg === 'string' ? msg : msg.text;
  const kind = typeof msg === 'string' ? null : msg.kind;
  const el = document.createElement('div');
  el.className = kind ? `toast toast-${kind}` : 'toast';
  el.textContent = text;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Global state ──────────────────────────────────────────────────────────────
let keys = null;
let loop = null;
let currentSave = loadSave();
let activeState = null; // current game state, set in startLevel — used by pause handler

// ── Online run-token state ────────────────────────────────────────────────────
let _pendingRunToken = null;  // set by startRun at run start; consumed at game-over
let _pendingDeviceType = 'desktop';

// ── Leaderboard rendering ─────────────────────────────────────────────────────
let currentLbTab = 'online-today';
let currentDeviceFilter = 'all';

async function renderLeaderboard() {
  const boards = loadBoards();
  const list = document.getElementById('leaderboard-list');
  const controls = document.getElementById('leaderboard-controls');
  const deviceFilterEl = document.getElementById('lb-device-filter');
  list.innerHTML = '';
  controls.style.display = 'none';
  deviceFilterEl.style.display = 'none';

  // ── Online tabs ──────────────────────────────────────────────────────────────
  if (currentLbTab === 'online-today' || currentLbTab === 'online-alltime') {
    deviceFilterEl.style.display = 'block';
    list.innerHTML = '<div style="color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:13px;">loading...</div>';
    let rows = [];
    try {
      rows = currentLbTab === 'online-today' ? await getDailyTop(100) : await getAllTimeTop(100);
    } catch { /* network unavailable */ }
    list.innerHTML = '';

    const myOnlineId = getOrCreatePlayerId();
    const filtered = currentDeviceFilter === 'all' ? rows : rows.filter(r => r.device === currentDeviceFilter);

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:13px;line-height:1.5em';
      emptyDiv.textContent = rows.length === 0
        ? (currentLbTab === 'online-today' ? 'no scores today yet' : 'no online scores yet')
        : `no ${currentDeviceFilter} scores`;
      const sub = document.createElement('span');
      sub.style.cssText = 'font-size:11px;opacity:0.5;display:block;';
      sub.textContent = rows.length === 0 ? 'play a run to appear here' : 'try a different filter';
      emptyDiv.appendChild(sub);
      list.appendChild(emptyDiv);
      return;
    }

    filtered.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (e.player_id === myOnlineId ? ' me' : '');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = String(e.rank ?? '?');
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = e.handle ?? '???';
      const deviceTag = document.createElement('span');
      deviceTag.style.cssText = 'color:rgba(255,255,255,0.3);font-size:10px;margin-right:8px;min-width:14px;text-align:right;';
      deviceTag.textContent = e.device === 'mobile' ? 'M' : 'D';
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = String(e.score);
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(deviceTag);
      row.appendChild(score);
      list.appendChild(row);
    });
    return;
  }

  // ── Achievements / Records ───────────────────────────────────────────────────
  if (currentLbTab === 'achievements') {
    currentSave = loadSave(); // ensure freshest data (e.g. just finished a run)
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
      ['Longest Chain',    `×${ch}`,     '#ffd700'],
      ['Closest Miss',     cl,               '#ff9944'],
      ['Total Intercepts', String(inter),    '#44aaff'],
      ['Total Survived',   surv,             '#44ffee'],
      ['Best Level',       String(b.allTime.level ?? 1), 'rgba(255,255,255,0.75)'],
    ];
    const note = document.createElement('div');
    note.style.cssText = 'text-align:center;color:rgba(255,255,255,0.3);margin-bottom:12px;font-size:11px;';
    note.textContent = 'Personal Records — lifetime stats';
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

  // ── Local all-time (tab: 'allTime') ──────────────────────────────────────────
  const entries = boards.allTime ?? [];
  if (entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:rgba(255,255,255,0.3);padding:20px;text-align:center;font-size:13px;line-height:1.5em';
    emptyDiv.textContent = 'no runs yet';
    const sub = document.createElement('span');
    sub.style.cssText = 'font-size:11px;opacity:0.5;display:block;';
    sub.textContent = 'play a campaign to get on the board';
    emptyDiv.appendChild(sub);
    list.appendChild(emptyDiv);
    return;
  }
  const myAnonId = currentSave.player.anonId;
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (e.anonId === myAnonId ? ' me' : '');
    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = e.name ?? 'you';
    if (e.modifier && e.modifier !== 'standard') {
      const modTag = document.createElement('span');
      modTag.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4)';
      modTag.title = e.modifier;
      modTag.textContent = ` ${e.modifier.slice(0, 3).toUpperCase()}`;
      name.appendChild(modTag);
    }
    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = String(e.score);
    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(score);
    list.appendChild(row);
  });
}

// ── Settings persistence ──────────────────────────────────────────────────────
function applySettings(save) {
  document.getElementById('setting-name').value = save.player.displayName ?? '';
  document.getElementById('setting-trajectory').checked = save.settings.showTrajectoryPreview;
  document.getElementById('setting-reduce-motion').checked = save.settings.reduceMotion;
  // audioVolumes.master is the authoritative volume (written by setMasterVolume).
  // Fall back to soundVolume for saves written before this fix.
  const vol = save.settings.audioVolumes?.master ?? save.settings.soundVolume ?? 1;
  document.getElementById('setting-volume').value = vol;
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
    const v = parseFloat(e.target.value);
    currentSave.settings.soundVolume = v;
    setMasterVolume(v); // updates audio graph + persists audioVolumes.master
    currentSave = loadSave();
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

// ── Online game-over flow ─────────────────────────────────────────────────────
async function showGameOverOnlineFlow(runResult) {
  const rankLine = document.getElementById('online-rank-line');
  const handlePrompt = document.getElementById('handle-prompt');
  if (!rankLine || !handlePrompt) return;

  const token = _pendingRunToken;
  _pendingRunToken = null;
  if (!token) return; // no token means startRun failed — skip silently

  const playerId = getOrCreatePlayerId();
  const deviceType = _pendingDeviceType;
  const durationMs = Math.round((runResult.survivedS ?? 0) * 1000);

  async function doSubmit(handle) {
    const result = await submitScore({
      score: runResult.score,
      token,
      durationMs,
      device: deviceType,
      handle,
      seed: String(runResult.seed ?? 0),
      playerId,
    });
    if (result.ok && result.accepted) {
      rankLine.textContent = `Daily: #${result.rank_daily ?? '?'} · All-time: #${result.rank_alltime ?? '?'}`;
      rankLine.style.display = 'block';
    }
    // On rejection: show nothing — don't reveal to potential cheaters that the check fired
  }

  const existingHandle = getHandle();
  if (existingHandle) {
    doSubmit(existingHandle);
  } else {
    handlePrompt.style.display = 'block';
    const input = document.getElementById('handle-input');
    const btn = document.getElementById('handle-submit');
    input.value = '';
    const commit = async () => {
      const raw = input.value.trim().slice(0, 20);
      if (!raw) { input.focus(); return; }
      handlePrompt.style.display = 'none';
      setHandle(raw);
      await doSubmit(raw);
    };
    btn.onclick = commit;
    input.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
    input.focus();
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

  // Reset online elements for this game-over
  const rankLineEl = document.getElementById('online-rank-line');
  const handlePromptEl = document.getElementById('handle-prompt');
  if (rankLineEl) rankLineEl.style.display = 'none';
  if (handlePromptEl) handlePromptEl.style.display = 'none';

  showOnly(gameOverOverlay);
}

// ── Core start/loop ───────────────────────────────────────────────────────────
function startLevel(level, carryHealth = BASE_HEALTH, mode = RANKING_MODES.CAMPAIGN, dailySeed = null, carryScore = 0, initialStartLevel = null, carryAegis = null, carryRunTotals = null) {
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
      const state = createState(safeLevel, carryHealth, carryScore, carryAegis, carryRunTotals);
      state.startLevel = initialStartLevel !== null ? initialStartLevel : safeLevel;
      state.mode   = mode;
      state.seed   = dailySeed;
      state.dateISO = dailySeed ? new Date().toISOString().slice(0, 10) : null;
      state.rankingMode = mode;
      
      state.dailyModifier = (mode === RANKING_MODES.DAILY && FLAGS.DAILY_MODIFIERS) ? dailyModifier(state.dateISO) : 'standard';
      
      activeState = state;

      // Fire startRun in background — store token for online submit at game-over
      _pendingRunToken = null;
      _pendingDeviceType = detectDevice();
      startRun({ seed: dailySeed ?? Date.now(), device: _pendingDeviceType, playerId: getOrCreatePlayerId() })
        .then(r => { if (r.ok) _pendingRunToken = r.token; });

      state.settings.showTrajectoryPreview = currentSave.settings.showTrajectoryPreview;
      state.settings.reduceMotion = currentSave.settings.reduceMotion;
      
      if (state.dailyModifier === 'noradar') {
        state.settings.showTrajectoryPreview = false;
      }
      if (state.dailyModifier === 'precision') {
        state.modifierOverrideTrajectory = true;
      }

      if (shouldUseTouchInput(currentSave.settings)) {
        document.getElementById('mobile-controls').classList.add('visible');
      }

      startAmbient();
      cgGameplayStart();

      loop = startGameLoop(ctx, state, keys, {
        onToast(text) { showToast(text); playMilestone(); },
        onLevelComplete(completedLevel) {
          cgGameplayStop();
          loop.stop();
          keys.reset();
          playLevelUp();
          const carryScore = (mode === RANKING_MODES.CAMPAIGN || mode === RANKING_MODES.DAILY) ? state.score : 0;
          const carryRunTotals = (mode === RANKING_MODES.CAMPAIGN || mode === RANKING_MODES.DAILY) ? collectRunTotals(state) : null;
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
            startLevel(completedLevel + 1, BASE_HEALTH, mode, dailySeed, carryScore, state.startLevel, state.aegis, carryRunTotals);
          };
          levelSummaryOverlay.addEventListener('click', onClickNext, { once: true });
          if (mode === RANKING_MODES.CAMPAIGN) {
            cgRequestMidgameAd({ onStart: adMuteForAd, onComplete: adRestoreAfterAd });
          }
        },
        onGameOver(runResult) {
          cgGameplayStop();
          stopAmbient();
          document.getElementById('mobile-controls').classList.remove('visible');
          // Capture pre-run save for PB comparison and new-unlock detection.
          const prevUnlocked = currentSave.progress.unlockedStartLevels.slice();
          const prevChainBest = currentSave.best.longestChain ?? 0;
          // isPB: for LEVELRUN compare survival score vs per-level best; for Campaign/Daily compare total score vs all-time.
          let lvlBest, isPB;
          if (runResult.rankingMode === RANKING_MODES.LEVELRUN) {
            lvlBest = currentSave.best.perLevel[runResult.startLevel] ?? 0;
            isPB = runResult.levelScore > lvlBest;
          } else {
            lvlBest = currentSave.best.allTime?.score ?? 0;
            isPB = runResult.score > lvlBest;
          }
          const isChainPB = checkIsChainPB(runResult.longestChain, prevChainBest);

          // updateBest is called inside gameLoop now; reload save
          currentSave = loadSave();

          // Show unlock toast if a new level was just unlocked via LEVELRUN criteria clear.
          if (runResult.rankingMode === RANKING_MODES.LEVELRUN && runResult.criteriaCleared) {
            const nextLevel = runResult.startLevel + 1;
            if (!prevUnlocked.includes(nextLevel) && currentSave.progress.unlockedStartLevels.includes(nextLevel)) {
              showToast(`LEVEL ${nextLevel} UNLOCKED`);
            }
          }

          // Milestone toasts — mutate currentSave, requiring a second saveSave (updateBest already wrote once).
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
              cgSubmitDailyScore(runResult.score);
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

          showGameOverScreen({ ...runResult, rankingMode: state.rankingMode }, isPB, lvlBest, isChainPB);
          // Online submit — non-blocking; degrades silently if network unavailable
          showGameOverOnlineFlow({ ...runResult, rankingMode: state.rankingMode });
          cgRequestMidgameAd({ onStart: adMuteForAd, onComplete: adRestoreAfterAd });
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
  document.getElementById('mobile-controls').classList.remove('visible');
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
  currentLbTab = 'online-today';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'online-today'));
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
  if (activeState.paused) cgGameplayStop();
  else cgGameplayStart();
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
  cgLoadingStart(); // no-op here (SDK not ready); real loadingStart fires in initCrazyGames()
  initCrazyGames(); // fire-and-forget; portal-only, non-blocking
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  if (IS_PORTRAIT) document.body.setAttribute('data-portrait', 'true');

  // Pre-warm AudioContext on first keydown or first touch (whichever fires first)
  const _initAudioOnce = () => {
    initAudio();
    document.removeEventListener('keydown',    _initAudioOnce);
    document.removeEventListener('touchstart', _initAudioOnce);
  };
  document.addEventListener('keydown',    _initAudioOnce, { once: true });
  document.addEventListener('touchstart', _initAudioOnce, { once: true, passive: true });

  // Pause button
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => { playUiClick(); togglePause(); });

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
  if (shouldUseTouchInput(currentSave.settings)) {
    initMobileControls(keys, () => activeState);
  }
  bindSettingsControls();
  bindHowToPlay();
  // Device filter chips for online leaderboard tabs
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentDeviceFilter = chip.dataset.device;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderLeaderboard();
    });
  });
  cgLoadingStop();
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
