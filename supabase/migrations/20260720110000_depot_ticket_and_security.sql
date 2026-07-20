-- ============================================================
-- NUMÉROTATION DE TICKET CONCURRENCE-SAFE + SÉCURISATION DES DÉPÔTS
-- ============================================================

-- Compteur de tickets par saison. Un simple entier, incrémenté de façon
-- atomique par le trigger ci-dessous — jamais lu/incrémenté côté client.
ALTER TABLE saison ADD COLUMN next_ticket_seq INTEGER NOT NULL DEFAULT 1;

-- Filet de sécurité : si la génération produisait un jour un doublon
-- (bug futur, migration de données...), l'INSERT échoue bruyamment au
-- lieu de créer silencieusement deux tickets identiques.
ALTER TABLE depot ADD CONSTRAINT depot_numero_ticket_unique UNIQUE (saison_id, numero_ticket);

-- ============================================================
-- Génération du numéro de ticket — TK-{année}-{séquence sur 4 chiffres}
--
-- Pourquoi un trigger BEFORE INSERT plutôt qu'un COUNT(*) côté client :
-- un COUNT(*) est une lecture, suivie séparément d'une écriture (INSERT).
-- Entre les deux, un autre opérateur peut lire le même COUNT et calculer
-- lui aussi le même "prochain numéro" — deux dépôts concurrents obtiennent
-- alors le même numero_ticket (race condition classique "lire-puis-écrire"
-- non atomique). Ici, l'UPDATE ... RETURNING sur saison est atomique et
-- verrouille la ligne pour la durée de la transaction : si deux dépôts
-- sont créés en même temps pour la même saison, PostgreSQL sérialise
-- automatiquement les deux UPDATE (le second attend que le premier
-- commit), garantissant deux séquences distinctes.
--
-- Pourquoi un trigger et pas une fonction RPC appelée avant l'INSERT :
-- tout se passe dans LA MÊME transaction que l'insert du dépôt. Si
-- l'insert échoue pour une autre raison (contrainte violée, réseau...),
-- l'incrément du compteur est annulé avec le reste — pas de numéro
-- "brûlé" jamais utilisé. Et le frontend n'a jamais besoin d'envoyer
-- numero_ticket : encore un champ que le client ne peut pas falsifier.
-- ============================================================
CREATE OR REPLACE FUNCTION set_depot_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  UPDATE saison
  SET next_ticket_seq = next_ticket_seq + 1
  WHERE id = NEW.saison_id
  RETURNING next_ticket_seq - 1 INTO v_seq;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saison % introuvable pour générer le numéro de ticket', NEW.saison_id;
  END IF;

  NEW.numero_ticket := 'TK-' || EXTRACT(YEAR FROM NOW())::INTEGER || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_depot_insert_set_ticket_number
BEFORE INSERT ON depot
FOR EACH ROW
EXECUTE FUNCTION set_depot_ticket_number();

-- ============================================================
-- user_id non falsifiable.
--
-- La policy RLS depot_isolation ne vérifie que la huilerie (via
-- saison_id) : un opérateur pourrait, en appelant l'API directement,
-- créer un dépôt avec le user_id d'un collègue de la même huilerie.
-- auth.uid() lit l'id du JWT de la session en cours — comme
-- utilisateur.id = auth.users.id (voir migration
-- 20260714140000_auth_session_bridge.sql), c'est directement comparable
-- à user_id sans jointure ni claim supplémentaire.
--
-- saison_id n'a pas besoin d'un trigger équivalent : la policy RLS
-- existante (WITH CHECK hérité du USING) bloque déjà l'insert si
-- saison_id n'appartient pas à la huilerie de l'utilisateur connecté.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_depot_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id doit correspondre à l''utilisateur connecté';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_depot_insert_enforce_user
BEFORE INSERT ON depot
FOR EACH ROW
EXECUTE FUNCTION enforce_depot_user_id();
