export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30_000;

export interface AttemptState {
  count: number;
  lockedUntil: number | null;
}

export function initialAttemptState(): AttemptState {
  return { count: 0, lockedUntil: null };
}

export function registerFailedAttempt(state: AttemptState, now: number): AttemptState {
  const count = state.count + 1;
  if (count >= MAX_PIN_ATTEMPTS) {
    return { count: 0, lockedUntil: now + LOCKOUT_DURATION_MS };
  }
  return { count, lockedUntil: state.lockedUntil };
}

export function isLocked(state: AttemptState, now: number): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}

export function remainingLockoutSeconds(state: AttemptState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}
