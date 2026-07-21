export interface Client {
  id: string;
  huilerie_id: string;
  nom_complet: string;
  telephone: string | null;
  solde_compte: number;
  deleted_at: string | null;
}
