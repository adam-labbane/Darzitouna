CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_user_pin(user_id UUID, pin TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE utilisateur
  SET hash_pin = crypt(pin, gen_salt('bf'))
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_pin(user_id UUID, pin_attempt TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT hash_pin INTO stored_hash
  FROM utilisateur
  WHERE id = user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(pin_attempt, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
