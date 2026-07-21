-- ============================================================
-- MODULE PRESSAGE — jonction Dépôts → Cuves.
--
-- Un pressage transforme les olives d'un dépôt en huile, remplit une
-- cuve (via le trigger update_cuve_stock déjà existant) et prépare les
-- données de facturation (montant_service_total, exploité plus tard par
-- le module Facturation — la facture elle-même n'est pas générée ici).
-- ============================================================

-- Traçabilité : qui a clôturé le pressage. Comme depot.user_id, ne
-- vient jamais d'un champ modifiable côté client — voir
-- enforce_pressage_user_id ci-dessous (même patron que
-- enforce_depot_user_id, migration 20260720110000_depot_ticket_and_security.sql).
ALTER TABLE pressage ADD COLUMN user_id UUID REFERENCES utilisateur(id);

-- Type d'huile obtenu, constaté par l'opérateur à la sortie du pressoir
-- (pas dans le MCD d'origine : rien n'y capturait cette information).
-- Réutilise l'ENUM déjà défini pour cuve.type_huile.
ALTER TABLE pressage ADD COLUMN type_huile type_huile;

-- Défense en profondeur, même principe que cuve_capacite_max_positive :
-- protège aussi un futur chemin d'écriture qui contournerait la
-- fonction create_pressage.
ALTER TABLE pressage ADD CONSTRAINT pressage_quantite_huile_positive
  CHECK (quantite_huile_kg IS NULL OR quantite_huile_kg > 0);

-- Anti double-pressage : filet de sécurité final contre une course entre
-- deux requêtes quasi simultanées. Le contrôle applicatif (IF EXISTS
-- dans create_pressage) donne le message clair ; cette contrainte est
-- ce qui empêche réellement la corruption si les deux contrôles
-- s'exécutent avant qu'aucun des deux INSERT n'ait committé.
ALTER TABLE pressage ADD CONSTRAINT pressage_depot_id_unique UNIQUE (depot_id);

-- ============================================================
-- user_id non falsifiable — même patron que enforce_depot_user_id.
-- Protège aussi bien les appels via create_pressage() (qui pose
-- explicitement user_id = auth.uid()) qu'un éventuel INSERT direct sur
-- la table via l'API REST (la policy RLS pressage_isolation seule ne
-- vérifie que la huilerie, pas l'utilisateur).
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_pressage_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id doit correspondre à l''utilisateur connecté';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pressage_insert_enforce_user
BEFORE INSERT ON pressage
FOR EACH ROW
EXECUTE FUNCTION enforce_pressage_user_id();

-- ============================================================
-- create_pressage() — fonction transactionnelle unique qui crée le
-- pressage ET le mouvement de stock PROD associé.
--
-- SECURITY INVOKER (pas DEFINER) : la fonction s'exécute avec les
-- droits de l'utilisateur connecté, donc les policies RLS existantes
-- sur depot/pressage/cuve/mvt_stock_huile s'appliquent normalement —
-- rien à revérifier manuellement pour l'isolation multi-tenant. Un
-- depot_id ou cuve_id d'une autre huilerie donne simplement "introuvable"
-- (RLS le filtre avant même que la fonction ne le voie), pas de fuite
-- d'information entre huileries.
--
-- Transaction unique : un appel de fonction PL/pgSQL s'exécute dans la
-- transaction de son appelant. Si l'INSERT dans mvt_stock_huile échoue
-- (le trigger update_cuve_stock refuse un dépassement de capacité),
-- l'exception remonte et annule aussi l'INSERT du pressage déjà fait
-- plus haut dans la même fonction — jamais de pressage enregistré sans
-- mouvement de stock correspondant, ni l'inverse.
--
-- rendement_final et montant_service_total sont calculés ICI, jamais
-- acceptés en paramètre : un appel API direct ne peut pas fabriquer un
-- rendement ou un montant arbitraire, seule la quantité d'huile saisie
-- est un input.
-- ============================================================
CREATE OR REPLACE FUNCTION create_pressage(
  p_depot_id UUID,
  p_cuve_id UUID,
  p_quantite_huile_kg FLOAT,
  p_type_huile type_huile
)
RETURNS pressage AS $$
DECLARE
  v_depot depot%ROWTYPE;
  v_prix_kilo FLOAT;
  v_rendement FLOAT;
  v_montant FLOAT;
  v_pressage pressage%ROWTYPE;
BEGIN
  IF p_quantite_huile_kg IS NULL OR p_quantite_huile_kg <= 0 THEN
    RAISE EXCEPTION 'La quantité d''huile doit être supérieure à 0';
  END IF;

  -- RLS filtre déjà par huilerie : un depot_id d'une autre huilerie (ou
  -- inexistant) ne renvoie simplement aucune ligne.
  SELECT * INTO v_depot FROM depot WHERE id = p_depot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépôt introuvable';
  END IF;

  IF EXISTS (SELECT 1 FROM pressage WHERE depot_id = p_depot_id) THEN
    RAISE EXCEPTION 'Ce dépôt a déjà été pressé';
  END IF;

  IF p_quantite_huile_kg > v_depot.poids_olives_kg THEN
    RAISE EXCEPTION 'La quantité d''huile (% kg) ne peut pas dépasser le poids d''olives du dépôt (% kg)',
      round(p_quantite_huile_kg::numeric, 2), round(v_depot.poids_olives_kg::numeric, 2);
  END IF;

  v_rendement := round((p_quantite_huile_kg / v_depot.poids_olives_kg * 100)::numeric, 2);

  IF v_depot.is_achat_olives THEN
    -- L'huilerie presse ses propres olives (déjà achetées) : elle ne se
    -- facture pas elle-même de service.
    v_montant := 0;
  ELSE
    SELECT config_prix_kilo_service INTO v_prix_kilo
    FROM saison WHERE id = v_depot.saison_id;
    v_montant := round((v_depot.poids_olives_kg * COALESCE(v_prix_kilo, 0))::numeric, 2);
  END IF;

  INSERT INTO pressage (
    saison_id, depot_id, date_fin, quantite_huile_kg,
    rendement_final, montant_service_total, user_id, type_huile
  ) VALUES (
    v_depot.saison_id, p_depot_id, NOW(), p_quantite_huile_kg,
    v_rendement, v_montant, auth.uid(), p_type_huile
  )
  RETURNING * INTO v_pressage;

  -- Déclenche update_cuve_stock : si la cuve n'a pas assez de place,
  -- l'exception levée ici annule aussi l'INSERT du pressage ci-dessus
  -- (même transaction).
  INSERT INTO mvt_stock_huile (cuve_id, saison_id, type, quantite_delta, pressage_id)
  VALUES (p_cuve_id, v_depot.saison_id, 'PROD', p_quantite_huile_kg, v_pressage.id);

  RETURN v_pressage;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
