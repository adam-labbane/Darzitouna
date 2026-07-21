ALTER TABLE client ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION protect_client_archiving()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut archiver ou restaurer un client';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_client_update_protect_archiving
BEFORE UPDATE ON client
FOR EACH ROW
EXECUTE FUNCTION protect_client_archiving();
