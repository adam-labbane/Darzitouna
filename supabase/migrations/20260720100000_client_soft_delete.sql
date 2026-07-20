-- ============================================================
-- SOFT DELETE DES CLIENTS + RESTRICTION D'ARCHIVAGE AU GÉRANT
--
-- Un client n'est jamais réellement supprimé : il garde ses dépôts et
-- factures liés (intégrité de l'historique comptable). "Archiver" un
-- client se traduit par un UPDATE qui pose deleted_at, jamais un DELETE.
-- ============================================================

-- deleted_at plutôt qu'un simple booléen is_archived : donne la date
-- d'archivage sans colonne supplémentaire (utile pour un futur écran
-- d'audit), tout en restant un simple test de nullité au quotidien
-- (WHERE deleted_at IS NULL).
ALTER TABLE client ADD COLUMN deleted_at TIMESTAMPTZ;

-- ============================================================
-- Restriction : seul un GERANT peut archiver/restaurer un client.
--
-- Pourquoi un trigger plutôt qu'une policy RLS pour cette règle
-- précise : une policy RLS ne peut pas comparer proprement l'ancienne
-- et la nouvelle valeur d'une colonne dans une seule expression
-- déclarative (USING voit l'ancienne ligne, WITH CHECK la nouvelle,
-- sans lien direct entre les deux sans repasser par une sous-requête
-- fragile). Un trigger BEFORE UPDATE compare nativement OLD et NEW.
--
-- La policy "client_isolation" existante (auth.jwt() ->> 'huilerie_id')
-- continue de gérer l'isolation par huilerie pour toutes les
-- opérations ; ce trigger ajoute une restriction de rôle par-dessus,
-- uniquement sur le champ deleted_at. Toute autre modification (nom,
-- téléphone) reste ouverte à tout utilisateur authentifié de la
-- huilerie, gérant ou opérateur.
-- ============================================================
CREATE OR REPLACE FUNCTION protect_client_archiving()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut archiver ou restaurer un client';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_client_update_protect_archiving
BEFORE UPDATE ON client
FOR EACH ROW
EXECUTE FUNCTION protect_client_archiving();
