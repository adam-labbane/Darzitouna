import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "../types/client";
import type { ClientFormInput } from "./clientSchema";

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

export async function archiveClient(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("client")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
