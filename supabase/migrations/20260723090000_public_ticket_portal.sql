ALTER TABLE depot
  ADD COLUMN token_public TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER TABLE depot
  ADD CONSTRAINT depot_token_public_unique UNIQUE (token_public);

CREATE OR REPLACE FUNCTION get_ticket_public(p_token TEXT)
RETURNS TABLE (
  numero_ticket TEXT,
  date_depot TIMESTAMPTZ,
  poids_olives_kg FLOAT,
  est_presse BOOLEAN,
  quantite_huile_kg FLOAT,
  rendement_final FLOAT,
  type_huile type_huile,
  huilerie_nom TEXT,
  montant_total FLOAT,
  montant_paye FLOAT,
  reste_du FLOAT
) AS $$
DECLARE
  v_depot depot%ROWTYPE;
  v_pressage pressage%ROWTYPE;
  v_facture facture_service%ROWTYPE;
  v_huilerie_nom TEXT;
  v_montant_total FLOAT;
  v_montant_paye FLOAT;
BEGIN
  SELECT * INTO v_depot FROM depot WHERE token_public = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT h.nom_societe INTO v_huilerie_nom
  FROM saison s
  JOIN huilerie h ON h.id = s.huilerie_id
  WHERE s.id = v_depot.saison_id;

  SELECT * INTO v_pressage FROM pressage WHERE depot_id = v_depot.id;

  IF v_pressage.id IS NOT NULL THEN
    SELECT * INTO v_facture FROM facture_service WHERE pressage_id = v_pressage.id;
  END IF;

  IF v_depot.is_achat_olives THEN
    v_montant_total := COALESCE(v_depot.prix_achat_unitaire, 0) * v_depot.poids_olives_kg;
    v_montant_paye := v_depot.montant_paye_achat;
  ELSIF v_facture.id IS NOT NULL THEN
    v_montant_total := v_facture.montant_ttc;
    SELECT COALESCE(SUM(montant), 0) INTO v_montant_paye FROM reglement WHERE facture_id = v_facture.id;
  ELSIF v_pressage.id IS NOT NULL THEN
    v_montant_total := v_pressage.montant_service_total;
    v_montant_paye := 0;
  ELSE
    v_montant_total := NULL;
    v_montant_paye := NULL;
  END IF;

  RETURN QUERY
  SELECT
    v_depot.numero_ticket,
    v_depot.date_depot,
    v_depot.poids_olives_kg,
    v_pressage.id IS NOT NULL,
    v_pressage.quantite_huile_kg,
    v_pressage.rendement_final,
    v_pressage.type_huile,
    v_huilerie_nom,
    v_montant_total,
    v_montant_paye,
    CASE WHEN v_montant_total IS NULL THEN NULL ELSE GREATEST(v_montant_total - COALESCE(v_montant_paye, 0), 0) END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_ticket_public(TEXT) TO anon;
