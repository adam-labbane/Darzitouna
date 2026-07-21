import type { SupabaseClient } from "@supabase/supabase-js";
import type { Facture, FactureWithClient, FactureWithRelations } from "../types/facture";
import type { Pressage } from "../types/pressage";
import type { ModeReglement, Reglement } from "../types/reglement";

export interface PressageNonFacture extends Pressage {
  depot: { numero_ticket: string; poids_olives_kg: number; date_depot: string } | null;
}

export async function getPressagesNonFactures(
  client: SupabaseClient,
  clientId: string,
): Promise<PressageNonFacture[]> {
  const { data, error } = await client
    .from("pressage")
    .select("*, depot!inner(numero_ticket, poids_olives_kg, date_depot, client_id), facture_service(id)")
    .eq("depot.client_id", clientId)
    .order("date_fin", { ascending: false });

  if (error) throw error;
  const pressages = (data ?? []) as (PressageNonFacture & { facture_service: { id: string } | null })[];

  return pressages.filter((pressage) => pressage.facture_service === null);
}

export async function getFactures(
  client: SupabaseClient,
  saisonId: string,
): Promise<FactureWithClient[]> {
  const { data, error } = await client
    .from("facture_service")
    .select("*, client(nom_complet)")
    .eq("saison_id", saisonId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FactureWithClient[];
}

export async function getFactureById(
  client: SupabaseClient,
  id: string,
): Promise<FactureWithRelations | null> {
  const { data, error } = await client
    .from("facture_service")
    .select(
      "*, client(nom_complet), pressage(id, quantite_huile_kg, rendement_final, depot(numero_ticket, poids_olives_kg, date_depot)), reglement(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as FactureWithRelations | null;
}

export async function createFacture(client: SupabaseClient, pressageId: string): Promise<Facture> {
  const { data, error } = await client
    .from("facture_service")
    .insert({ pressage_id: pressageId })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ce pressage a déjà été facturé.");
    }
    throw error;
  }
  return data;
}

export interface AddReglementInput {
  facture_id: string;
  montant: number;
  mode: ModeReglement;
  note?: string;
}

export async function addReglement(client: SupabaseClient, input: AddReglementInput): Promise<Reglement> {
  const { data, error } = await client
    .from("reglement")
    .insert({
      facture_id: input.facture_id,
      montant: input.montant,
      mode: input.mode,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
