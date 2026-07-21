-- ============================================================
-- CORRECTIF BUG — archivage d'une cuve accessible à un OPERATEUR
--
-- Cause racine : protect_cuve_deletion() (migration
-- 20260721090000_cuve_stock_safety.sql) ne vérifiait que si la cuve
-- était vide, jamais le rôle de l'utilisateur connecté — contrairement
-- à protect_client_archiving() (module Clients) qui, elle, exige déjà
-- GERANT. Le commentaire de la fonction affirmait à tort "même patron
-- que protect_client_archiving" alors que la vérification de rôle avait
-- été omise. Reproduit en direct : Ahmed (OPERATEUR) archivait une cuve
-- vide sans être bloqué (PATCH -> 204).
--
-- CREATE OR REPLACE plutôt qu'édition du fichier déjà appliqué.
-- ============================================================
CREATE OR REPLACE FUNCTION protect_cuve_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Concerne tout changement de deleted_at (archivage ET restauration),
  -- pas seulement le passage à "archivée" — même portée que
  -- protect_client_archiving.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
      RAISE EXCEPTION 'Seul un gérant peut archiver ou restaurer une cuve';
    END IF;

    IF NEW.deleted_at IS NOT NULL AND OLD.niveau_actuel > 0 THEN
      RAISE EXCEPTION 'Impossible d''archiver une cuve non vide (% L restants)',
        round(OLD.niveau_actuel::numeric, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
