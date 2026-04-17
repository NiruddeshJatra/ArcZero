/**
 * Sound effects — loads audio files from /audio/*.mp3.
 * AudioContext created lazily on first user gesture (browser autoplay policy).
 * Each sound is pre-decoded into an AudioBuffer for low-latency playback.
 * Falls back to silence if a file fails to load.
 */

let _ctx = null;
const _buffers = {};

const SOUNDS = {
  shoot:    '/audio/shoot.mp3',
  intercept:'/audio/intercept.mp3',
  damage:   '/audio/damage.mp3',
  gameOver: '/audio/game-over.mp3',
  levelUp:  '/audio/level-up.mp3',
};

// Volumes per sound (0–1)
const VOLUMES = {
  shoot:     0.6,
  intercept: 0.8,
  damage:    0.8,
  gameOver:  0.9,
  levelUp:   0.7,
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
  } catch (e) {
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

export function playShoot()     { if (!_loadStarted) initAudio(); playBuffer('shoot'); }
export function playIntercept() { if (!_loadStarted) initAudio(); playBuffer('intercept'); }
export function playDamage()    { if (!_loadStarted) initAudio(); playBuffer('damage'); }
export function playGameOver()  { if (!_loadStarted) initAudio(); playBuffer('gameOver'); }
export function playLevelUp()   { if (!_loadStarted) initAudio(); playBuffer('levelUp'); }
