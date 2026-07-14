// src/lib/pin.ts
//
// Logique pure de manipulation du code PIN (aucune dépendance à React ni à Supabase).
// Isolée ici pour être testable unitairement sans mock (C2.2.2).

// Longueur fixe du code PIN utilisé dans toute l'application.
export const PIN_LENGTH = 4;

/**
 * Ajoute un chiffre au PIN en cours de saisie.
 * Ignore silencieusement les caractères non numériques et les saisies
 * au-delà de la longueur maximale (évite tout état invalide côté UI).
 */
export function appendDigit(pin: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) return pin;
  if (pin.length >= PIN_LENGTH) return pin;
  return pin + digit;
}

// Retire le dernier chiffre saisi (bouton "⌫").
export function removeLastDigit(pin: string): string {
  return pin.slice(0, -1);
}

// Un PIN est prêt à être vérifié dès qu'il atteint la longueur attendue.
export function isPinComplete(pin: string): boolean {
  return pin.length === PIN_LENGTH;
}
