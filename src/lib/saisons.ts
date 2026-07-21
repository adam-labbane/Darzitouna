// src/lib/saisons.ts
//
// Accès aux données du volet Saisons (module Configuration). Client
// Supabase injecté en paramètre (même pattern que depots.ts/cuves.ts) :
// testable sans réseau.
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

/**
 * Crée une saison, toujours inactive à la création (is_active: false) :
 * créer une saison en avance ne doit jamais désactiver silencieusement
 * la saison en cours — l'activation est un geste séparé et délibéré
 * (activateSaison), même si la colonne saison.is_active a par défaut
 * `DEFAULT true` côté base (hérité du MCD d'origine).
 */
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

// Modifie nom/dates/prix — jamais is_active (voir activateSaison/
// deactivateSaison, actions séparées et intentionnelles).
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

/**
 * Active une saison. Ne désactive JAMAIS les autres saisons ici : le
 * trigger enforce_single_active_saison (migration
 * 20260721150000_configuration.sql) s'en charge côté base, de façon
 * atomique et garantie même via un appel API direct — pas de logique
 * de désactivation à dupliquer côté client.
 */
export async function activateSaison(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("saison").update({ is_active: true }).eq("id", id);
  if (error) throw error;
}

export async function deactivateSaison(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("saison").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}
