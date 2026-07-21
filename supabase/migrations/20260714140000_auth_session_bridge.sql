CREATE OR REPLACE FUNCTION derive_auth_password(p_user_id UUID, p_pin TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_user_id::text || ':' || p_pin, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

REVOKE EXECUTE ON FUNCTION derive_auth_password(UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION set_user_pin(user_id UUID, pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_email TEXT;
  v_derived_password TEXT;
BEGIN
  UPDATE utilisateur
  SET hash_pin = crypt(pin, gen_salt('bf'))
  WHERE id = user_id;

  v_email := user_id::text || '@darzitouna.local';
  v_derived_password := derive_auth_password(user_id, pin);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_derived_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW(),
    false,
    false,
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    updated_at = NOW();

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    user_id::text,
    user_id,
    jsonb_build_object(
      'sub', user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  v_huilerie_id UUID;
  v_role public.user_role;
BEGIN
  SELECT huilerie_id, role
  INTO v_huilerie_id, v_role
  FROM public.utilisateur
  WHERE id = (event->>'user_id')::uuid;

  claims := COALESCE(event->'claims', '{}'::jsonb);

  IF v_huilerie_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{huilerie_id}', to_jsonb(v_huilerie_id::text));
    claims := jsonb_set(claims, '{huilerie_role}', to_jsonb(v_role::text));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION custom_access_token_hook FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  huilerie, saison, utilisateur, client, fournisseur, acheteur_grignon,
  cuve, depot, pressage, facture_service, reglement, vente_grignon,
  mvt_stock_huile
TO authenticated;
