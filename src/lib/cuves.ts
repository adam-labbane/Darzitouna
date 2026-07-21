// src/lib/cuves.ts
//
// Accès aux données du module Cuves. Client Supabase injecté en paramètre
// (même pattern que clients.ts/depots.ts) : testable sans réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuve } from "../types/cuve";
import type { CuveFormInput } from "./cuveSchema";
import { computeCorrectionDelta } from "./cuveDisplay";

// Liste les cuves non archivées de l'huilerie courante (RLS filtre déjà
// par huilerie ; deleted_at IS NULL est un filtre métier, pas une
// frontière de sécurité — même principe que clients.ts).
export async function getCuves(client: SupabaseClient): Promise<Cuve[]> {
  const { data, error } = await client
    .from("cuve")
    .select("*")
    .is("deleted_at", null)
    .order("nom_reference", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Crée une cuve. niveau_actuel est toujours initialisé à 0 : une cuve
// neuve est vide, elle ne se remplit que via des mouvements de stock.
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

// Modifie référence/emplacement/type/capacité — JAMAIS niveau_actuel,
// qui n'existe même pas dans ce payload : voir correctCuveLevel().
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

/**
 * Archive une cuve (soft delete). Le trigger protect_cuve_deletion
 * (migration 20260721090000_cuve_stock_safety.sql) refuse l'opération si
 * la cuve n'est pas vide — pas de vérification ici, la base est la
 * vraie garde.
 */
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

/**
 * Corrige le niveau d'une cuve suite à un écart constaté (inventaire,
 * évaporation...). N'écrit JAMAIS directement cuve.niveau_actuel : un
 * simple INSERT dans mvt_stock_huile (type CORRECTION) déclenche le
 * trigger update_cuve_stock côté base, qui applique le delta ET vérifie
 * les bornes [0, capacite_max] — et le trigger enforce_correction_role
 * refuse l'opération si l'utilisateur connecté n'est pas GERANT.
 */
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
