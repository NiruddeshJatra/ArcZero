/**
 * Sound effects — loads audio files from /audio/*.mp3.
 * AudioContext created lazily on first user gesture (browser autoplay policy).
 * Each sound is pre-decoded into an AudioBuffer for low-latency playback.
 * Falls back to silence if a file fails to load.
 */

let _ctx = null;
const _buffers = {};

const SOUNDS = {
  shoot:       '/audio/shoot.mp3',
  intercept:   '/audio/intercept.mp3',
  damage:      '/audio/damage.mp3',
  gameOver:    '/audio/game-over.mp3',
  levelUp:     '/audio/level-up.mp3',
  // Phase 1–4 additions (fail silently if file absent)
  thump:       '/audio/332670__reitanna__low-thump.wav',
  graze:       '/audio/530448__mellau__whoosh-short-5.wav',
  dryClick:    '/audio/274029__junggle__click-ambient-mute.wav',
  waveWarning: '/audio/536655__newlocknew__alarm-fmsytruseqptchshftchrsmsprcssng.wav',
  milestone:   '/audio/zapsplat_multimedia_game_tone_win_bonus_success_tone_warm_chime_short_tail_92922.mp3',
  ambientLoop: '/audio/idoberg-deep-space-loop-401165.mp3',
};

// Volumes per sound (0–1)
const VOLUMES = {
  shoot:       0.6,
  intercept:   0.8,
  damage:      0.8,
  gameOver:    0.9,
  levelUp:     0.7,
  thump:       0.5,
  graze:       0.45,
  dryClick:    0.4,
  waveWarning: 0.55,
  milestone:   0.65,
  ambientLoop: 0.2,
};

function getCtx() {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

async function loadBuffer(ctx, name, url) {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    _buffers[name] = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    // Fail silently — playSound checks for null buffer
    _buffers[name] = null;
  }
}

function playBuffer(name) {
  const ctx = getCtx();
  const buffer = _buffers[name];
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = VOLUMES[name] ?? 1;

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

/**
 * Pre-load all audio files. Call once on first user gesture.
 * All play* functions also trigger loading if not yet started,
 * but calling initAudio() early avoids first-play latency.
 */
let _loadStarted = false;
export function initAudio() {
  if (_loadStarted) return;
  _loadStarted = true;
  const ctx = getCtx();
  for (const [name, url] of Object.entries(SOUNDS)) {
    loadBuffer(ctx, name, url);
  }
}

/** Play a buffer with random pitch variance (±variance fraction). Visual/UX only. */
function playWithPitch(name, variance = 0.12) {
  const ctx = getCtx();
  const buffer = _buffers[name];
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // eslint-disable-next-line no-restricted-properties -- pitch jitter, UX only
  source.playbackRate.value = 1 + (Math.random() * 2 - 1) * variance;
  const gain = ctx.createGain();
  gain.gain.value = VOLUMES[name] ?? 1;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

// Ambient loop node (kept alive for stop/restart)
let _ambientSource = null;

export function startAmbient() {
  if (!_loadStarted) initAudio();
  const ctx = getCtx();
  const buffer = _buffers['ambientLoop'];
  if (!buffer || _ambientSource) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = VOLUMES['ambientLoop'];
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
  _ambientSource = source;
}

export function stopAmbient() {
  if (_ambientSource) {
    try { _ambientSource.stop(); } catch { /* already stopped */ }
    _ambientSource = null;
  }
}

export function playShoot()       { if (!_loadStarted) initAudio(); playWithPitch('shoot', 0.10); }
export function playIntercept()   { if (!_loadStarted) initAudio(); playWithPitch('intercept', 0.15); playBuffer('thump'); }
export function playDamage()      { if (!_loadStarted) initAudio(); playBuffer('damage'); }
export function playGameOver()    { if (!_loadStarted) initAudio(); playBuffer('gameOver'); }
export function playLevelUp()     { if (!_loadStarted) initAudio(); playBuffer('levelUp'); }
export function playGraze()       { if (!_loadStarted) initAudio(); playWithPitch('graze', 0.2); }
export function playDryClick()    { if (!_loadStarted) initAudio(); playBuffer('dryClick'); }
export function playWaveWarning() { if (!_loadStarted) initAudio(); playBuffer('waveWarning'); }
export function playMilestone()   { if (!_loadStarted) initAudio(); playBuffer('milestone'); }
export function playSound(name, volume) {
  if (!_loadStarted) initAudio();
  const ctx = getCtx();
  const buffer = _buffers[name];
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume ?? (VOLUMES[name] ?? 1);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}
