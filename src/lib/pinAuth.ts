// src/lib/pinAuth.ts
//
// Protection anti brute-force sur la saisie du PIN (OWASP A07 - Identification
// and Authentication Failures). Logique pure et testable : aucune dépendance
// à React, au DOM ou à Supabase, uniquement des horodatages passés en paramètre.
//
// Le compte est bloqué temporairement après plusieurs échecs consécutifs.
// L'état est gardé côté client par utilisateur sélectionné : il ne remplace
// pas une limitation côté serveur (à ajouter plus tard, ex. rate limiting
// Supabase/Postgres), mais il évite déjà le cas d'usage le plus courant sur
// tablette : quelqu'un qui tapote au hasard sur un profil.

export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30_000; // 30 secondes

export interface AttemptState {
  count: number;
  lockedUntil: number | null; // timestamp ms, null = pas de blocage actif
}

// État initial pour un utilisateur qui n'a encore jamais échoué.
export function initialAttemptState(): AttemptState {
  return { count: 0, lockedUntil: null };
}

/**
 * Enregistre une tentative échouée. Déclenche un blocage temporaire dès que
 * le seuil est atteint, et réinitialise le compteur pour la prochaine série.
 */
export function registerFailedAttempt(state: AttemptState, now: number): AttemptState {
  const count = state.count + 1;
  if (count >= MAX_PIN_ATTEMPTS) {
    return { count: 0, lockedUntil: now + LOCKOUT_DURATION_MS };
  }
  return { count, lockedUntil: state.lockedUntil };
}

// Indique si l'utilisateur est actuellement bloqué à l'instant `now`.
export function isLocked(state: AttemptState, now: number): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}

// Temps restant avant déblocage, arrondi à la seconde supérieure (pour l'affichage).
export function remainingLockoutSeconds(state: AttemptState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}
