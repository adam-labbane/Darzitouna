-- ============================================================
-- PONT ENTRE LE LOGIN PIN ET UNE VRAIE SESSION SUPABASE AUTH
--
-- Problème résolu : verify_pin() valide un PIN mais ne crée aucune
-- session Supabase Auth, donc auth.jwt() est NULL et les policies RLS
-- (déjà écrites pour lire auth.jwt() ->> 'huilerie_id') ne filtrent
-- jamais rien. On lie chaque utilisateur métier à un compte
-- auth.users (même UUID) dont le mot de passe est dérivé du PIN, et
-- on enrichit le JWT via un Custom Access Token Hook.
-- ============================================================

-- ============================================================
-- 1. Dérivation du mot de passe interne à partir du PIN
--
-- Le PIN à 4 chiffres seul est trop faible et trop court pour
-- Supabase Auth (minimum_password_length = 6). On le combine avec
-- l'id de l'utilisateur : deux utilisateurs avec le même PIN
-- obtiennent des mots de passe différents.
--
-- Formule volontairement publique et sans secret serveur (pas de
-- "pepper") : le client recalcule exactement la même chose en JS
-- (Web Crypto SHA-256) pour appeler signInWithPassword sans aller-
-- retour réseau supplémentaire. La protection contre le brute-force
-- ne repose pas sur le secret de la formule mais sur (a) le PIN
-- lui-même, (b) le rate-limiting natif de Supabase Auth par IP,
-- (c) notre verrouillage client (src/lib/pinAuth.ts).
-- ============================================================
CREATE OR REPLACE FUNCTION derive_auth_password(p_user_id UUID, p_pin TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_user_id::text || ':' || p_pin, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Pas d'usage client légitime : le front recalcule la même formule
-- lui-même. On ferme l'accès RPC public par principe de moindre
-- privilège (elle ne fait rien de secret, mais n'a rien à faire
-- exposée non plus).
REVOKE EXECUTE ON FUNCTION derive_auth_password(UUID, TEXT) FROM PUBLIC;

-- ============================================================
-- 2. set_user_pin() étendue : une seule fonction, une seule source
--    de vérité pour le PIN en clair au moment où il est connu.
--
-- Elle continue de hacher hash_pin (bcrypt, vérifié par verify_pin),
-- ET synchronise dans la même opération le compte auth.users /
-- auth.identities lié, avec le mot de passe dérivé du même PIN.
-- Comme les deux hachages partent de la même valeur en clair au
-- même instant, hash_pin et le mot de passe Auth ne peuvent jamais
-- diverger (pas de double source de vérité en pratique, même si ce
-- sont deux hash distincts stockés dans deux endroits).
--
-- Contrat : créer un utilisateur métier nécessite d'appeler
-- set_user_pin(id, pin) juste après l'INSERT dans utilisateur — voir
-- supabase/seed.sql pour l'exemple.
-- ============================================================
CREATE OR REPLACE FUNCTION set_user_pin(user_id UUID, pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_email TEXT;
  v_derived_password TEXT;
BEGIN
  -- Vérification métier (bcrypt) — inchangée.
  UPDATE utilisateur
  SET hash_pin = crypt(pin, gen_salt('bf'))
  WHERE id = user_id;

  v_email := user_id::text || '@darzitouna.local';
  v_derived_password := derive_auth_password(user_id, pin);

  -- Compte Auth lié : même id que l'utilisateur métier (une seule
  -- identité, pas de colonne de liaison supplémentaire). L'email
  -- interne n'est jamais affiché dans l'UI.
  --
  -- confirmation_token/recovery_token/email_change_token_new/email_change
  -- sont explicitement mis à '' (et non laissés à leur défaut NULL) : le
  -- driver Go de GoTrue scanne ces colonnes comme des chaînes non-nullables
  -- et renvoie une 500 ("converting NULL to string") sinon — comportement
  -- constaté en testant le vrai flux de connexion en local.
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

  -- Identité "email" liée — requise par Supabase Auth pour que
  -- signInWithPassword reconnaisse le compte.
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

-- ============================================================
-- 3. Custom Access Token Hook : injecte huilerie_id et huilerie_role
--    comme claims top-level dans le JWT à chaque émission de token.
--
-- SECURITY DEFINER + propriétaire postgres (propriétaire de la table
-- utilisateur) => la lecture bypass le RLS naturellement, comme pour
-- verify_pin/get_login_users. Pas besoin d'un GRANT SELECT séparé.
--
-- Le claim s'appelle "huilerie_role" et NON "role" : "role" est un
-- claim réservé utilisé par PostgREST/GoTrue pour choisir le rôle
-- Postgres de la requête (anon/authenticated/service_role). L'écraser
-- casserait l'authentification de tout le monde.
-- ============================================================
-- Schéma qualifié explicitement (public.user_role, public.utilisateur) :
-- la connexion utilisée par GoTrue pour appeler le hook n'a pas forcément
-- "public" dans son search_path, et un type/table non qualifié provoque
-- une erreur 42704 ("type does not exist") — constaté en local.
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

-- Seul le service Auth (supabase_auth_admin) est autorisé à appeler
-- ce hook — jamais un utilisateur authentifié ou anonyme.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION custom_access_token_hook FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4. GRANTs table-level pour le rôle "authenticated"
--
-- RLS ne remplace pas les privilèges SQL classiques, il les
-- restreint : sans GRANT explicite, Postgres refuse la requête
-- AVANT même d'évaluer les policies RLS ("permission denied for
-- table client", constaté en testant le vrai flux ci-dessus).
-- Jusqu'ici, seules les fonctions SECURITY DEFINER (get_login_users,
-- verify_pin...) accédaient à ces tables ; maintenant qu'une vraie
-- session existe, l'API REST auto-générée de Supabase doit pouvoir
-- les servir directement — c'est tout l'intérêt de brancher une
-- session Auth plutôt que d'écrire une RPC par opération CRUD.
--
-- "anon" ne reçoit RIEN ici : avant login, seules les RPC dédiées
-- (activate_tablet, get_login_users) sont accessibles.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  huilerie, saison, utilisateur, client, fournisseur, acheteur_grignon,
  cuve, depot, pressage, facture_service, reglement, vente_grignon,
  mvt_stock_huile
TO authenticated;
