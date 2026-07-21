// src/types/cuve.ts
//
// Reflète la table `cuve` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721090000_cuve_stock_safety.sql).
export type TypeHuile = "EXTRA" | "VIERGE" | "LAMPANTE";

export interface Cuve {
  id: string;
  huilerie_id: string;
  nom_reference: string;
  emplacement: string | null;
  type_huile: TypeHuile;
  capacite_max: number;
  niveau_actuel: number;
  deleted_at: string | null;
}
