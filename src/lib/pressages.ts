// src/lib/pressages.ts
//
// Accès aux données du module Pressage. Client Supabase injecté en
// paramètre (même pattern que depots.ts/cuves.ts) : testable sans réseau.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepotWithClient } from "../types/depot";
import type { Pressage } from "../types/pressage";
import type { TypeHuile } from "../types/cuve";

// Dépôt en attente avec le nom du client embarqué — même forme que
// DepotWithClient, réutilisée telle quelle par PressageModal.
export type DepotEnAttente = DepotWithClient;

/**
 * Dépôts d'une saison qui n'ont pas encore été pressés.
 *
 * Implémentation : embedding PostgREST `pressage(id)` (LEFT JOIN
 * équivalent, même technique que l'embedding `client` déjà utilisé dans
 * getDepots() — module Dépôts), puis filtrage en mémoire des lignes où
 * `pressage` est null. Une seule requête, aucun aller-retour
 * supplémentaire.
 *
 * `pressage` s'embarque comme un objet unique (ou null), pas un tableau :
 * la contrainte UNIQUE(depot_id) (migration 20260721130000_pressage_creation.sql)
 * fait que PostgREST détecte une relation 1-à-1 depuis depot vers
 * pressage, pas 1-à-plusieurs — vérifié en direct (une valeur `[]`
 * aurait été le cas sans cette contrainte).
 *
 * Alternative écartée : `NOT IN (SELECT depot_id FROM pressage)` aurait
 * demandé soit deux requêtes séparées (récupérer d'abord tous les
 * depot_id déjà pressés), soit une sous-requête encodée dans l'URL dont
 * la taille grandit avec l'historique de la saison — l'embedding scale
 * mieux et reste cohérent avec le pattern déjà en place dans depots.ts.
 *
 * Les dépôts achat sont inclus (voir createPressage/create_pressage :
 * pressés eux aussi, mais sans montant de service).
 */
export async function getDepotsEnAttente(
  client: SupabaseClient,
  saisonId: string,
): Promise<DepotEnAttente[]> {
  const { data, error } = await client
    .from("depot")
    .select("*, client(nom_complet), pressage(id)")
    .eq("saison_id", saisonId)
    .order("date_depot", { ascending: false });

  if (error) throw error;
  const depots = (data ?? []) as (DepotEnAttente & { pressage: { id: string } | null })[];

  return depots.filter((depot) => depot.pressage === null);
}

// Pressage réalisé, avec le ticket et le client du dépôt embarqués pour
// l'affichage de l'historique sans requête séparée par ligne.
export interface PressageWithDepot extends Pressage {
  depot: { numero_ticket: string; client: { nom_complet: string } | null } | null;
}

export async function getPressages(
  client: SupabaseClient,
  saisonId: string,
): Promise<PressageWithDepot[]> {
  const { data, error } = await client
    .from("pressage")
    .select("*, depot(numero_ticket, client(nom_complet))")
    .eq("saison_id", saisonId)
    .order("date_fin", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PressageWithDepot[];
}

export interface CreatePressageInput {
  depot_id: string;
  cuve_id: string;
  quantite_huile_kg: number;
  type_huile: TypeHuile;
}

/**
 * Clôture un pressage : crée le pressage ET le mouvement de stock PROD
 * associé, dans une seule transaction serveur (fonction create_pressage,
 * migration 20260721130000_pressage_creation.sql).
 *
 * Un seul appel RPC plutôt que deux appels Supabase séparés (insert
 * pressage puis insert mvt_stock_huile) : si le second échouait après
 * un premier appel réussi (perte réseau, capacité de cuve dépassée...),
 * on se retrouverait avec un pressage enregistré mais aucune huile
 * physiquement comptabilisée en cuve — incohérence silencieuse. La
 * transaction côté base élimine cette fenêtre : soit les deux
 * insertions réussissent, soit aucune n'est conservée.
 *
 * rendement_final et montant_service_total ne sont jamais envoyés en
 * paramètre : calculés par create_pressage() elle-même, un appel API
 * direct ne peut donc pas fabriquer de valeurs arbitraires. Idem pour
 * user_id, dérivé de auth.uid() côté base, jamais de la session client.
 */
export async function createPressage(
  client: SupabaseClient,
  input: CreatePressageInput,
): Promise<Pressage> {
  const { data, error } = await client
    .rpc("create_pressage", {
      p_depot_id: input.depot_id,
      p_cuve_id: input.cuve_id,
      p_quantite_huile_kg: input.quantite_huile_kg,
      p_type_huile: input.type_huile,
    })
    .single();

  if (error) throw error;
  return data as Pressage;
}
