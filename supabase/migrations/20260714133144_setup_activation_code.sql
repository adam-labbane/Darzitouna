-- ============================================================
-- Ajout du code d'activation à la table huilerie
-- Ce code est fourni au gérant pour configurer sa tablette
-- ============================================================
ALTER TABLE huilerie ADD COLUMN code_activation TEXT UNIQUE;

-- ============================================================
-- Fonction qui vérifie un code d'activation
-- Entrée : le code tapé par le gérant
-- Sortie : l'id de l'huilerie si le code est valide, sinon NULL
-- SECURITY DEFINER car l'utilisateur n'est pas encore connecté
-- ============================================================
CREATE OR REPLACE FUNCTION activate_tablet(code TEXT)
RETURNS UUID AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM huilerie
  WHERE code_activation = code;

  RETURN found_id;  -- NULL si aucune huilerie ne correspond
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;