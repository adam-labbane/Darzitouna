// src/lib/clientProfile.ts
//
// Accès aux données agrégées d'un client (fiche client + colonne "reste
// dû" de la liste). Client Supabase injecté en paramètre (même pattern
// que factures.ts/pressages.ts) : testable sans réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "../types/client";
import type { Depot } from "../types/depot";
import type { Facture } from "../types/facture";
import type { Pressage } from "../types/pressage";
import type { Reglement } from "../types/reglement";

export interface ClientProfileFacture extends Facture {
  reglement: Reglement[];
}

// Détail du dépôt d'origine (ticket, poids) nécessaire à l'affichage de
// l'onglet Pressages — même principe que PressageNonFacture dans
// factures.ts, qui embarque déjà ce même sous-ensemble de colonnes.
export interface ClientProfilePressage extends Pressage {
  depot: { numero_ticket: string; poids_olives_kg: number } | null;
}

export interface ClientProfileData {
  client: Client;
  depots: Depot[];
  factures: ClientProfileFacture[];
  pressages: ClientProfilePressage[];
}

/**
 * Fiche d'un client : dépôts, factures (avec règlements embarqués) et
 * pressages, filtrés par saison si `saisonId` est fourni (périmètre par
 * défaut de la fiche), ou tout l'historique sinon. Le client est relu
 * par `id` : la policy RLS `client_isolation` renvoie `null` pour un
 * client d'une autre huilerie — aucune vérification supplémentaire à
 * écrire ici, la fiche affiche alors "Client introuvable".
 *
 * Les pressages n'ont pas de client_id direct (ils sont liés à un
 * dépôt, lui-même lié au client) : `depot!inner(...)` embarque le dépôt
 * ET restreint les lignes racines à ce client — le `!inner` est
 * nécessaire ici, un embed simple ne filtrerait pas les lignes de
 * `pressage` sur une colonne de la table jointe (même piège déjà
 * documenté dans factures.ts pour getPressagesNonFactures).
 */
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

/**
 * Factures + règlements de TOUS les clients de la huilerie, groupés par
 * client_id, en une seule requête — pas un aller-retour par ligne de la
 * liste (N+1). Renvoie les tableaux bruts, pas un reste dû déjà calculé :
 * l'appelant (ClientsList.tsx) passe ces tableaux à computeClientTotals()
 * avec le solde_compte de chaque client, pour ne jamais dupliquer le
 * calcul du reste dû à deux endroits.
 */
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
