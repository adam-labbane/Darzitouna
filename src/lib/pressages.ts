import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepotWithClient } from "../types/depot";
import type { Pressage } from "../types/pressage";
import type { TypeHuile } from "../types/cuve";

export type DepotEnAttente = DepotWithClient;

export async function getDepotsEnAttente(
  client: SupabaseClient,
  saisonId: string,
): Promise<DepotEnAttente[]> {
  const { data, error } = await client
    .from("depot")
    .select("*, client(nom_complet), pressage(id)")
    .eq("saison_id", saisonId)
    .order("date_depot", { ascending: false });

  if (error) throw error;
  const depots = (data ?? []) as (DepotEnAttente & { pressage: { id: string } | null })[];

  return depots.filter((depot) => depot.pressage === null);
}

export interface PressageWithDepot extends Pressage {
  depot: { numero_ticket: string; client: { nom_complet: string } | null } | null;
}

export async function getPressages(
  client: SupabaseClient,
  saisonId: string,
): Promise<PressageWithDepot[]> {
  const { data, error } = await client
    .from("pressage")
    .select("*, depot(numero_ticket, client(nom_complet))")
    .eq("saison_id", saisonId)
    .order("date_fin", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PressageWithDepot[];
}

export interface CreatePressageInput {
  depot_id: string;
  cuve_id: string;
  quantite_huile_kg: number;
  type_huile: TypeHuile;
}

export async function createPressage(
  client: SupabaseClient,
  input: CreatePressageInput,
): Promise<Pressage> {
  const { data, error } = await client
    .rpc("create_pressage", {
      p_depot_id: input.depot_id,
      p_cuve_id: input.cuve_id,
      p_quantite_huile_kg: input.quantite_huile_kg,
      p_type_huile: input.type_huile,
    })
    .single();

  if (error) throw error;
  return data as Pressage;
}
