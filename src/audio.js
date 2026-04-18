/**
 * Audio system — 20-slot sound engine.
 *
 * Architecture:
 *   Master bus → sfx bus  → one-shot sources
 *             → music bus → ambientLoop, peakWaveBed, menuAmbient
 *
 * Features:
 *   - Polyphony caps per slot (retrigger cuts oldest when at cap)
 *   - Ducking: intercept/damage/transition events duck music buses 400ms
 *   - Crossfade: peakWaveBed fades in/out 2s on PEAK↔RELEASE transitions
 *   - Trimming: mirv_split [0→0.5s], wave_start [13.5→16s]
 *   - Layering: playIntercept fires thump in same tick
 *   - Mobile unlock: AudioContext resumed on first user gesture
 *   - Bus gains persisted via persistence.js
 */

import { loadSave, saveSave } from './persistence.js';

// ---------------------------------------------------------------------------
// Slot definitions
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const SOUNDS = {
  // Beds (music bus)
  ambientLoop:   '/audio/ambient_loop.mp3',
  peakWaveBed:   '/audio/peak_wave_bed.mp3',
  menuAmbient:   '/audio/menu_ambient.mp3',
  // Player (sfx bus)
  shoot:         '/audio/shoot.mp3',
  dryClick:      '/audio/dry_click.mp3',
  intercept:     '/audio/intercept.mp3',
  thump:         '/audio/thump.wav',
  graze:         '/audio/graze.wav',
  // Events (sfx bus)
  courierAlert:  '/audio/courier_alert.mp3',
  splitterSplit: '/audio/splitter_split.wav',
  mirvSplit:     '/audio/mirv_split.mp3',
  // Scoring (sfx bus)
  comboUp:       '/audio/combo_up.mp3',
  comboPeak:     '/audio/combo_peak.mp3',
  milestone:     '/audio/milestone.mp3',
  damage:        '/audio/damage.mp3',
  // Transitions (sfx bus)
  waveWarning:   '/audio/wave_warning.wav',
  waveStart:     '/audio/wave_start.mp3',
  levelUp:       '/audio/level_up.mp3',
  levelClear:    '/audio/level_clear.mp3',
  gameOver:      '/audio/game-over.mp3',
  // UI (sfx bus)
  uiClick:       '/audio/ui_click.wav',
  uiConfirm:     '/audio/ui_confirm.mp3',
};

/** Mix gain per slot (0–1). Applied on the source before the bus. */
const SLOT_GAIN = {
  ambientLoop:   0.35,
  peakWaveBed:   0.40,
  menuAmbient:   0.35,
  shoot:         0.60,
  dryClick:      0.40,
  intercept:     0.75,
  thump:         0.50,
  graze:         0.45,
  courierAlert:  0.55,
  splitterSplit: 0.60,
  mirvSplit:     0.65,
  comboUp:       0.50,
  comboPeak:     0.65,
  milestone:     0.65,
  damage:        0.75,
  waveWarning:   0.55,
  waveStart:     0.60,
  levelUp:       0.70,
  levelClear:    0.70,
  gameOver:      0.75,
  uiClick:       0.45,
  uiConfirm:     0.55,
};

/** Max simultaneous playing instances per slot. Oldest cut when exceeded. */
const POLYPHONY = {
  graze:        2,
  intercept:    3,
  thump:        3,
  comboUp:      4,
  // default for all others: 1
};

/** Slots that trigger 400ms duck on ambientLoop + peakWaveBed. */
const DUCK_TRIGGERS = new Set([
  'intercept', 'damage', 'levelUp', 'levelClear', 'gameOver', 'waveWarning',
]);

/** Trim [start, end] in seconds. null = play full buffer. */
const TRIM = {
  mirvSplit: [0,    0.5],
  waveStart: [13.5, 16.0],
};

/** Slots routed to music bus (rest go sfx bus). */
const MUSIC_SLOTS = new Set(['ambientLoop', 'peakWaveBed', 'menuAmbient']);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _ctx = null;
let _masterGain = null;
let _sfxGain    = null;
let _musicGain  = null;

/** @type {Record<string, AudioBuffer|null>} */
const _buffers = {};

/** Active playing sources per slot for polyphony management. */
const _active = {};  // slot → AudioBufferSourceNode[]

/** Looping bed nodes (kept alive). */
let _ambientSource   = null;
let _ambientGain     = null;
let _peakBedSource   = null;
let _peakBedGain     = null;
let _menuSource      = null;
let _menuGain        = null;

let _loadStarted = false;

// ---------------------------------------------------------------------------
// Context + bus setup
// ---------------------------------------------------------------------------

function getCtx() {
  if (!_ctx) {
    _ctx = new AudioContext();
    _buildBuses();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

function _buildBuses() {
  _masterGain = _ctx.createGain();
  _sfxGain    = _ctx.createGain();
  _musicGain  = _ctx.createGain();

  _sfxGain.connect(_masterGain);
  _musicGain.connect(_masterGain);
  _masterGain.connect(_ctx.destination);

  // Restore persisted volumes
  const save = loadSave();
  const vol = save.settings.audioVolumes ?? { master: 1, sfx: 1, music: 1 };
  _masterGain.gain.value = vol.master ?? 1;
  _sfxGain.gain.value    = vol.sfx    ?? 1;
  _musicGain.gain.value  = vol.music  ?? 1;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function _loadBuffer(ctx, name, url) {
  try {
    const res = await fetch(url);
    const ab  = await res.arrayBuffer();
    _buffers[name] = await ctx.decodeAudioData(ab);
  } catch {
    _buffers[name] = null;
  }
}

/**
 * Pre-load all audio files. Call once on first user gesture.
 * Subsequent calls are no-ops.
 */
let _loadPromise = null;
export function initAudio() {
  if (_loadStarted) return _loadPromise;
  _loadStarted = true;
  const ctx = getCtx();
  _loadPromise = Promise.all(
    Object.entries(SOUNDS).map(([name, url]) => _loadBuffer(ctx, name, url))
  );
  return _loadPromise;
}

// Mobile unlock: resume on any touch/click before explicit initAudio call
function _unlockOnGesture() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}
document.addEventListener('touchstart', _unlockOnGesture, { once: false, passive: true });
document.addEventListener('click',      _unlockOnGesture, { once: false, passive: true });

// ---------------------------------------------------------------------------
// Core playback
// ---------------------------------------------------------------------------

/**
 * Play a one-shot buffer with optional trim [startS, endS].
 * Routes through sfx or music bus based on slot.
 * Enforces polyphony cap.
 * Returns the created source node (or null if buffer missing).
 */
function _play(name, pitchVariance = 0) {
  if (!_loadStarted) initAudio();
  const ctx    = getCtx();
  const buffer = _buffers[name];
  if (!buffer) return null;

  // Polyphony cap
  const cap = POLYPHONY[name] ?? 1;
  if (!_active[name]) _active[name] = [];
  const pool = _active[name];
  if (pool.length >= cap) {
    // Stop oldest
    try { pool[0].stop(); } catch { /* already ended */ }
    pool.shift();
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  if (pitchVariance > 0) {
    // eslint-disable-next-line no-restricted-properties -- pitch jitter, UX only
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchVariance;
  }

  const slotGain = ctx.createGain();
  slotGain.gain.value = SLOT_GAIN[name] ?? 1;

  const bus = MUSIC_SLOTS.has(name) ? _musicGain : _sfxGain;
  source.connect(slotGain);
  slotGain.connect(bus);

  const trim = TRIM[name];
  if (trim) {
    const [startS, endS] = trim;
    source.start(ctx.currentTime, startS, endS - startS);
  } else {
    source.start(ctx.currentTime);
  }

  pool.push(source);
  source.addEventListener('ended', () => {
    const idx = pool.indexOf(source);
    if (idx !== -1) pool.splice(idx, 1);
  });

  // Duck music buses if this slot is a duck trigger
  if (DUCK_TRIGGERS.has(name)) _duck();

  return source;
}

// ---------------------------------------------------------------------------
// Ducking
// ---------------------------------------------------------------------------

let _duckTimeout = null;

function _duck() {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const attackS  = 0.10;
  const holdS    = 0.40;
  const releaseS = 0.10;
  const duckTo   = 0.5;

  for (const gainNode of [_ambientGain, _peakBedGain].filter(Boolean)) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(duckTo, now, attackS / 3);
    gainNode.gain.setTargetAtTime(1,      now + attackS + holdS, releaseS / 3);
  }

  clearTimeout(_duckTimeout);
  _duckTimeout = setTimeout(() => { /* gain ramp handles release */ }, (attackS + holdS + releaseS) * 1000 + 50);
}

// ---------------------------------------------------------------------------
// Ambient loop (never stops during gameplay)
// ---------------------------------------------------------------------------

export function startAmbient() {
  if (!_loadStarted) initAudio();
  const ctx    = getCtx();
  const buffer = _buffers['ambientLoop'];
  if (!buffer || _ambientSource) return;

  _ambientGain = ctx.createGain();
  _ambientGain.gain.value = SLOT_GAIN['ambientLoop'];

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop   = true;
  src.connect(_ambientGain);
  _ambientGain.connect(_musicGain);
  src.start(ctx.currentTime);
  _ambientSource = src;
}

export function stopAmbient() {
  if (_ambientSource) {
    try { _ambientSource.stop(); } catch { /* already stopped */ }
    _ambientSource = null;
    _ambientGain   = null;
  }
}

// ---------------------------------------------------------------------------
// Peak wave bed (crossfade 2s in/out)
// ---------------------------------------------------------------------------

export function startPeakBed() {
  if (!_loadStarted) initAudio();
  const ctx    = getCtx();
  const buffer = _buffers['peakWaveBed'];
  if (!buffer || _peakBedSource) return;

  _peakBedGain = ctx.createGain();
  _peakBedGain.gain.value = 0;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop   = true;
  src.connect(_peakBedGain);
  _peakBedGain.connect(_musicGain);
  src.start(ctx.currentTime);
  _peakBedSource = src;

  // Fade in over 2s
  const now = ctx.currentTime;
  _peakBedGain.gain.setValueAtTime(0, now);
  _peakBedGain.gain.linearRampToValueAtTime(SLOT_GAIN['peakWaveBed'], now + 2);
}

export function stopPeakBed() {
  if (!_peakBedSource) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  _peakBedGain.gain.setValueAtTime(_peakBedGain.gain.value, now);
  _peakBedGain.gain.linearRampToValueAtTime(0, now + 2);
  const src = _peakBedSource;
  _peakBedSource = null;
  _peakBedGain   = null;
  setTimeout(() => { try { src.stop(); } catch { /* ok */ } }, 2100);
}

// ---------------------------------------------------------------------------
// Menu ambient
// ---------------------------------------------------------------------------

export function startMenuAmbient() {
  if (!_loadStarted) initAudio();
  const ctx    = getCtx();
  const buffer = _buffers['menuAmbient'];
  if (!buffer || _menuSource) return;

  _menuGain = ctx.createGain();
  _menuGain.gain.value = SLOT_GAIN['menuAmbient'];

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop   = true;
  src.connect(_menuGain);
  _menuGain.connect(_musicGain);
  src.start(ctx.currentTime);
  _menuSource = src;
}

export function stopMenuAmbient() {
  if (_menuSource) {
    try { _menuSource.stop(); } catch { /* ok */ }
    _menuSource = null;
    _menuGain   = null;
  }
}

// ---------------------------------------------------------------------------
// Master bus controls (persisted)
// ---------------------------------------------------------------------------

export function setMasterVolume(v) {
  getCtx();
  _masterGain.gain.value = v;
  _persistVolumes();
}

export function setSfxVolume(v) {
  getCtx();
  _sfxGain.gain.value = v;
  _persistVolumes();
}

export function setMusicVolume(v) {
  getCtx();
  _musicGain.gain.value = v;
  _persistVolumes();
}

export function getVolumes() {
  getCtx();
  return {
    master: _masterGain.gain.value,
    sfx:    _sfxGain.gain.value,
    music:  _musicGain.gain.value,
  };
}

let _muteVolume = null; // non-null = muted, stores pre-mute master gain

export function toggleMute() {
  getCtx();
  if (_muteVolume !== null) {
    _masterGain.gain.value = _muteVolume;
    _muteVolume = null;
  } else {
    _muteVolume = _masterGain.gain.value || 1;
    _masterGain.gain.value = 0;
  }
}

export function isMuted() {
  return _muteVolume !== null;
}

function _persistVolumes() {
  const save = loadSave();
  save.settings.audioVolumes = getVolumes();
  saveSave(save);
}

// ---------------------------------------------------------------------------
// Named play functions (public API)
// ---------------------------------------------------------------------------

export function playShoot()        { _play('shoot',        0.10); }
export function playDryClick()     { _play('dryClick'); }
export function playIntercept()    { _play('intercept', 0.15); _play('thump', 0.08); }
export function playGraze()        { _play('graze',     0.20); }
export function playCourierAlert() { _play('courierAlert'); }
export function playSplitterSplit(){ _play('splitterSplit', 0.10); }
export function playMirvSplit()    { _play('mirvSplit'); }
export function playComboUp()      { _play('comboUp',   0.08); }
export function playComboPeak()    { _play('comboPeak'); }
export function playMilestone()    { _play('milestone'); }
export function playDamage()       { _play('damage'); }
export function playWaveWarning()  { _play('waveWarning'); }
export function playWaveStart()    { _play('waveStart'); }
export function playLevelUp()      { _play('levelUp'); }
export function playLevelClear()   { _play('levelClear'); }
export function playGameOver()     { _play('gameOver'); }
export function playUiClick()      { _play('uiClick'); }
export function playUiConfirm()    { _play('uiConfirm'); }

/**
 * Generic escape hatch — plays any registered slot by name.
 * Prefer named functions above for type safety.
 */
export function playSound(name, volumeOverride) {
  if (!_loadStarted) initAudio();
  const ctx    = getCtx();
  const buffer = _buffers[name];
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volumeOverride ?? (SLOT_GAIN[name] ?? 1);
  const bus = MUSIC_SLOTS.has(name) ? _musicGain : _sfxGain;
  source.connect(gain);
  gain.connect(bus);
  source.start(ctx.currentTime);
}
