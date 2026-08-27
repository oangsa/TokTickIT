import "@testing-library/jest-dom";
import { setupServer } from "msw/node";

/*
 * Keep the browser-facing test boundary available for the Lab 2 UI suites.
 * Existing focused tests still use their local fetch doubles; unhandled MSW
 * requests bypass those doubles so this shared server can be introduced
 * without changing their contracts one file at a time.
 */
export const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});

/*
 * jsdom ships no `window.matchMedia`. The application shell reads
 * `(min-width: 992px)` to close its mobile drawer when the viewport crosses the
 * desktop breakpoint, so tests need a real implementation rather than a stub
 * that always reports `false`: this one resolves `(min-width: Npx)` against
 * `window.innerWidth` and notifies listeners from `setViewportWidth`.
 */
const listeners = new Set<() => void>();

window.matchMedia = (query: string) => {
  const minWidth = Number(/\(min-width:\s*(\d+)px\)/.exec(query)?.[1] ?? 0);

  return {
    get matches() {
      return window.innerWidth >= minWidth;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
};

/* jsdom defaults to 1024px; tests that care about the breakpoint set it explicitly. */
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  listeners.forEach((listener) => listener());
}
