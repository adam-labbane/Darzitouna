// src/lib/clients.ts
//
// Accès aux données de la table `client`. Client Supabase reçu en
// paramètre (injection de dépendance, même pattern que src/lib/auth.ts) :
// testable avec un client simulé, sans réseau. Le RLS (policy
// client_isolation) filtre déjà automatiquement par huilerie_id à chaque
// requête — inutile de le refaire ici, ni de le vérifier côté client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "../types/client";
import type { ClientFormInput } from "./clientSchema";

/**
 * Liste les clients non archivés de l'huilerie courante. deleted_at IS
 * NULL est un filtre MÉTIER (quels clients montrer maintenant), pas une
 * frontière de sécurité — celle-ci reste entièrement portée par le RLS.
 * `search` filtre sur le nom OU le téléphone (partiel, insensible à la
 * casse).
 */
export async function getClients(client: SupabaseClient, search?: string): Promise<Client[]> {
  let query = client
    .from("client")
    .select("*")
    .is("deleted_at", null)
    .order("nom_complet", { ascending: true });

  if (search && search.trim() !== "") {
    const term = search.trim();
    query = query.or(`nom_complet.ilike.%${term}%,telephone.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Crée un client. solde_compte est toujours initialisé à 0 ici : ce
 * n'est pas un champ du formulaire (ClientFormInput ne le contient pas),
 * le gérant ne saisit jamais de solde initial.
 */
export async function createClient(
  client: SupabaseClient,
  huilerieId: string,
  data: ClientFormInput,
): Promise<Client> {
  const { data: created, error } = await client
    .from("client")
    .insert({
      huilerie_id: huilerieId,
      nom_complet: data.nom_complet,
      telephone: data.telephone ?? null,
      solde_compte: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// Modifie nom/téléphone uniquement. huilerie_id et solde_compte ne sont
// jamais touchés par ce formulaire.
export async function updateClient(
  client: SupabaseClient,
  id: string,
  data: ClientFormInput,
): Promise<Client> {
  const { data: updated, error } = await client
    .from("client")
    .update({
      nom_complet: data.nom_complet,
      telephone: data.telephone ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Archive un client (soft delete — jamais de DELETE réel). Le trigger
 * protect_client_archiving (migration 20260720100000_client_soft_delete.sql)
 * rejette cette requête si l'utilisateur connecté n'a pas le rôle GERANT.
 * C'est la vraie protection : cacher le bouton côté UI n'est que du
 * confort, un opérateur pourrait sinon appeler l'API directement.
 */
export async function archiveClient(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("client")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
