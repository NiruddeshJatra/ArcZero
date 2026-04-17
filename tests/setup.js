// Mock Web Audio API for jsdom environment
class MockAudioContext {
  createBuffer() { return {}; }
  createBufferSource() {
    return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, disconnect() {} };
  }
  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
  get destination() { return {}; }
  get state() { return 'running'; }
  resume() { return Promise.resolve(); }
}
global.AudioContext = MockAudioContext;
