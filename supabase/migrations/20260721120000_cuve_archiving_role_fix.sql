CREATE OR REPLACE FUNCTION protect_cuve_deletion()
RETURNS TRIGGER AS $$
BEGIN
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
