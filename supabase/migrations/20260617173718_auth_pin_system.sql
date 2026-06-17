-- ============================================================
-- Active l'extension pgcrypto (déjà disponible dans Supabase)
-- Elle nous donne les fonctions crypt() et gen_salt()
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Fonction pour CRÉER ou MODIFIER un PIN hashé
-- Appelée quand le gérant crée un opérateur ou change son PIN
-- Entrée : l'id de l'utilisateur + le PIN en clair
-- Résultat : le PIN est haché et stocké dans hash_pin
-- ============================================================
CREATE OR REPLACE FUNCTION set_user_pin(user_id UUID, pin TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE utilisateur
  SET hash_pin = crypt(pin, gen_salt('bf'))
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fonction pour VÉRIFIER un PIN à la connexion
-- Entrée : l'id de l'utilisateur + le PIN tapé
-- Sortie : true si le PIN est correct, false sinon
-- Le hash ne quitte JAMAIS la base de données
-- ============================================================
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