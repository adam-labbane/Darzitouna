// src/types/utilisateur.ts
//
// Reflète la table `utilisateur` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721150000_configuration.sql), à l'exception délibérée de
// `hash_pin` : ce champ n'est JAMAIS sélectionné par le code applicatif
// (voir src/lib/personnel.ts) et n'apparaît donc pas ici — même principe
// que get_login_users() côté base, qui ne le renvoie jamais non plus.
export type UserRole = "GERANT" | "OPERATEUR";

export interface Utilisateur {
  id: string;
  huilerie_id: string;
  nom_complet: string;
  role: UserRole;
  login_code: string;
  deleted_at: string | null;
}
