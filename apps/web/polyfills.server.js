// Minimal, very small polyfills for Headers and Request so server/runtime code
// that only checks for their existence won't crash during build on older Node.
// These are NOT full implementations; they're intentionally tiny to satisfy
// packages that only need the globals to exist during SSR/build.
try {
  // Provide ReadableStream via ponyfill if missing (used by react-dom/server APIs)
  try {
    const ws = require('web-streams-polyfill/ponyfill');
    if (ws) {
      if (ws.ReadableStream && typeof globalThis.ReadableStream === 'undefined') {
        globalThis.ReadableStream = ws.ReadableStream;
        global.ReadableStream = ws.ReadableStream;
      }
      if (ws.WritableStream && typeof globalThis.WritableStream === 'undefined') {
        globalThis.WritableStream = ws.WritableStream;
        global.WritableStream = ws.WritableStream;
      }
      if (ws.TransformStream && typeof globalThis.TransformStream === 'undefined') {
        globalThis.TransformStream = ws.TransformStream;
        global.TransformStream = ws.TransformStream;
      }
    }
  } catch (e) {
    // ignore if polyfill not installed yet
  }
  if (typeof globalThis.Headers === 'undefined') {
    class SimpleHeaders {
      constructor(init) {
        this.map = new Map();
        if (init && typeof init === 'object') {
          if (Array.isArray(init)) {
            init.forEach(([k, v]) => this.map.set(String(k).toLowerCase(), String(v)));
          } else {
            Object.keys(init).forEach(k => this.map.set(String(k).toLowerCase(), String(init[k])));
          }
        }
      }
      append(k, v) { this.map.set(String(k).toLowerCase(), String(v)); }
      set(k, v) { this.map.set(String(k).toLowerCase(), String(v)); }
      get(k) { return this.map.get(String(k).toLowerCase()) || null; }
      has(k) { return this.map.has(String(k).toLowerCase()); }
      forEach(cb) { this.map.forEach((v, k) => cb(v, k)); }
    }
    globalThis.Headers = SimpleHeaders;
    global.Headers = SimpleHeaders;
  }

  if (typeof globalThis.Request === 'undefined') {
    class SimpleRequest {
      constructor(input, init) {
        this.input = input;
        this.init = init || {};
      }
    }
    globalThis.Request = SimpleRequest;
    global.Request = SimpleRequest;
  }
} catch (e) {
  // swallow errors: polyfill best-effort
}
