/**
 * Persistence for plays, sessions and settings. Browser localStorage for now.
 * Swap for a backend by implementing StateStore; nothing else touches storage.
 */
import { defaultState, type AppState } from '../core/types';

export interface StateStore {
  load(): AppState;
  save(state: AppState): void;
}

export function mergeState(raw: unknown): AppState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<AppState>;
  return {
    v: 1,
    plays: Array.isArray(s.plays) ? s.plays : d.plays,
    sessions: Array.isArray(s.sessions) ? s.sessions : d.sessions,
    settings: { ...d.settings, ...(s.settings ?? {}) },
  };
}

export class LocalStore implements StateStore {
  constructor(private key = 'side-a:v1') {}
  load(): AppState {
    try {
      const raw = localStorage.getItem(this.key);
      return mergeState(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultState();
    }
  }
  save(state: AppState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep running in memory */
    }
  }
}
