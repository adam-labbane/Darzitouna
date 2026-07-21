import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuve } from "../types/cuve";
import type { CuveFormInput } from "./cuveSchema";
import { computeCorrectionDelta } from "./cuveDisplay";

export async function getCuves(client: SupabaseClient): Promise<Cuve[]> {
  const { data, error } = await client
    .from("cuve")
    .select("*")
    .is("deleted_at", null)
    .order("nom_reference", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCuve(
  client: SupabaseClient,
  huilerieId: string,
  data: CuveFormInput,
): Promise<Cuve> {
  const { data: created, error } = await client
    .from("cuve")
    .insert({
      huilerie_id: huilerieId,
      nom_reference: data.nom_reference,
      emplacement: data.emplacement ?? null,
      type_huile: data.type_huile,
      capacite_max: data.capacite_max,
      niveau_actuel: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateCuve(
  client: SupabaseClient,
  id: string,
  data: CuveFormInput,
): Promise<Cuve> {
  const { data: updated, error } = await client
    .from("cuve")
    .update({
      nom_reference: data.nom_reference,
      emplacement: data.emplacement ?? null,
      type_huile: data.type_huile,
      capacite_max: data.capacite_max,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function archiveCuve(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("cuve")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export interface CorrectCuveLevelInput {
  cuveId: string;
  saisonId: string;
  currentLevel: number;
  newLevel: number;
  raison: string;
}

export async function correctCuveLevel(
  client: SupabaseClient,
  input: CorrectCuveLevelInput,
): Promise<void> {
  const delta = computeCorrectionDelta(input.currentLevel, input.newLevel);

  const { error } = await client.from("mvt_stock_huile").insert({
    cuve_id: input.cuveId,
    saison_id: input.saisonId,
    type: "CORRECTION",
    quantite_delta: delta,
    note: input.raison,
  });

  if (error) throw error;
}
