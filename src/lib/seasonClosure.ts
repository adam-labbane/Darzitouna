// src/lib/seasonClosure.ts
//
// Accès aux données de la clôture de saison. Client Supabase injecté en
// paramètre (même pattern que factures.ts/pressages.ts) : testable sans
// réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Saison } from "../types/saison";
import type { SeasonSummaryRawData } from "./seasonSummary";
import type { SaisonFormInput } from "./saisonSchema";

/**
 * Charge les données brutes du bilan d'une saison (dépôts, pressages,
 * factures + règlements embarqués, cuves de la huilerie) — chaque
 * requête est filtrée par RLS, aucun risque d'agréger les données d'une
 * autre huilerie. `saison` est déjà connue de l'appelant (ligne déjà
 * chargée dans Config.tsx) : on évite un aller-retour supplémentaire
 * pour la relire.
 */
export async function getSeasonSummaryData(
  client: SupabaseClient,
  saison: Saison,
  huilerieNom: string,
): Promise<SeasonSummaryRawData> {
  const [depotsRes, pressagesRes, facturesRes, cuvesRes] = await Promise.all([
    client.from("depot").select("poids_olives_kg, is_achat_olives").eq("saison_id", saison.id),
    client.from("pressage").select("quantite_huile_kg").eq("saison_id", saison.id),
    client.from("facture_service").select("montant_ttc, reglement(montant)").eq("saison_id", saison.id),
    client
      .from("cuve")
      .select("nom_reference, niveau_actuel, capacite_max")
      .eq("huilerie_id", saison.huilerie_id)
      .is("deleted_at", null),
  ]);

  if (depotsRes.error) throw depotsRes.error;
  if (pressagesRes.error) throw pressagesRes.error;
  if (facturesRes.error) throw facturesRes.error;
  if (cuvesRes.error) throw cuvesRes.error;

  const factures = (facturesRes.data ?? []) as { montant_ttc: number; reglement: { montant: number }[] }[];

  return {
    huilerieNom,
    saisonNom: saison.nom,
    dateDebut: saison.date_debut,
    dateFin: saison.date_fin,
    depots: depotsRes.data ?? [],
    pressages: pressagesRes.data ?? [],
    factures: factures.map((facture) => ({ montant_ttc: facture.montant_ttc })),
    reglements: factures.flatMap((facture) => facture.reglement),
    cuves: cuvesRes.data ?? [],
  };
}

export interface CloseSeasonInput {
  oldSaisonId: string;
  reporterStock: boolean;
  conserverClients: boolean;
  nouvelleSaison: SaisonFormInput;
}

export interface CloseSeasonResult {
  ancienneSaison: Saison;
  nouvelleSaison: Saison;
  clientsProtegesCount: number;
}

/**
 * Clôture la saison en cours et ouvre la nouvelle, via la fonction
 * PostgreSQL transactionnelle close_season_and_open_new (migration
 * 20260721160000_season_closure.sql) : vidage tracé du stock (jamais un
 * UPDATE direct de cuve.niveau_actuel), archivage protégé des clients
 * (jamais un client à impayés ou à solde non nul), clôture + activation
 * en une seule transaction — si une étape échoue, rien n'est appliqué.
 */
export async function closeSeasonAndOpenNew(
  client: SupabaseClient,
  input: CloseSeasonInput,
): Promise<CloseSeasonResult> {
  const { data, error } = await client.rpc("close_season_and_open_new", {
    p_old_saison_id: input.oldSaisonId,
    p_reporter_stock: input.reporterStock,
    p_conserver_clients: input.conserverClients,
    p_nom: input.nouvelleSaison.nom,
    p_date_debut: input.nouvelleSaison.date_debut ?? null,
    p_date_fin: input.nouvelleSaison.date_fin ?? null,
    p_prix: input.nouvelleSaison.config_prix_kilo_service,
  });

  if (error) throw error;

  const result = data as {
    ancienne_saison: Saison;
    nouvelle_saison: Saison;
    clients_proteges_count: number;
  };

  return {
    ancienneSaison: result.ancienne_saison,
    nouvelleSaison: result.nouvelle_saison,
    clientsProtegesCount: result.clients_proteges_count,
  };
}
