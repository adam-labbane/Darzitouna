// src/lib/personnel.ts
//
// Accès aux données du volet Personnel (module Configuration). Client
// Supabase injecté en paramètre (même pattern que saisons.ts/clients.ts) :
// testable sans réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole, Utilisateur } from "../types/utilisateur";

// Colonnes explicitement énumérées, PAS select("*") : `utilisateur`
// contient hash_pin, qui ne doit jamais transiter vers le client — même
// principe que get_login_users() côté base, qui ne le renvoie jamais.
const SAFE_COLUMNS = "id, huilerie_id, nom_complet, role, login_code, deleted_at";

export async function getUtilisateurs(client: SupabaseClient): Promise<Utilisateur[]> {
  const { data, error } = await client
    .from("utilisateur")
    .select(SAFE_COLUMNS)
    .is("deleted_at", null)
    .order("nom_complet", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Utilisateur[];
}

export interface CreateUtilisateurInput {
  nom_complet: string;
  role: UserRole;
  pin: string;
}

/**
 * Crée un utilisateur via le RPC create_utilisateur (migration
 * 20260721150000_configuration.sql) — jamais un INSERT direct dans
 * `utilisateur` suivi d'un appel à set_user_pin séparé, qui laisserait
 * une fenêtre où l'utilisateur existe côté métier sans compte Auth lié
 * (ou l'inverse en cas d'échec réseau entre les deux appels). Le RPC
 * fait les deux dans la même transaction serveur, et dérive huilerie_id
 * de la session — jamais un champ envoyé par le client.
 */
export async function createUtilisateur(
  client: SupabaseClient,
  input: CreateUtilisateurInput,
): Promise<Utilisateur> {
  const { data, error } = await client
    .rpc("create_utilisateur", {
      p_nom_complet: input.nom_complet,
      p_role: input.role,
      p_pin: input.pin,
    })
    .single();

  if (error) throw error;
  return data as Utilisateur;
}

export interface UpdateUtilisateurInput {
  nom_complet: string;
  role: UserRole;
}

// Modifie nom/rôle uniquement — jamais le PIN (voir resetPin) ni
// deleted_at (voir deleteUtilisateur).
export async function updateUtilisateur(
  client: SupabaseClient,
  id: string,
  data: UpdateUtilisateurInput,
): Promise<Utilisateur> {
  const { data: updated, error } = await client
    .from("utilisateur")
    .update({ nom_complet: data.nom_complet, role: data.role })
    .eq("id", id)
    .select(SAFE_COLUMNS)
    .single();

  if (error) throw error;
  return updated as Utilisateur;
}

/**
 * Réinitialise le PIN d'un utilisateur via le RPC reset_utilisateur_pin,
 * qui vérifie côté base que la cible appartient à la même huilerie que
 * l'appelant avant de déléguer à set_user_pin — set_user_pin seule ne
 * fait aucune de ces vérifications.
 */
export async function resetPin(client: SupabaseClient, userId: string, pin: string): Promise<void> {
  const { error } = await client.rpc("reset_utilisateur_pin", { p_user_id: userId, p_pin: pin });
  if (error) throw error;
}

/**
 * Archive un utilisateur (soft delete — jamais de DELETE réel, bloqué
 * côté base par block_utilisateur_hard_delete). Le trigger
 * protect_utilisateur_integrity refuse l'auto-suppression et la
 * suppression du dernier gérant — aucune vérification ici, la base est
 * la vraie garde.
 */
export async function deleteUtilisateur(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("utilisateur")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
