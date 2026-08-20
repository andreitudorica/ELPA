import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * localStorage facade that never throws (private browsing, disabled storage,
 * full quota). The app must keep working without persistence.
 *
 * Security note: anything in localStorage/sessionStorage is readable by any
 * script running on the page (XSS). Keep secrets and tokens out of here — see
 * docs/architecture.md#authentication for the token-storage tradeoffs.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Storage unavailable — ignore; state simply won't persist.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

/** Persist storage for Zustand stores, backed by {@link safeLocalStorage}. */
export function createSafePersistStorage<TState>() {
  return createJSONStorage<TState>(() => safeLocalStorage);
}
