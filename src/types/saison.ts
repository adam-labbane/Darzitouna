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
