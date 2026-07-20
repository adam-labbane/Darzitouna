// src/types/client.ts
//
// Reflète la table `client` (supabase/migrations/20260613130448_create_tables.sql
// + 20260720100000_client_soft_delete.sql). `deleted_at` non-null = client archivé.
export interface Client {
  id: string;
  huilerie_id: string;
  nom_complet: string;
  telephone: string | null;
  solde_compte: number;
  deleted_at: string | null;
}
