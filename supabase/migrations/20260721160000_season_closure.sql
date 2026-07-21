-- ============================================================
-- CLÔTURE DE SAISON ET OUVERTURE D'UNE NOUVELLE CAMPAGNE
--
-- Combine : bilan agrégé (calculé côté JS depuis des requêtes filtrées
-- par RLS — rien à faire ici), report ou vidage tracé du stock des
-- cuves, conservation ou archivage protégé des clients, clôture de
-- l'ancienne saison + création/activation de la nouvelle. Tout dans une
-- seule fonction transactionnelle : soit tout réussit, soit rien n'est
-- appliqué.
-- ============================================================

-- Distincte de is_active : une saison peut être inactive sans être
-- clôturée (deactivateSaison, module Config), mais une saison clôturée
-- ne peut plus jamais redevenir active (voir trigger ci-dessous). La
-- synthèse d'une saison clôturée reste consultable (aucune donnée
-- supprimée, juste ce marqueur figé).
ALTER TABLE saison ADD COLUMN date_cloture TIMESTAMPTZ;

-- ============================================================
-- Une saison clôturée ne peut plus être réactivée. Comportement
-- délibérément strict (pas d'option de "rouvrir") : la clôture fige un
-- bilan comptable consultable ; permettre une réactivation romprait
-- cette garantie (des mouvements pourraient alors s'ajouter après le
-- bilan déjà figé/imprimé).
--
-- Même timing que enforce_single_active_saison (BEFORE UPDATE OF
-- is_active ... WHEN (NEW.is_active)) : les deux s'appliquent côte à
-- côte sur la même transition, sans interférence.
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_reactivating_closed_saison()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.date_cloture IS NOT NULL THEN
    RAISE EXCEPTION 'Cette saison est clôturée et ne peut plus être réactivée';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_saison_prevent_reactivate_closed
BEFORE UPDATE OF is_active ON saison
FOR EACH ROW
WHEN (NEW.is_active)
EXECUTE FUNCTION prevent_reactivating_closed_saison();

-- ============================================================
-- Garde-fou étendu : un client à impayés ou à solde non nul ne peut
-- jamais être archivé — même par la fonction de clôture ci-dessous, qui
-- s'appuie sur ce même trigger plutôt que de dupliquer la règle.
-- CREATE OR REPLACE de la fonction existante (migration
-- 20260720100000_client_soft_delete.sql) : le contrôle de rôle GERANT
-- déjà en place est conservé tel quel, on ajoute seulement le contrôle
-- financier, et seulement pour la transition d'ARCHIVAGE (deleted_at
-- posé) — jamais pour une restauration.
-- ============================================================
CREATE OR REPLACE FUNCTION protect_client_archiving()
RETURNS TRIGGER AS $$
DECLARE
  v_factures_impayees INTEGER;
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
      RAISE EXCEPTION 'Seul un gérant peut archiver ou restaurer un client';
    END IF;

    IF NEW.deleted_at IS NOT NULL THEN
      IF OLD.solde_compte <> 0 THEN
        RAISE EXCEPTION 'Impossible d''archiver % : solde non nul (%)',
          OLD.nom_complet, round(OLD.solde_compte::numeric, 2);
      END IF;

      SELECT COUNT(*) INTO v_factures_impayees
      FROM facture_service
      WHERE client_id = OLD.id AND statut_paiement <> 'PAYE';

      IF v_factures_impayees > 0 THEN
        RAISE EXCEPTION 'Impossible d''archiver % : % facture(s) impayée(s)',
          OLD.nom_complet, v_factures_impayees;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- close_season_and_open_new() — clôture la saison en cours, applique
-- les reports choisis, crée et active la nouvelle saison. SECURITY
-- INVOKER (pas DEFINER, comme create_pressage/create_facture) : chaque
-- écriture (saison, mvt_stock_huile, client) passe par les triggers et
-- policies RLS déjà en place pour l'appelant réel — rien à
-- réimplémenter ici.
-- ============================================================
CREATE OR REPLACE FUNCTION close_season_and_open_new(
  p_old_saison_id UUID,
  p_reporter_stock BOOLEAN,
  p_conserver_clients BOOLEAN,
  p_nom TEXT,
  p_date_debut DATE,
  p_date_fin DATE,
  p_prix FLOAT
)
RETURNS JSONB AS $$
DECLARE
  v_old saison%ROWTYPE;
  v_new saison%ROWTYPE;
  v_cuve RECORD;
  v_clients_proteges INTEGER := 0;
BEGIN
  IF (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut clôturer une saison';
  END IF;

  IF p_prix < 0 THEN
    RAISE EXCEPTION 'Le prix ne peut pas être négatif';
  END IF;
  IF p_date_debut IS NOT NULL AND p_date_fin IS NOT NULL AND p_date_debut >= p_date_fin THEN
    RAISE EXCEPTION 'La date de fin doit être postérieure à la date de début';
  END IF;

  -- RLS filtre déjà par huilerie : un p_old_saison_id d'une autre
  -- huilerie donne simplement NOT FOUND, pas de fuite.
  SELECT * INTO v_old FROM saison WHERE id = p_old_saison_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saison introuvable';
  END IF;
  IF v_old.date_cloture IS NOT NULL THEN
    RAISE EXCEPTION 'Cette saison est déjà clôturée';
  END IF;

  -- Vidage tracé du stock : jamais un UPDATE direct sur cuve.niveau_actuel
  -- — un INSERT dans mvt_stock_huile déclenche update_cuve_stock, qui
  -- applique le delta et vérifie les bornes. enforce_correction_role
  -- (GERANT-only pour type='CORRECTION') s'applique normalement puisque
  -- cette fonction est SECURITY INVOKER.
  IF NOT p_reporter_stock THEN
    FOR v_cuve IN
      SELECT id, niveau_actuel FROM cuve
      WHERE huilerie_id = v_old.huilerie_id AND deleted_at IS NULL AND niveau_actuel > 0
    LOOP
      INSERT INTO mvt_stock_huile (cuve_id, saison_id, type, quantite_delta, note)
      VALUES (v_cuve.id, v_old.id, 'CORRECTION', -v_cuve.niveau_actuel, 'Clôture saison ' || v_old.nom);
    END LOOP;
  END IF;

  -- Clôture de l'ancienne AVANT l'insertion de la nouvelle : quand
  -- enforce_single_active_saison désactivera "les autres saisons
  -- actives" au moment d'activer la nouvelle, l'ancienne est déjà
  -- inactive — pas de double écriture, pas de conflit.
  UPDATE saison
  SET is_active = false, date_cloture = NOW()
  WHERE id = v_old.id
  RETURNING * INTO v_old;

  INSERT INTO saison (huilerie_id, nom, date_debut, date_fin, config_prix_kilo_service, is_active)
  VALUES (v_old.huilerie_id, p_nom, p_date_debut, p_date_fin, p_prix, true)
  RETURNING * INTO v_new;

  -- Archivage en masse des clients éligibles (protect_client_archiving
  -- reste le vrai garde-fou ; ce WHERE ne fait que cibler les bons
  -- clients pour ne pas déclencher inutilement l'exception du trigger
  -- sur des clients qu'on sait déjà protégés).
  IF NOT p_conserver_clients THEN
    SELECT COUNT(*) INTO v_clients_proteges
    FROM client
    WHERE huilerie_id = v_old.huilerie_id
      AND deleted_at IS NULL
      AND (
        solde_compte <> 0
        OR EXISTS (
          SELECT 1 FROM facture_service
          WHERE client_id = client.id AND statut_paiement <> 'PAYE'
        )
      );

    UPDATE client
    SET deleted_at = NOW()
    WHERE huilerie_id = v_old.huilerie_id
      AND deleted_at IS NULL
      AND solde_compte = 0
      AND NOT EXISTS (
        SELECT 1 FROM facture_service
        WHERE client_id = client.id AND statut_paiement <> 'PAYE'
      );
  END IF;

  RETURN jsonb_build_object(
    'ancienne_saison', to_jsonb(v_old),
    'nouvelle_saison', to_jsonb(v_new),
    'clients_proteges_count', v_clients_proteges
  );
END;
$$ LANGUAGE plpgsql;
