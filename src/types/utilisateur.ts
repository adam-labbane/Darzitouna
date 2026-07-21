export type UserRole = "GERANT" | "OPERATEUR";

export interface Utilisateur {
  id: string;
  huilerie_id: string;
  nom_complet: string;
  role: UserRole;
  login_code: string;
  deleted_at: string | null;
}
