// src/lib/auth.ts
//
// Appels Supabase liés à l'authentification par PIN. Le client Supabase est
// reçu en paramètre (injection de dépendance) plutôt qu'importé directement :
// cela permet de tester ces fonctions avec un client simulé (mock), sans
// avoir besoin d'une vraie connexion réseau ni des variables d'environnement
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY dans les tests unitaires.
import type { SupabaseClient } from "@supabase/supabase-js";

// Forme des données renvoyées par la fonction PostgreSQL get_login_users.
// Volontairement minimale : jamais de hash de PIN ni d'autre donnée sensible.
export interface LoginUser {
  id: string;
  nom_complet: string;
  role: string;
}

/**
 * Récupère la liste des utilisateurs affichables sur l'écran de connexion
 * pour une huilerie donnée.
 *
 * On ne peut PAS faire `supabase.from("utilisateur").select()` : la table
 * est protégée par une policy RLS qui exige d'être authentifié. La fonction
 * PostgreSQL get_login_users est en SECURITY DEFINER, donc elle s'exécute
 * avec les droits du propriétaire de la fonction (contournement contrôlé du
 * RLS) et ne renvoie que id/nom/rôle — jamais le hash bcrypt du PIN.
 */
export async function fetchLoginUsers(
  client: SupabaseClient,
  huilerieId: string,
): Promise<LoginUser[]> {
  const { data, error } = await client.rpc("get_login_users", {
    tenant_id: huilerieId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Vérifie un code PIN pour un utilisateur donné.
 *
 * Le hash bcrypt ne quitte jamais la base : la comparaison se fait
 * entièrement côté PostgreSQL (fonction verify_pin, via pgcrypto). Le
 * frontend ne reçoit qu'un booléen, jamais le hash lui-même.
 */
export async function verifyUserPin(
  client: SupabaseClient,
  userId: string,
  pinAttempt: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("verify_pin", {
    user_id: userId,
    pin_attempt: pinAttempt,
  });
  if (error) throw error;
  return data === true;
}
