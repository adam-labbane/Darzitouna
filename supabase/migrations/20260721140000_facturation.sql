ALTER TABLE saison ADD COLUMN next_facture_seq INTEGER NOT NULL DEFAULT 1;

ALTER TABLE facture_service ADD CONSTRAINT facture_service_pressage_id_unique
  UNIQUE (pressage_id);

ALTER TABLE facture_service ADD CONSTRAINT facture_service_numero_unique
  UNIQUE (saison_id, numero_facture);

ALTER TABLE reglement ADD CONSTRAINT reglement_montant_positive CHECK (montant > 0);

CREATE OR REPLACE FUNCTION set_facture_derived_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_saison_id UUID;
  v_client_id UUID;
  v_montant FLOAT;
  v_seq INTEGER;
BEGIN
  SELECT p.saison_id, d.client_id, p.montant_service_total
  INTO v_saison_id, v_client_id, v_montant
  FROM pressage p
  JOIN depot d ON d.id = p.depot_id
  WHERE p.id = NEW.pressage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pressage introuvable';
  END IF;

  IF v_montant IS NULL THEN
    RAISE EXCEPTION 'Ce pressage n''a pas de montant de service calculé';
  END IF;

  NEW.saison_id := v_saison_id;
  NEW.client_id := v_client_id;
  NEW.montant_ttc := v_montant;
  NEW.url_pdf := NULL;

  UPDATE saison
  SET next_facture_seq = next_facture_seq + 1
  WHERE id = v_saison_id
  RETURNING next_facture_seq - 1 INTO v_seq;

  NEW.numero_facture := 'FAC-' || EXTRACT(YEAR FROM NOW())::INTEGER || '-' || LPAD(v_seq::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_facture_insert_set_derived_fields
BEFORE INSERT ON facture_service
FOR EACH ROW
EXECUTE FUNCTION set_facture_derived_fields();

CREATE OR REPLACE FUNCTION enforce_reglement_not_exceeding_solde()
RETURNS TRIGGER AS $$
DECLARE
  v_montant_ttc FLOAT;
  v_deja_regle FLOAT;
BEGIN
  SELECT montant_ttc INTO v_montant_ttc FROM facture_service WHERE id = NEW.facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_deja_regle
  FROM reglement WHERE facture_id = NEW.facture_id;

  IF round((v_deja_regle + NEW.montant)::numeric, 2) > round(v_montant_ttc::numeric, 2) THEN
    RAISE EXCEPTION 'Règlement refusé : le total réglé (% DT) dépasserait le montant de la facture (% DT)',
      round((v_deja_regle + NEW.montant)::numeric, 2), round(v_montant_ttc::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reglement_insert_enforce_solde
BEFORE INSERT ON reglement
FOR EACH ROW
EXECUTE FUNCTION enforce_reglement_not_exceeding_solde();
