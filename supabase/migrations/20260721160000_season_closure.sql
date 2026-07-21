ALTER TABLE saison ADD COLUMN date_cloture TIMESTAMPTZ;

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

  SELECT * INTO v_old FROM saison WHERE id = p_old_saison_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saison introuvable';
  END IF;
  IF v_old.date_cloture IS NOT NULL THEN
    RAISE EXCEPTION 'Cette saison est déjà clôturée';
  END IF;

  IF NOT p_reporter_stock THEN
    FOR v_cuve IN
      SELECT id, niveau_actuel FROM cuve
      WHERE huilerie_id = v_old.huilerie_id AND deleted_at IS NULL AND niveau_actuel > 0
    LOOP
      INSERT INTO mvt_stock_huile (cuve_id, saison_id, type, quantite_delta, note)
      VALUES (v_cuve.id, v_old.id, 'CORRECTION', -v_cuve.niveau_actuel, 'Clôture saison ' || v_old.nom);
    END LOOP;
  END IF;

  UPDATE saison
  SET is_active = false, date_cloture = NOW()
  WHERE id = v_old.id
  RETURNING * INTO v_old;

  INSERT INTO saison (huilerie_id, nom, date_debut, date_fin, config_prix_kilo_service, is_active)
  VALUES (v_old.huilerie_id, p_nom, p_date_debut, p_date_fin, p_prix, true)
  RETURNING * INTO v_new;

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
