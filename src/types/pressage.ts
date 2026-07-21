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
