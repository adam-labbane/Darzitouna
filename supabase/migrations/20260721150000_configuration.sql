-- ============================================================
-- MODULE CONFIGURATION — Saisons + Personnel, réservé au GERANT.
--
-- Corrige au passage deux lacunes préexistantes découvertes en
-- construisant ce module (pas des régressions introduites ici) :
-- set_user_pin() n'a jamais vérifié qui l'appelle ni que l'utilisateur
-- ciblé appartient à la bonne huilerie (appelable en RPC direct par
-- n'importe qui) ; saison/utilisateur n'avaient aucune restriction de
-- rôle en écriture (seule l'isolation par huilerie était garantie).
-- ============================================================

-- Soft delete du personnel, cohérent avec client.deleted_at/cuve.deleted_at.
-- Un hard DELETE échouerait de toute façon dès qu'un utilisateur a de
-- l'historique (depot.user_id/pressage.user_id sans CASCADE), mais un
-- utilisateur flambant neuf pourrait encore être hard-deleted via un
-- appel API brut — voir block_utilisateur_hard_delete plus bas.
ALTER TABLE utilisateur ADD COLUMN deleted_at TIMESTAMPTZ;

-- Un utilisateur archivé ne doit plus pouvoir se connecter : ni
-- apparaître dans la liste de sélection du profil, ni réussir une
-- vérification de PIN directe (défense en profondeur, même si
-- get_login_users filtre déjà la liste affichée).
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

-- ============================================================
-- Une seule saison active par huilerie — trigger, pas une contrainte
-- UNIQUE partielle classique : le besoin est "désactiver l'ancienne
-- automatiquement", pas "rejeter la nouvelle activation". Une
-- contrainte UNIQUE rejetterait l'écriture avant que quoi que ce soit
-- n'ait pu désactiver l'autre ligne.
--
-- BEFORE (pas AFTER) : la désactivation des autres lignes doit être
-- effective avant que la ligne NEW ne soit elle-même écrite, pour qu'il
-- n'existe à aucun instant deux lignes actives — même via un appel API
-- direct qui contournerait totalement le React.
--
-- WHEN (NEW.is_active) : ne se déclenche qu'à l'ACTIVATION, jamais à la
-- désactivation (désactiver une saison ne doit rien faire d'autre).
-- ============================================================
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

-- ============================================================
-- saison réservée au GERANT — masquage React déjà en place
-- (src/lib/navigation.ts, gerantOnly) mais ce n'est QUE de l'UX, pas
-- une protection : un OPERATEUR qui appelle directement l'API REST
-- passerait au travers sans ces triggers.
--
-- UPDATE OF <colonnes précises>, pas un BEFORE UPDATE générique :
-- set_depot_ticket_number()/set_facture_derived_fields() incrémentent
-- next_ticket_seq/next_facture_seq via un UPDATE sur saison, déclenché
-- par un simple OPERATEUR qui crée un dépôt ou une facture. Un trigger
-- générique casserait ces flux. En listant seulement les colonnes de
-- configuration réelle, le trigger ignore les compteurs de séquence.
-- ============================================================
-- auth.jwt() IS NOT NULL en préalable : dans un contexte psql brut
-- (migrations, seed.sql — postgres est superutilisateur, il ignore les
-- GRANT/REVOKE mais PAS les triggers), auth.jwt() vaut NULL car aucune
-- requête PostgREST n'a jamais posé le paramètre de session
-- request.jwt.claims. Un appel réellement médié par l'API — même avec
-- la clé anon — porte toujours un JWT décodé (au moins role:anon) :
-- auth.jwt() y est donc non NULL, seul huilerie_role peut manquer. Ce
-- test distingue donc bien "contexte serveur de confiance" de "appel
-- client sans le bon rôle", sans jamais laisser passer un appelant réel
-- qui ne serait pas GERANT.
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

-- ============================================================
-- utilisateur réservé au GERANT — même principe. Ici pas besoin de
-- portée de colonnes : rien d'autre dans l'app n'écrit sur utilisateur
-- en dehors de ce module.
-- ============================================================
-- Même précaution auth.jwt() IS NOT NULL que enforce_gerant_only_saison
-- ci-dessus (contexte seed.sql pour les deux premiers utilisateurs de
-- test — sans quoi le tout premier gérant d'une huilerie ne pourrait
-- même pas être provisionné).
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

-- ============================================================
-- Garde-fous d'intégrité : ni auto-suppression, ni suppression du
-- dernier gérant. Extension délibérée : la DÉMOTION (GERANT->OPERATEUR)
-- reçoit exactement la même protection que l'archivage — se rétrograder
-- soi-même ou rétrograder le dernier gérant produit le même scénario
-- dangereux ("plus personne pour administrer" / "verrouillage en pleine
-- session") que la suppression que le brief décrit explicitement.
-- ============================================================
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

-- Verrou hard-delete : force le passage par l'archivage (deleted_at)
-- pour TOUT utilisateur, y compris un compte flambant neuf sans
-- historique qui pourrait sinon être hard-deleted sans qu'aucune
-- contrainte de clé étrangère ne s'y oppose.
CREATE OR REPLACE FUNCTION block_utilisateur_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Suppression directe interdite : utilisez l''archivage (deleted_at)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_utilisateur_delete_blocked
BEFORE DELETE ON utilisateur
FOR EACH ROW EXECUTE FUNCTION block_utilisateur_hard_delete();

-- ============================================================
-- set_user_pin() n'est plus appelable directement depuis un client
-- (comme derive_auth_password déjà) : elle n'a jamais vérifié ni le
-- rôle de l'appelant ni que l'utilisateur ciblé appartient à sa
-- huilerie. seed.sql continue de l'appeler directement : il s'exécute
-- en tant que rôle "postgres" (superutilisateur), qui ignore tout
-- REVOKE par définition — aucune régression sur le seed.
-- ============================================================
REVOKE EXECUTE ON FUNCTION set_user_pin(UUID, TEXT) FROM PUBLIC;

-- ============================================================
-- create_utilisateur() — seul point d'entrée pour créer un membre du
-- personnel. SECURITY DEFINER : l'appel imbriqué à set_user_pin()
-- fonctionne malgré le REVOKE ci-dessus, car une fonction SECURITY
-- DEFINER s'exécute avec les privilèges de son PROPRIÉTAIRE, pas de
-- l'appelant — auth.jwt()/auth.uid() restent en revanche ceux du vrai
-- appelant (lus depuis un paramètre de session, jamais affectés par le
-- changement de privilèges), donc le contrôle de rôle ci-dessous reste
-- fiable.
-- ============================================================
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

  -- huilerie_id vient toujours de la session, jamais d'un paramètre :
  -- rien à falsifier pour créer un utilisateur dans une autre huilerie.
  v_huilerie_id := (auth.jwt() ->> 'huilerie_id')::UUID;
  IF v_huilerie_id IS NULL THEN
    RAISE EXCEPTION 'Session invalide : huilerie introuvable';
  END IF;

  -- login_code : champ hérité du MCD d'origine, jamais lu par le flux
  -- de connexion actuel (get_login_users ne le sélectionne pas) — on
  -- lui donne juste une valeur non ambiguë dérivée du nom.
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

-- reset_utilisateur_pin() : vérifie en plus que l'utilisateur ciblé
-- appartient à la même huilerie que l'appelant — set_user_pin() seule
-- ne le vérifiait pas, ce qui aurait permis à un GERANT (ou pire, un
-- appel RPC direct par n'importe qui avant le REVOKE ci-dessus) de
-- réinitialiser le PIN d'un utilisateur d'une AUTRE huilerie.
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
