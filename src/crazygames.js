const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

let available = false;
let initialized = false;

export function isPortalBuild() {
  return import.meta.env.MODE === 'portal';
}

export async function encryptScore(score, encryptionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algorithm = { name: 'AES-GCM', iv };
  const keyBytes = new Uint8Array(
    window.atob(encryptionKey).split('').map((c) => c.charCodeAt(0)),
  );
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, algorithm, false, ['encrypt'],
  );
  const dataBuffer = new window.TextEncoder().encode(score.toString());
  const encryptedBuffer = await crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  return window.btoa(String.fromCharCode(...combined));
}

function injectScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function initCrazyGames() {
  if (!isPortalBuild()) return;
  if (initialized) return;
  initialized = true;
  try {
    await injectScript(SDK_URL);
    await window.CrazyGames.SDK.init();
    available = true;
    // Signal that the game is now loading (assets/menu boot); paired with cgLoadingStop() in main.js.
    window.CrazyGames.SDK.game.loadingStart();
  } catch (e) {
    console.warn('[CrazyGames] SDK init failed:', e); // eslint-disable-line no-console
    available = false;
  }
}

export function cgIsAvailable() {
  return available;
}

// No-op before initCrazyGames() resolves; real loadingStart fires inside initCrazyGames().
export function cgLoadingStart() {
  if (!available) return;
  window.CrazyGames.SDK.game.loadingStart();
}

export function cgLoadingStop() {
  if (!available) return;
  window.CrazyGames.SDK.game.loadingStop();
}

export function cgGameplayStart() {
  if (!available) return;
  window.CrazyGames.SDK.game.gameplayStart();
}

export function cgGameplayStop() {
  if (!available) return;
  window.CrazyGames.SDK.game.gameplayStop();
}

export function cgRequestMidgameAd({ onStart, onComplete } = {}) {
  if (!available) { onComplete?.(); return; }
  try {
    window.CrazyGames.SDK.ad.requestAd('midgame', {
      adStarted:  () => onStart?.(),
      adFinished: () => onComplete?.(),
      adError:    () => onComplete?.(),
    });
  } catch {
    onComplete?.();
  }
}

export function buildSubmitPayload(encryptedScore, score) {
  return { encryptedScore, score };
}

export async function cgSubmitDailyScore(score) {
  if (!available) return;
  const key = import.meta.env.VITE_CG_LEADERBOARD_KEY;
  if (!key) return;
  try {
    const encryptedScore = await encryptScore(score, key);
    await window.CrazyGames.SDK.user.submitScore(buildSubmitPayload(encryptedScore, score));
  } catch (e) {
    console.warn('[CrazyGames] submitScore failed:', e); // eslint-disable-line no-console
  }
}
