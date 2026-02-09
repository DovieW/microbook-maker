import '@testing-library/jest-dom'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  // jsdom does not implement ResizeObserver by default.
  (globalThis as any).ResizeObserver = ResizeObserverMock;
}
