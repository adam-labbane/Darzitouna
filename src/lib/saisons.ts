import type { SupabaseClient } from "@supabase/supabase-js";
import type { Saison } from "../types/saison";
import type { SaisonFormInput } from "./saisonSchema";

export async function getSaisons(client: SupabaseClient): Promise<Saison[]> {
  const { data, error } = await client
    .from("saison")
    .select("*")
    .order("date_debut", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSaison(
  client: SupabaseClient,
  huilerieId: string,
  data: SaisonFormInput,
): Promise<Saison> {
  const { data: created, error } = await client
    .from("saison")
    .insert({
      huilerie_id: huilerieId,
      nom: data.nom,
      date_debut: data.date_debut ?? null,
      date_fin: data.date_fin ?? null,
      config_prix_kilo_service: data.config_prix_kilo_service,
      is_active: false,
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateSaison(
  client: SupabaseClient,
  id: string,
  data: SaisonFormInput,
): Promise<Saison> {
  const { data: updated, error } = await client
    .from("saison")
    .update({
      nom: data.nom,
      date_debut: data.date_debut ?? null,
      date_fin: data.date_fin ?? null,
      config_prix_kilo_service: data.config_prix_kilo_service,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function activateSaison(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("saison").update({ is_active: true }).eq("id", id);
  if (error) throw error;
}

export async function deactivateSaison(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("saison").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}
