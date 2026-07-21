CREATE OR REPLACE FUNCTION enforce_saison_active_for_write()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saison WHERE id = NEW.saison_id AND is_active = true) THEN
    RAISE EXCEPTION 'Impossible d''écrire : la saison ciblée n''est pas active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_depot_insert_enforce_saison_active
BEFORE INSERT ON depot
FOR EACH ROW
EXECUTE FUNCTION enforce_saison_active_for_write();

CREATE TRIGGER on_mvt_stock_insert_enforce_saison_active
BEFORE INSERT ON mvt_stock_huile
FOR EACH ROW
EXECUTE FUNCTION enforce_saison_active_for_write();

CREATE OR REPLACE FUNCTION create_pressage(
  p_depot_id UUID,
  p_cuve_id UUID,
  p_quantite_huile_kg FLOAT,
  p_type_huile type_huile
)
RETURNS pressage AS $$
DECLARE
  v_depot depot%ROWTYPE;
  v_prix_kilo FLOAT;
  v_rendement FLOAT;
  v_montant FLOAT;
  v_pressage pressage%ROWTYPE;
BEGIN
  IF p_quantite_huile_kg IS NULL OR p_quantite_huile_kg <= 0 THEN
    RAISE EXCEPTION 'La quantité d''huile doit être supérieure à 0';
  END IF;

  SELECT * INTO v_depot FROM depot WHERE id = p_depot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépôt introuvable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM saison WHERE id = v_depot.saison_id AND is_active = true) THEN
    RAISE EXCEPTION 'Impossible de presser un dépôt d''une saison qui n''est plus active';
  END IF;

  IF EXISTS (SELECT 1 FROM pressage WHERE depot_id = p_depot_id) THEN
    RAISE EXCEPTION 'Ce dépôt a déjà été pressé';
  END IF;

  IF p_quantite_huile_kg > v_depot.poids_olives_kg THEN
    RAISE EXCEPTION 'La quantité d''huile (% kg) ne peut pas dépasser le poids d''olives du dépôt (% kg)',
      round(p_quantite_huile_kg::numeric, 2), round(v_depot.poids_olives_kg::numeric, 2);
  END IF;

  v_rendement := round((p_quantite_huile_kg / v_depot.poids_olives_kg * 100)::numeric, 2);

  IF v_depot.is_achat_olives THEN
    v_montant := 0;
  ELSE
    SELECT config_prix_kilo_service INTO v_prix_kilo
    FROM saison WHERE id = v_depot.saison_id;
    v_montant := round((v_depot.poids_olives_kg * COALESCE(v_prix_kilo, 0))::numeric, 2);
  END IF;

  INSERT INTO pressage (
    saison_id, depot_id, date_fin, quantite_huile_kg,
    rendement_final, montant_service_total, user_id, type_huile
  ) VALUES (
    v_depot.saison_id, p_depot_id, NOW(), p_quantite_huile_kg,
    v_rendement, v_montant, auth.uid(), p_type_huile
  )
  RETURNING * INTO v_pressage;

  INSERT INTO mvt_stock_huile (cuve_id, saison_id, type, quantite_delta, pressage_id)
  VALUES (p_cuve_id, v_depot.saison_id, 'PROD', p_quantite_huile_kg, v_pressage.id);

  RETURN v_pressage;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

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

  IF NOT EXISTS (SELECT 1 FROM saison WHERE id = v_saison_id AND is_active = true) THEN
    RAISE EXCEPTION 'Impossible de facturer un pressage d''une saison qui n''est plus active';
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
