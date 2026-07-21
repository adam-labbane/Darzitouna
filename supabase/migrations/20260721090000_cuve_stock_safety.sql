ALTER TABLE mvt_stock_huile ADD COLUMN note TEXT;

ALTER TABLE cuve ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE cuve ADD CONSTRAINT cuve_capacite_max_positive CHECK (capacite_max > 0);
ALTER TABLE cuve ADD CONSTRAINT cuve_niveau_within_capacity
  CHECK (niveau_actuel >= 0 AND niveau_actuel <= capacite_max);

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
