const PLAYER_ID_KEY = 'arczero.player_id';
const HANDLE_KEY    = 'arczero.handle';

export function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage blocked (private browsing, security policy) — return ephemeral id
    return crypto.randomUUID();
  }
}

export function getHandle() {
  try {
    return localStorage.getItem(HANDLE_KEY) || null;
  } catch {
    return null;
  }
}

export function setHandle(handle) {
  try {
    localStorage.setItem(HANDLE_KEY, handle.trim().slice(0, 20));
  } catch { /* ignore */ }
}
