import type { SupabaseClient } from "@supabase/supabase-js";

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
