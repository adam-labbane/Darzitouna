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
  WHERE u.huilerie_id = tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
