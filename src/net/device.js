/* global navigator */
export function detectDevice() {
  // Prefer the structured userAgentData API (Chromium); fall back to pointer + viewport.
  if (typeof navigator !== 'undefined' && navigator.userAgentData) {
    return navigator.userAgentData.mobile ? 'mobile' : 'desktop';
  }
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return 'mobile';
  }
  return 'desktop';
}
