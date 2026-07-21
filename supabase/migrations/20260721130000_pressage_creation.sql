ALTER TABLE pressage ADD COLUMN user_id UUID REFERENCES utilisateur(id);

ALTER TABLE pressage ADD COLUMN type_huile type_huile;

ALTER TABLE pressage ADD CONSTRAINT pressage_quantite_huile_positive
  CHECK (quantite_huile_kg IS NULL OR quantite_huile_kg > 0);

ALTER TABLE pressage ADD CONSTRAINT pressage_depot_id_unique UNIQUE (depot_id);

CREATE OR REPLACE FUNCTION enforce_pressage_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id doit correspondre à l''utilisateur connecté';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pressage_insert_enforce_user
BEFORE INSERT ON pressage
FOR EACH ROW
EXECUTE FUNCTION enforce_pressage_user_id();

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
