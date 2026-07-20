// src/lib/depots.ts
//
// Accès aux données du module Dépôts. Client Supabase injecté en
// paramètre (même pattern que clients.ts/auth.ts) : testable sans réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Depot, DepotWithClient, StatutPaiement } from "../types/depot";
import type { Saison } from "../types/saison";
import type { DepotFormInput } from "./depotSchema";
import { computeNetWeight, computePaymentStatus, computeTotalAmount } from "./depotCalculations";

/**
 * Saison active de l'huilerie courante. Le RLS (policy saison_isolation)
 * restreint déjà aux saisons de la bonne huilerie ; is_active = true
 * sélectionne la saison en cours. null si aucune saison active — la page
 * appelante doit afficher un message clair, pas planter.
 */
export async function getActiveSeason(client: SupabaseClient): Promise<Saison | null> {
  const { data, error } = await client
    .from("saison")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface DepotFilters {
  search?: string;
  statutPaiement?: StatutPaiement;
}

/**
 * Liste les dépôts d'une saison, avec le nom du client embarqué (une
 * seule requête, pas un aller-retour par ligne). Le filtre `statutPaiement`
 * est appliqué en SQL. Le filtre `search` (numéro de ticket OU nom de
 * client) est appliqué côté application plutôt qu'en SQL : évite de
 * dépendre de la syntaxe PostgREST pour filtrer sur une colonne d'une
 * table jointe (client.nom_complet), plus fragile à maintenir — le volume
 * par saison d'une seule huilerie reste raisonnable pour un filtrage en
 * mémoire.
 */
export async function getDepots(
  client: SupabaseClient,
  saisonId: string,
  filters?: DepotFilters,
): Promise<DepotWithClient[]> {
  let query = client
    .from("depot")
    .select("*, client(nom_complet)")
    .eq("saison_id", saisonId)
    .order("date_depot", { ascending: false });

  if (filters?.statutPaiement) {
    query = query.eq("statut_paiement_achat", filters.statutPaiement);
  }

  const { data, error } = await query;
  if (error) throw error;
  const depots = (data ?? []) as DepotWithClient[];

  const term = filters?.search?.trim().toLowerCase();
  if (!term) return depots;

  return depots.filter(
    (depot) =>
      depot.numero_ticket.toLowerCase().includes(term) ||
      (depot.client?.nom_complet.toLowerCase().includes(term) ?? false),
  );
}

export async function getDepotById(
  client: SupabaseClient,
  id: string,
): Promise<DepotWithClient | null> {
  const { data, error } = await client
    .from("depot")
    .select("*, client(nom_complet)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface CreateDepotInput extends DepotFormInput {
  // Jamais saisis dans le formulaire : la saison active est résolue par
  // la page (getActiveSeason), l'utilisateur vient de la session
  // (getCurrentUser). Voir enforce_depot_user_id côté base : envoyer un
  // user_id différent de la session échoue, ce champ n'est donc pas une
  // frontière de sécurité en lui-même, juste une valeur requise par la
  // colonne NOT NULL.
  saison_id: string;
  user_id: string;
}

/**
 * Crée un dépôt. numero_ticket n'est jamais envoyé : généré par le
 * trigger set_depot_ticket_number() côté PostgreSQL (migration
 * 20260720110000_depot_ticket_and_security.sql), de façon concurrence-safe.
 * poids_olives_kg et, si achat, statut_paiement_achat sont calculés ici
 * via depotCalculations.ts — aucun trigger DB n'existe pour ce statut
 * (contrairement à facture_service/reglement).
 */
export async function createDepot(client: SupabaseClient, input: CreateDepotInput): Promise<Depot> {
  const poidsNet = computeNetWeight(input.poids_brut_kg, input.poids_tare_kg);

  const payload: Record<string, unknown> = {
    saison_id: input.saison_id,
    client_id: input.client_id,
    user_id: input.user_id,
    poids_olives_kg: poidsNet,
    ref_bac: input.ref_bac ?? null,
    is_achat_olives: input.is_achat_olives,
  };

  if (input.is_achat_olives) {
    const prixUnitaire = input.prix_achat_unitaire ?? 0;
    const montantPaye = input.montant_paye_achat ?? 0;
    const montantTotal = computeTotalAmount(prixUnitaire, poidsNet);

    payload.prix_achat_unitaire = prixUnitaire;
    payload.montant_paye_achat = montantPaye;
    payload.statut_paiement_achat = computePaymentStatus(montantTotal, montantPaye);
  }

  const { data, error } = await client.from("depot").insert(payload).select().single();
  if (error) throw error;
  return data;
}
