ALTER TABLE saison ADD COLUMN next_ticket_seq INTEGER NOT NULL DEFAULT 1;

ALTER TABLE depot ADD CONSTRAINT depot_numero_ticket_unique UNIQUE (saison_id, numero_ticket);

CREATE OR REPLACE FUNCTION set_depot_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  UPDATE saison
  SET next_ticket_seq = next_ticket_seq + 1
  WHERE id = NEW.saison_id
  RETURNING next_ticket_seq - 1 INTO v_seq;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saison % introuvable pour générer le numéro de ticket', NEW.saison_id;
  END IF;

  NEW.numero_ticket := 'TK-' || EXTRACT(YEAR FROM NOW())::INTEGER || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_depot_insert_set_ticket_number
BEFORE INSERT ON depot
FOR EACH ROW
EXECUTE FUNCTION set_depot_ticket_number();

CREATE OR REPLACE FUNCTION enforce_depot_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id doit correspondre à l''utilisateur connecté';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_depot_insert_enforce_user
BEFORE INSERT ON depot
FOR EACH ROW
EXECUTE FUNCTION enforce_depot_user_id();
