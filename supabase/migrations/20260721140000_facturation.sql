-- ============================================================
-- MODULE FACTURATION — factures générées depuis un pressage, règlements
-- (y compris fractionnés) exploitant le trigger update_facture_statut
-- déjà existant (migration 20260613134128_triggers_and_rls.sql).
-- ============================================================

-- Compteur de factures par saison, séparé de next_ticket_seq (dépôts) :
-- même principe concurrence-safe que set_depot_ticket_number (migration
-- 20260720110000_depot_ticket_and_security.sql).
ALTER TABLE saison ADD COLUMN next_facture_seq INTEGER NOT NULL DEFAULT 1;

-- Anti double-facturation : filet de sécurité final, en plus du filtrage
-- de getPressagesNonFactures() côté lecture (qui exclut déjà les
-- pressages facturés).
ALTER TABLE facture_service ADD CONSTRAINT facture_service_pressage_id_unique
  UNIQUE (pressage_id);

-- Filet de sécurité si une future migration/bug produisait un doublon de
-- numéro dans la même saison (même principe que depot_numero_ticket_unique).
ALTER TABLE facture_service ADD CONSTRAINT facture_service_numero_unique
  UNIQUE (saison_id, numero_facture);

-- Défense en profondeur, même principe que pressage_quantite_huile_positive.
ALTER TABLE reglement ADD CONSTRAINT reglement_montant_positive CHECK (montant > 0);

-- ============================================================
-- set_facture_derived_fields() — BEFORE INSERT sur facture_service.
--
-- Le client n'envoie jamais que { pressage_id }. saison_id, client_id et
-- montant_ttc sont dérivés ICI depuis le pressage lui-même (jamais
-- acceptés en paramètre) : même principe que create_pressage() qui ne
-- fait jamais confiance à un rendement/montant fourni par le client.
-- numero_facture et url_pdf sont également écrasés inconditionnellement
-- (même principe que set_depot_ticket_number pour numero_ticket).
--
-- Pas de SECURITY DEFINER : le SELECT sur pressage hérite du RLS de la
-- session en cours (pressage_isolation) — un pressage_id d'une autre
-- huilerie donne NOT FOUND, pas de fuite d'information entre huileries.
-- ============================================================
CREATE OR REPLACE FUNCTION set_facture_derived_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_saison_id UUID;
  v_client_id UUID;
  v_montant FLOAT;
  v_seq INTEGER;
BEGIN
  SELECT p.saison_id, d.client_id, p.montant_service_total
  INTO v_saison_id, v_client_id, v_montant
  FROM pressage p
  JOIN depot d ON d.id = p.depot_id
  WHERE p.id = NEW.pressage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pressage introuvable';
  END IF;

  IF v_montant IS NULL THEN
    RAISE EXCEPTION 'Ce pressage n''a pas de montant de service calculé';
  END IF;

  NEW.saison_id := v_saison_id;
  NEW.client_id := v_client_id;
  NEW.montant_ttc := v_montant;
  NEW.url_pdf := NULL;

  UPDATE saison
  SET next_facture_seq = next_facture_seq + 1
  WHERE id = v_saison_id
  RETURNING next_facture_seq - 1 INTO v_seq;

  NEW.numero_facture := 'FAC-' || EXTRACT(YEAR FROM NOW())::INTEGER || '-' || LPAD(v_seq::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_facture_insert_set_derived_fields
BEFORE INSERT ON facture_service
FOR EACH ROW
EXECUTE FUNCTION set_facture_derived_fields();

-- ============================================================
-- enforce_reglement_not_exceeding_solde() — BEFORE INSERT sur reglement.
--
-- Additionne les règlements déjà enregistrés pour la facture + le
-- nouveau montant, comparé à montant_ttc. Arrondi à 2 décimales
-- (round(...::numeric,2)) pour éviter un faux refus dû à l'imprécision
-- FLOAT (même technique que update_cuve_stock, migration
-- 20260721090000_cuve_stock_safety.sql).
--
-- S'exécute avant le trigger update_facture_statut existant (BEFORE vs
-- AFTER : ordre garanti par Postgres, pas par le nom des triggers) —
-- un règlement qui dépasserait le reste dû est donc rejeté avant même
-- que le statut n'ait la moindre chance d'être recalculé.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_reglement_not_exceeding_solde()
RETURNS TRIGGER AS $$
DECLARE
  v_montant_ttc FLOAT;
  v_deja_regle FLOAT;
BEGIN
  SELECT montant_ttc INTO v_montant_ttc FROM facture_service WHERE id = NEW.facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_deja_regle
  FROM reglement WHERE facture_id = NEW.facture_id;

  IF round((v_deja_regle + NEW.montant)::numeric, 2) > round(v_montant_ttc::numeric, 2) THEN
    RAISE EXCEPTION 'Règlement refusé : le total réglé (% DT) dépasserait le montant de la facture (% DT)',
      round((v_deja_regle + NEW.montant)::numeric, 2), round(v_montant_ttc::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reglement_insert_enforce_solde
BEFORE INSERT ON reglement
FOR EACH ROW
EXECUTE FUNCTION enforce_reglement_not_exceeding_solde();
