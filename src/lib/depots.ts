import type { SupabaseClient } from "@supabase/supabase-js";
import type { Depot, DepotWithClient, StatutPaiement } from "../types/depot";
import type { Saison } from "../types/saison";
import type { DepotFormInput } from "./depotSchema";
import { computeNetWeight, computePaymentStatus, computeTotalAmount } from "./depotCalculations";

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
  saison_id: string;
  user_id: string;
}

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
