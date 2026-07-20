// src/lib/huilerie.ts
//
// Accès en lecture aux informations de l'huilerie courante. Client
// Supabase injecté en paramètre (même pattern que clients.ts/depots.ts).
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nom de l'huilerie, pour l'affichage (en-tête de l'app, ticket de
 * dépôt). null si l'huilerie n'existe pas ou n'est pas visible (RLS).
 */
export async function getHuilerieName(
  client: SupabaseClient,
  huilerieId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("huilerie")
    .select("nom_societe")
    .eq("id", huilerieId)
    .maybeSingle();

  if (error) throw error;
  return data?.nom_societe ?? null;
}
