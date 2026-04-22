import { SCHEMA_VERSION, RANKING_MODES } from './constants.js';

const STORAGE_KEY = 'arczero.save.v1';
const BOARDS_KEY  = 'arczero.localBoards.v1';

const DEFAULT_SAVE = {
  schemaVersion: SCHEMA_VERSION,
  player: { anonId: null, createdAt: null, displayName: null },
  best: {
    allTime: { score: 0, level: 1, date: null, seed: null },
    perLevel: {},
    longestChain: 0,
    closestMissM: Infinity,
    totalIntercepts: 0,
    totalSurvivedS: 0,
  },
  progress: {
    highestLevelReached: 1,
    unlockedStartLevels: [1],
    sessionsPlayed: 0,
    lastSessionAt: null,
    milestones: {},
  },
  settings: {
    reduceMotion: false,
    soundVolume: 1.0,
    mobileTouchMode: 'auto',
    tapToFire: false,
    colorblindMode: 'off',
    showTrajectoryPreview: true,
    audioVolumes: { master: 1, sfx: 1, music: 1 },
  },
  streak: { current: 0, best: 0, lastPlayDateISO: null, shield: true },
  daily:  { lastCompletedDateISO: null, lastScore: 0, lastSeed: null },
};

function generateAnonId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'az_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(target[k] ?? {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = structuredClone(DEFAULT_SAVE);
      fresh.player.anonId = generateAnonId();
      fresh.player.createdAt = Date.now();
      saveSave(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    // Merge to ensure forward-compat fields exist
    const save = deepMerge(DEFAULT_SAVE, parsed);
    if (save.schemaVersion < 2) {
      save.best.perLevel = {};
      save.schemaVersion = 2;
      saveSave(save);
    }
    return save;
  } catch (e) {
    console.warn('Save corrupt, resetting.', e); // eslint-disable-line no-console
    const fresh = structuredClone(DEFAULT_SAVE);
    fresh.player.anonId = generateAnonId();
    fresh.player.createdAt = Date.now();
    saveSave(fresh);
    return fresh;
  }
}

export function saveSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save write failed.', e); // eslint-disable-line no-console
  }
}

export function updateBest(save, runResult) {
  // runResult: { score, levelScore, level, startLevel, rankingMode, longestChain, closestMissM, intercepts, survivedS, seed, dateISO }
  const b = save.best;
  let updated = false;
  if (runResult.rankingMode !== RANKING_MODES.LEVELRUN && runResult.score > b.allTime.score) {
    b.allTime = { score: runResult.score, level: runResult.level, date: runResult.dateISO, seed: runResult.seed };
    updated = true;
  }
  const lvlBest = b.perLevel[runResult.level] ?? 0;
  if (runResult.levelScore > lvlBest) b.perLevel[runResult.level] = runResult.levelScore;
  if (runResult.longestChain > b.longestChain) b.longestChain = runResult.longestChain;
  if (runResult.closestMissM < b.closestMissM) b.closestMissM = runResult.closestMissM;
  b.totalIntercepts += runResult.intercepts;
  b.totalSurvivedS  += runResult.survivedS;
  save.progress.sessionsPlayed += 1;
  save.progress.lastSessionAt = Date.now();
  if (runResult.level > save.progress.highestLevelReached) {
    save.progress.highestLevelReached = runResult.level;
    if (!save.progress.unlockedStartLevels.includes(runResult.level)) {
      save.progress.unlockedStartLevels.push(runResult.level);
    }
  }
  saveSave(save);
  return updated;
}

export function checkIsChainPB(chain, prevBest) {
  return chain > 1 && chain > prevBest;
}

// --- Local leaderboards ---

export function loadBoards() {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return { daily: {}, weekly: [], allTime: [], levelRuns: {} };
    return JSON.parse(raw);
  } catch { return { daily: {}, weekly: [], allTime: [], levelRuns: {} }; }
}

export function saveBoards(boards) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

/** Shared helper: push entry into list, sort descending by sortKey, cap at limit. */
function pushSortedTopN(list, entry, sortKey, limit = 20) {
  list.push(entry);
  list.sort((a, z) => z[sortKey] - a[sortKey]);
  return list.slice(0, limit);
}

export function submitLocalScore(boards, bucket, entry) {
  boards[bucket] = pushSortedTopN(boards[bucket] || [], entry, 'score');
  saveBoards(boards);
}

export function submitDailyScore(boards, seed, entry) {
  boards.daily = boards.daily || {};
  boards.daily[seed] = pushSortedTopN(boards.daily[seed] || [], entry, 'score');
  saveBoards(boards);
}

export function submitLevelRunScore(boards, entry, level) {
  boards.levelRuns = boards.levelRuns || {};
  boards.levelRuns[level] = pushSortedTopN(boards.levelRuns[level] || [], entry, 'levelScore');
  saveBoards(boards);
}
