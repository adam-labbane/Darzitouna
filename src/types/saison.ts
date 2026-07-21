// src/types/saison.ts
//
// Reflète la table `saison` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721160000_season_closure.sql). date_cloture non-null = saison clôturée,
// distinct de is_active : une saison peut être inactive sans être clôturée
// (voir deactivateSaison), mais jamais réactivée une fois clôturée.
export interface Saison {
  id: string;
  huilerie_id: string;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  is_active: boolean;
  config_prix_kilo_service: number | null;
  date_cloture: string | null;
}
