// src/lib/factures.ts
//
// Accès aux données du module Facturation. Client Supabase injecté en
// paramètre (même pattern que pressages.ts/depots.ts) : testable sans
// réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Facture, FactureWithClient, FactureWithRelations } from "../types/facture";
import type { Pressage } from "../types/pressage";
import type { ModeReglement, Reglement } from "../types/reglement";

// Pressage non encore facturé, avec le détail du dépôt d'origine
// (ticket, poids, date) nécessaire pour l'affichage dans
// FactureCreationModal.
export interface PressageNonFacture extends Pressage {
  depot: { numero_ticket: string; poids_olives_kg: number; date_depot: string } | null;
}

/**
 * Pressages d'un client qui n'ont pas encore de facture.
 *
 * Implémentation : embedding PostgREST `depot!inner(...)` (le `!inner`
 * est nécessaire ici — sans lui, filtrer sur une colonne d'une table
 * embarquée comme `depot.client_id` ne restreint pas les lignes
 * racines) et `facture_service(id)`, puis filtrage en mémoire des lignes
 * où `facture_service` est `null`.
 *
 * `facture_service` s'embarque comme un objet unique ou `null`, pas un
 * tableau : la contrainte UNIQUE(pressage_id) (migration
 * 20260721140000_facturation.sql) fait que PostgREST détecte une
 * relation 1-à-1 depuis pressage vers facture_service — même leçon déjà
 * tirée pour `getDepotsEnAttente()` (module Pressage) avec
 * UNIQUE(depot_id), appliquée ici directement plutôt que de redécouvrir
 * le même piège.
 */
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

/**
 * Génère une facture depuis un pressage non encore facturé. N'envoie
 * QUE pressage_id : saison_id, client_id, montant_ttc et numero_facture
 * sont dérivés côté base par le trigger set_facture_derived_fields, qui
 * écraserait de toute façon tout autre champ envoyé — voir le
 * commentaire de la migration 20260721140000_facturation.sql.
 *
 * Le code Postgres 23505 (violation de la contrainte unique
 * facture_service_pressage_id_unique) est intercepté pour renvoyer un
 * message clair plutôt que le message technique brut de Postgres — le
 * cas ne devrait normalement pas se produire depuis l'UI (
 * getPressagesNonFactures exclut déjà les pressages facturés), mais
 * reste possible via un appel API direct ou une course.
 */
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

/**
 * Enregistre un règlement. Le trigger enforce_reglement_not_exceeding_solde
 * (migration 20260721140000_facturation.sql) refuse tout montant qui
 * dépasserait le reste dû ; le trigger update_facture_statut déjà
 * existant recalcule ensuite automatiquement le statut de la facture —
 * aucune des deux logiques n'est dupliquée ici.
 *
 * Mode HUILE : aucun mouvement de stock n'est créé (simplification
 * assumée pour cette V1, voir le récapitulatif du module) — seuls le
 * montant et une note libre (ex. litres équivalents) sont enregistrés.
 */
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
