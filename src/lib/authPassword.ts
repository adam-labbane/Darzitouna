// src/lib/authPassword.ts
//
// Dérivation du mot de passe interne Supabase Auth à partir du PIN.
// Doit produire EXACTEMENT le même résultat que la fonction PostgreSQL
// derive_auth_password() (supabase/migrations/20260714140000_auth_session_bridge.sql) :
// encode(digest(user_id || ':' || pin, 'sha256'), 'hex').
//
// Web Crypto (crypto.subtle) est utilisé plutôt qu'une librairie tierce :
// disponible nativement dans tous les navigateurs modernes ET dans Node
// (globalThis.crypto depuis Node 19), donc testable sous Vitest sans
// dépendance ni polyfill.
//
// Formule volontairement publique, sans secret serveur : voir le
// commentaire de derive_auth_password() en SQL pour le raisonnement de
// sécurité complet.

// Email interne du compte Auth lié à un utilisateur métier. Jamais
// affiché à l'écran — l'opérateur ne voit que son profil + le pavé PIN.
export function internalEmailFor(userId: string): string {
  return `${userId}@darzitouna.local`;
}

// Convertit un ArrayBuffer de hash en chaîne hexadécimale minuscule,
// identique au format produit par encode(..., 'hex') côté PostgreSQL.
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Dérive le mot de passe Supabase Auth à partir de l'id utilisateur et
 * du PIN en clair. Le PIN seul (4 chiffres) est trop faible et trop
 * court pour Supabase Auth (minimum_password_length) ; le combiner avec
 * user_id garantit que deux utilisateurs partageant le même PIN
 * obtiennent des mots de passe différents.
 */
export async function deriveAuthPassword(userId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}
