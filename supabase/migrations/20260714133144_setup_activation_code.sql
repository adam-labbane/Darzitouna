ALTER TABLE huilerie ADD COLUMN code_activation TEXT UNIQUE;

CREATE OR REPLACE FUNCTION activate_tablet(code TEXT)
RETURNS UUID AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM huilerie
  WHERE code_activation = code;

  RETURN found_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
