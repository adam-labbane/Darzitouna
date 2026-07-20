// src/types/saison.ts
//
// Reflète la table `saison` (supabase/migrations/20260613130448_create_tables.sql).
export interface Saison {
  id: string;
  huilerie_id: string;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  is_active: boolean;
  config_prix_kilo_service: number | null;
}
