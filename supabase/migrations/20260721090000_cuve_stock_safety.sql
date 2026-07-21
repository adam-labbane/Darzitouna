-- ============================================================
-- MODULE CUVES — bornes de sécurité sur les mouvements de stock,
-- correction réservée au gérant, soft delete cohérent avec le module
-- Clients.
-- ============================================================

-- Raison de la correction manuelle (saisie par le gérant). Même
-- convention que reglement.note déjà existant.
ALTER TABLE mvt_stock_huile ADD COLUMN note TEXT;

-- Soft delete, comme client.deleted_at (migration
-- 20260720100000_client_soft_delete.sql).
ALTER TABLE cuve ADD COLUMN deleted_at TIMESTAMPTZ;

-- Filet de sécurité qui s'applique à TOUT chemin d'écriture sur cuve,
-- y compris un futur script qui contournerait les triggers applicatifs.
ALTER TABLE cuve ADD CONSTRAINT cuve_capacite_max_positive CHECK (capacite_max > 0);
ALTER TABLE cuve ADD CONSTRAINT cuve_niveau_within_capacity
  CHECK (niveau_actuel >= 0 AND niveau_actuel <= capacite_max);

-- ============================================================
-- update_cuve_stock() réécrite : la version d'origine (migration
-- 20260613134128_triggers_and_rls.sql) appliquait le delta sans jamais
-- vérifier les bornes — un mouvement (notamment une correction
-- manuelle, premier flux capable de produire un delta arbitraire)
-- pouvait rendre niveau_actuel négatif ou supérieur à capacite_max.
-- On CREATE OR REPLACE la fonction plutôt que d'éditer l'ancien
-- fichier de migration déjà appliqué.
--
-- Comme ce trigger est AFTER INSERT, une exception ici annule aussi
-- l'insertion du mouvement (même transaction) : pas de mouvement
-- "fantôme" enregistré si la correction est invalide.
-- ============================================================
CREATE OR REPLACE FUNCTION update_cuve_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_capacite FLOAT;
  v_niveau_actuel FLOAT;
  v_nouveau_niveau FLOAT;
BEGIN
  SELECT capacite_max, niveau_actuel INTO v_capacite, v_niveau_actuel
  FROM cuve
  WHERE id = NEW.cuve_id;

  v_nouveau_niveau := v_niveau_actuel + NEW.quantite_delta;

  -- RAISE ne supporte que des % positionnels simples, pas un formatage
  -- printf-style (%.2f) : round(...::numeric, 2) fait l'arrondi en amont.
  IF v_nouveau_niveau < 0 THEN
    RAISE EXCEPTION 'Mouvement refusé : le niveau de la cuve deviendrait négatif (% L)',
      round(v_nouveau_niveau::numeric, 2);
  END IF;

  IF v_nouveau_niveau > v_capacite THEN
    RAISE EXCEPTION 'Mouvement refusé : le niveau (% L) dépasserait la capacité de la cuve (% L)',
      round(v_nouveau_niveau::numeric, 2), round(v_capacite::numeric, 2);
  END IF;

  UPDATE cuve SET niveau_actuel = v_nouveau_niveau WHERE id = NEW.cuve_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Correction de niveau réservée au GERANT.
--
-- Ne concerne que type = 'CORRECTION' : les autres types de mouvement
-- (PROD, VENTE, ACHAT_FRNS — pas encore utilisés par l'app) ne sont pas
-- affectés par cette restriction de rôle.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_correction_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'CORRECTION' AND (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut effectuer une correction manuelle de niveau';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_mvt_stock_insert_enforce_correction_role
BEFORE INSERT ON mvt_stock_huile
FOR EACH ROW
EXECUTE FUNCTION enforce_correction_role();

-- ============================================================
-- Pas de suppression brutale d'une cuve non vide.
--
-- Ne bloque que le passage à "archivée" (deleted_at posé) — ne gêne
-- jamais les autres modifications (référence, emplacement, capacité).
-- Même patron que protect_client_archiving (module Clients).
-- ============================================================
CREATE OR REPLACE FUNCTION protect_cuve_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND OLD.niveau_actuel > 0 THEN
    RAISE EXCEPTION 'Impossible d''archiver une cuve non vide (% L restants)',
      round(OLD.niveau_actuel::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_cuve_update_protect_deletion
BEFORE UPDATE ON cuve
FOR EACH ROW
EXECUTE FUNCTION protect_cuve_deletion();
