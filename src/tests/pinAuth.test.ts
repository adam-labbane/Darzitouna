// src/tests/pinAuth.test.ts
import { describe, expect, it } from "vitest";
import {
  initialAttemptState,
  isLocked,
  LOCKOUT_DURATION_MS,
  MAX_PIN_ATTEMPTS,
  registerFailedAttempt,
  remainingLockoutSeconds,
} from "../lib/pinAuth";

describe("registerFailedAttempt", () => {
  it("incrémente le compteur tant que le seuil n'est pas atteint", () => {
    const now = 1_000;
    let state = initialAttemptState();
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      state = registerFailedAttempt(state, now);
      expect(state.count).toBe(i);
      expect(state.lockedUntil).toBeNull();
    }
  });

  it("déclenche un blocage à la MAX_PIN_ATTEMPTS-ième tentative", () => {
    const now = 1_000;
    let state = initialAttemptState();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
      state = registerFailedAttempt(state, now);
    }
    expect(state.count).toBe(0); // compteur remis à zéro pour la série suivante
    expect(state.lockedUntil).toBe(now + LOCKOUT_DURATION_MS);
  });
});

describe("isLocked / remainingLockoutSeconds", () => {
  it("n'est pas bloqué sans blocage actif", () => {
    const state = initialAttemptState();
    expect(isLocked(state, Date.now())).toBe(false);
    expect(remainingLockoutSeconds(state, Date.now())).toBe(0);
  });

  it("est bloqué tant que l'horodatage courant précède lockedUntil", () => {
    const now = 10_000;
    const state = { count: 0, lockedUntil: now + LOCKOUT_DURATION_MS };
    expect(isLocked(state, now)).toBe(true);
    expect(remainingLockoutSeconds(state, now)).toBe(LOCKOUT_DURATION_MS / 1000);
  });

  it("n'est plus bloqué une fois lockedUntil dépassé", () => {
    const state = { count: 0, lockedUntil: 5_000 };
    expect(isLocked(state, 5_001)).toBe(false);
    expect(remainingLockoutSeconds(state, 5_001)).toBe(0);
  });
});
