ALTER TABLE utilisateur ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION get_login_users(tenant_id UUID)
RETURNS TABLE (
  id UUID,
  nom_complet TEXT,
  role user_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nom_complet, u.role
  FROM utilisateur u
  WHERE u.huilerie_id = tenant_id AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_pin(user_id UUID, pin_attempt TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT hash_pin INTO stored_hash
  FROM utilisateur
  WHERE id = user_id AND deleted_at IS NULL;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(pin_attempt, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION enforce_single_active_saison()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE saison
  SET is_active = false
  WHERE huilerie_id = NEW.huilerie_id
    AND id <> NEW.id
    AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_saison_activate
BEFORE INSERT OR UPDATE OF is_active ON saison
FOR EACH ROW
WHEN (NEW.is_active)
EXECUTE FUNCTION enforce_single_active_saison();

CREATE OR REPLACE FUNCTION enforce_gerant_only_saison()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.jwt() IS NOT NULL AND (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut modifier la configuration des saisons';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_saison_insert_enforce_gerant
BEFORE INSERT ON saison
FOR EACH ROW EXECUTE FUNCTION enforce_gerant_only_saison();

CREATE TRIGGER on_saison_update_enforce_gerant
BEFORE UPDATE OF nom, date_debut, date_fin, config_prix_kilo_service, is_active ON saison
FOR EACH ROW EXECUTE FUNCTION enforce_gerant_only_saison();

CREATE TRIGGER on_saison_delete_enforce_gerant
BEFORE DELETE ON saison
FOR EACH ROW EXECUTE FUNCTION enforce_gerant_only_saison();

CREATE OR REPLACE FUNCTION enforce_gerant_only_utilisateur()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.jwt() IS NOT NULL AND (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut gérer le personnel';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_utilisateur_insert_enforce_gerant
BEFORE INSERT ON utilisateur
FOR EACH ROW EXECUTE FUNCTION enforce_gerant_only_utilisateur();

CREATE TRIGGER on_utilisateur_update_enforce_gerant
BEFORE UPDATE ON utilisateur
FOR EACH ROW EXECUTE FUNCTION enforce_gerant_only_utilisateur();

CREATE OR REPLACE FUNCTION protect_utilisateur_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_autres_gerants INTEGER;
BEGIN
  IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
     OR (NEW.role = 'OPERATEUR' AND OLD.role = 'GERANT') THEN

    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Vous ne pouvez pas archiver ou rétrograder votre propre compte';
    END IF;

    IF OLD.role = 'GERANT' THEN
      SELECT COUNT(*) INTO v_autres_gerants
      FROM utilisateur
      WHERE huilerie_id = OLD.huilerie_id
        AND role = 'GERANT'
        AND deleted_at IS NULL
        AND id <> OLD.id;

      IF v_autres_gerants = 0 THEN
        RAISE EXCEPTION 'Impossible : % est le dernier gérant de cette huilerie', OLD.nom_complet;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_utilisateur_update_protect_integrity
BEFORE UPDATE ON utilisateur
FOR EACH ROW EXECUTE FUNCTION protect_utilisateur_integrity();

CREATE OR REPLACE FUNCTION block_utilisateur_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Suppression directe interdite : utilisez l''archivage (deleted_at)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_utilisateur_delete_blocked
BEFORE DELETE ON utilisateur
FOR EACH ROW EXECUTE FUNCTION block_utilisateur_hard_delete();

REVOKE EXECUTE ON FUNCTION set_user_pin(UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION create_utilisateur(
  p_nom_complet TEXT,
  p_role user_role,
  p_pin TEXT
)
RETURNS utilisateur AS $$
DECLARE
  v_huilerie_id UUID;
  v_login_code TEXT;
  v_utilisateur utilisateur%ROWTYPE;
BEGIN
  IF (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut créer un utilisateur';
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Le code PIN doit comporter exactement 4 chiffres';
  END IF;

  v_huilerie_id := (auth.jwt() ->> 'huilerie_id')::UUID;
  IF v_huilerie_id IS NULL THEN
    RAISE EXCEPTION 'Session invalide : huilerie introuvable';
  END IF;

  v_login_code := lower(regexp_replace(split_part(trim(p_nom_complet), ' ', 1), '[^a-zA-Z0-9]', '', 'g'));
  IF v_login_code = '' THEN
    v_login_code := 'utilisateur';
  END IF;

  INSERT INTO utilisateur (huilerie_id, nom_complet, role, login_code, hash_pin)
  VALUES (v_huilerie_id, trim(p_nom_complet), p_role, v_login_code, '')
  RETURNING * INTO v_utilisateur;

  PERFORM set_user_pin(v_utilisateur.id, p_pin);

  RETURN v_utilisateur;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_utilisateur_pin(p_user_id UUID, p_pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_target_huilerie_id UUID;
BEGIN
  IF (auth.jwt() ->> 'huilerie_role') IS DISTINCT FROM 'GERANT' THEN
    RAISE EXCEPTION 'Seul un gérant peut réinitialiser un code PIN';
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Le code PIN doit comporter exactement 4 chiffres';
  END IF;

  SELECT huilerie_id INTO v_target_huilerie_id
  FROM utilisateur
  WHERE id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_target_huilerie_id::TEXT IS DISTINCT FROM (auth.jwt() ->> 'huilerie_id') THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  PERFORM set_user_pin(p_user_id, p_pin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
