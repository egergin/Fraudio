import '@testing-library/jest-dom/vitest';

// Chart.js jsdom'da canvas gerektirir; testlerde grafik render'ı devre dışı.
vi.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Line: () => null,
}));

// jsdom WebSocket sunmaz; canlı akış kancası için minimal sahte.
class FakeWebSocket {
  static OPEN = 1;
  constructor() {
    this.readyState = 0;
    FakeWebSocket.last = this;
  }
  close() { this.readyState = 3; this.onclose?.(); }
}
globalThis.WebSocket = FakeWebSocket;

// jsdom matchMedia sunmaz; varsayılan olarak geniş ekran (masaüstü) davranışı.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}
