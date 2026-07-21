// src/types/pressage.ts
//
// Reflète la table `pressage` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721130000_pressage_creation.sql). rendement_final/quantite_huile_kg/
// montant_service_total/type_huile sont NULL tant que le pressage n'est pas
// clôturé — en pratique create_pressage() les renseigne toujours en un seul
// appel, donc un pressage existant a systématiquement ces champs remplis,
// mais la colonne SQL reste nullable (pas de contrainte NOT NULL d'origine).
import type { TypeHuile } from "./cuve";

export interface Pressage {
  id: string;
  saison_id: string;
  depot_id: string;
  user_id: string | null;
  date_fin: string | null;
  quantite_huile_kg: number | null;
  rendement_final: number | null;
  montant_service_total: number | null;
  type_huile: TypeHuile | null;
}
