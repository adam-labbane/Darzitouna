import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "../types/client";
import type { Depot } from "../types/depot";
import type { Facture } from "../types/facture";
import type { Pressage } from "../types/pressage";
import type { Reglement } from "../types/reglement";

export interface ClientProfileFacture extends Facture {
  reglement: Reglement[];
}

export interface ClientProfilePressage extends Pressage {
  depot: { numero_ticket: string; poids_olives_kg: number } | null;
}

export interface ClientProfileData {
  client: Client;
  depots: Depot[];
  factures: ClientProfileFacture[];
  pressages: ClientProfilePressage[];
}

export async function getClientProfile(
  client: SupabaseClient,
  clientId: string,
  saisonId?: string,
): Promise<ClientProfileData | null> {
  let depotsQuery = client.from("depot").select("*").eq("client_id", clientId);
  let facturesQuery = client
    .from("facture_service")
    .select("*, reglement(*)")
    .eq("client_id", clientId);
  let pressagesQuery = client
    .from("pressage")
    .select("*, depot!inner(numero_ticket, poids_olives_kg, client_id)")
    .eq("depot.client_id", clientId);

  if (saisonId) {
    depotsQuery = depotsQuery.eq("saison_id", saisonId);
    facturesQuery = facturesQuery.eq("saison_id", saisonId);
    pressagesQuery = pressagesQuery.eq("saison_id", saisonId);
  }

  const [clientRes, depotsRes, facturesRes, pressagesRes] = await Promise.all([
    client.from("client").select("*").eq("id", clientId).maybeSingle(),
    depotsQuery.order("date_depot", { ascending: false }),
    facturesQuery.order("created_at", { ascending: false }),
    pressagesQuery.order("date_fin", { ascending: false }),
  ]);

  if (clientRes.error) throw clientRes.error;
  if (depotsRes.error) throw depotsRes.error;
  if (facturesRes.error) throw facturesRes.error;
  if (pressagesRes.error) throw pressagesRes.error;

  if (!clientRes.data) return null;

  return {
    client: clientRes.data,
    depots: depotsRes.data ?? [],
    factures: (facturesRes.data ?? []) as ClientProfileFacture[],
    pressages: (pressagesRes.data ?? []) as ClientProfilePressage[],
  };
}

export interface ClientFinancials {
  factures: { montant_ttc: number }[];
  reglements: { montant: number }[];
}

export async function getAllClientsFinancials(
  client: SupabaseClient,
): Promise<Record<string, ClientFinancials>> {
  const { data, error } = await client
    .from("facture_service")
    .select("client_id, montant_ttc, reglement(montant)");

  if (error) throw error;

  const rows = (data ?? []) as { client_id: string; montant_ttc: number; reglement: { montant: number }[] }[];
  const result: Record<string, ClientFinancials> = {};

  for (const row of rows) {
    if (!result[row.client_id]) {
      result[row.client_id] = { factures: [], reglements: [] };
    }
    result[row.client_id].factures.push({ montant_ttc: row.montant_ttc });
    result[row.client_id].reglements.push(...row.reglement);
  }

  return result;
}
