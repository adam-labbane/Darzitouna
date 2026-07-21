import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole, Utilisateur } from "../types/utilisateur";

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

export async function resetPin(client: SupabaseClient, userId: string, pin: string): Promise<void> {
  const { error } = await client.rpc("reset_utilisateur_pin", { p_user_id: userId, p_pin: pin });
  if (error) throw error;
}

export async function deleteUtilisateur(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("utilisateur")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
