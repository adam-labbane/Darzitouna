CREATE OR REPLACE FUNCTION update_cuve_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cuve
  SET niveau_actuel = niveau_actuel + NEW.quantite_delta
  WHERE id = NEW.cuve_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_mvt_stock_insert
AFTER INSERT ON mvt_stock_huile
FOR EACH ROW
EXECUTE FUNCTION update_cuve_stock();

CREATE OR REPLACE FUNCTION update_facture_statut()
RETURNS TRIGGER AS $$
DECLARE
  total_regle FLOAT;
  montant_facture FLOAT;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO total_regle
  FROM reglement
  WHERE facture_id = NEW.facture_id;

  SELECT montant_ttc INTO montant_facture
  FROM facture_service
  WHERE id = NEW.facture_id;

  IF total_regle >= montant_facture THEN
    UPDATE facture_service
    SET statut_paiement = 'PAYE'
    WHERE id = NEW.facture_id;
  ELSIF total_regle > 0 THEN
    UPDATE facture_service
    SET statut_paiement = 'PARTIEL'
    WHERE id = NEW.facture_id;
  ELSE
    UPDATE facture_service
    SET statut_paiement = 'NON_PAYE'
    WHERE id = NEW.facture_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reglement_insert
AFTER INSERT ON reglement
FOR EACH ROW
EXECUTE FUNCTION update_facture_statut();

ALTER TABLE huilerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE saison ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateur ENABLE ROW LEVEL SECURITY;
ALTER TABLE client ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseur ENABLE ROW LEVEL SECURITY;
ALTER TABLE acheteur_grignon ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuve ENABLE ROW LEVEL SECURITY;
ALTER TABLE depot ENABLE ROW LEVEL SECURITY;
ALTER TABLE pressage ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglement ENABLE ROW LEVEL SECURITY;
ALTER TABLE vente_grignon ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvt_stock_huile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huilerie_isolation" ON huilerie
  FOR ALL
  USING (id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "saison_isolation" ON saison
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "utilisateur_isolation" ON utilisateur
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "client_isolation" ON client
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "fournisseur_isolation" ON fournisseur
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "acheteur_grignon_isolation" ON acheteur_grignon
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "cuve_isolation" ON cuve
  FOR ALL
  USING (huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id');

CREATE POLICY "depot_isolation" ON depot
  FOR ALL
  USING (
    saison_id IN (
      SELECT id FROM saison
      WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
    )
  );

CREATE POLICY "pressage_isolation" ON pressage
  FOR ALL
  USING (
    saison_id IN (
      SELECT id FROM saison
      WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
    )
  );

CREATE POLICY "facture_isolation" ON facture_service
  FOR ALL
  USING (
    saison_id IN (
      SELECT id FROM saison
      WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
    )
  );

CREATE POLICY "reglement_isolation" ON reglement
  FOR ALL
  USING (
    facture_id IN (
      SELECT id FROM facture_service
      WHERE saison_id IN (
        SELECT id FROM saison
        WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
      )
    )
  );

CREATE POLICY "vente_grignon_isolation" ON vente_grignon
  FOR ALL
  USING (
    saison_id IN (
      SELECT id FROM saison
      WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
    )
  );

CREATE POLICY "mvt_stock_isolation" ON mvt_stock_huile
  FOR ALL
  USING (
    cuve_id IN (
      SELECT id FROM cuve
      WHERE huilerie_id::TEXT = auth.jwt() ->> 'huilerie_id'
    )
  );
