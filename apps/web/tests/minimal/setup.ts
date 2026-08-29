import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom implements neither API, and both are used to keep motion optional rather than mandatory.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!('IntersectionObserver' in window)) {
  class StubIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: StubIntersectionObserver,
  });
}

// HTMLMediaElement.play is unimplemented in jsdom and would otherwise reject noisily.
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

afterEach(cleanup);
