import type { SupabaseClient } from "@supabase/supabase-js";
import type { Saison } from "../types/saison";
import type { SeasonSummaryRawData } from "./seasonSummary";
import type { SaisonFormInput } from "./saisonSchema";

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
