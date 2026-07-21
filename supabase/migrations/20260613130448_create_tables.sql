CREATE TABLE huilerie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_societe TEXT NOT NULL ,
  matricule_fiscal TEXT ,
  logo_url TEXT ,
  created_at TIMESTAMPTZ DEFAULT  NOW()
);

CREATE TABLE saison (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     huilerie_id UUID NOT NULL REFERENCES huilerie(id),
     nom TEXT NOT NULL,
     date_debut DATE,
     date_fin DATE,
     is_active BOOLEAN DEFAULT True,
     config_prix_kilo_service FLOAT
);

CREATE TYPE user_role AS ENUM ('GERANT', 'OPERATEUR');

CREATE TABLE utilisateur (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     huilerie_id UUID NOT NULL REFERENCES huilerie(id),
     nom_complet TEXT NOT NULL,
     role user_role NOT NULL DEFAULT 'GERANT',
     login_code TEXT NOT NULL,
     hash_pin TEXT NOT NULL  
);

CREATE TYPE type_acheteur AS ENUM ('PRO', 'PARTICULIER');
CREATE TYPE type_huile AS ENUM ('EXTRA', 'VIERGE', 'LAMPANTE');

CREATE TABLE client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huilerie_id UUID NOT NULL REFERENCES huilerie(id),
  nom_complet TEXT NOT NULL,
  telephone TEXT,
  solde_compte FLOAT DEFAULT 0
);

CREATE TABLE fournisseur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huilerie_id UUID NOT NULL REFERENCES huilerie(id),
  nom_societe TEXT NOT NULL,
  telephone TEXT
);

CREATE TABLE acheteur_grignon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huilerie_id UUID NOT NULL REFERENCES huilerie(id),
  nom_societe TEXT NOT NULL,
  type type_acheteur NOT NULL DEFAULT 'PRO'
);

CREATE TABLE cuve (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huilerie_id UUID NOT NULL REFERENCES huilerie(id),
  nom_reference TEXT NOT NULL,
  emplacement TEXT,
  type_huile type_huile NOT NULL DEFAULT 'VIERGE',
  capacite_max FLOAT NOT NULL,
  niveau_actuel FLOAT DEFAULT 0
);

CREATE TYPE statut_paiement AS ENUM ('NON_PAYE', 'PARTIEL', 'PAYE');
CREATE TYPE statut_paiement_simple AS ENUM ('NON_PAYE', 'PAYE');
CREATE TYPE type_mouvement AS ENUM ('PROD', 'VENTE', 'ACHAT_FRNS', 'CORRECTION');
CREATE TYPE mode_reglement AS ENUM ('ESPECES', 'HUILE', 'VIREMENT');

CREATE TABLE depot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID NOT NULL REFERENCES saison(id),
  client_id UUID NOT NULL REFERENCES client(id),
  user_id UUID NOT NULL REFERENCES utilisateur(id),
  numero_ticket TEXT NOT NULL,
  date_depot TIMESTAMPTZ DEFAULT NOW(),
  poids_olives_kg FLOAT NOT NULL,
  ref_bac TEXT,
  is_achat_olives BOOLEAN DEFAULT false,
  prix_achat_unitaire FLOAT,
  statut_paiement_achat statut_paiement DEFAULT 'NON_PAYE',
  montant_paye_achat FLOAT DEFAULT 0
);

CREATE TABLE pressage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID NOT NULL REFERENCES saison(id),
  depot_id UUID NOT NULL REFERENCES depot(id),
  date_fin TIMESTAMPTZ,
  quantite_huile_kg FLOAT,
  rendement_final FLOAT,
  montant_service_total FLOAT
);

CREATE TABLE facture_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID NOT NULL REFERENCES saison(id),
  client_id UUID NOT NULL REFERENCES client(id),
  pressage_id UUID NOT NULL REFERENCES pressage(id),
  numero_facture TEXT NOT NULL,
  url_pdf TEXT,
  montant_ttc FLOAT NOT NULL,
  statut_paiement statut_paiement DEFAULT 'NON_PAYE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reglement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES facture_service(id),
  date_reglement TIMESTAMPTZ DEFAULT NOW(),
  montant FLOAT NOT NULL,
  mode mode_reglement NOT NULL DEFAULT 'ESPECES',
  note TEXT
);

CREATE TABLE vente_grignon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID NOT NULL REFERENCES saison(id),
  acheteur_id UUID NOT NULL REFERENCES acheteur_grignon(id),
  quantite_kg FLOAT NOT NULL,
  prix_unitaire FLOAT NOT NULL,
  montant_total FLOAT NOT NULL,
  statut_paiement statut_paiement_simple DEFAULT 'NON_PAYE'
);

CREATE TABLE mvt_stock_huile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuve_id UUID NOT NULL REFERENCES cuve(id),
  saison_id UUID NOT NULL REFERENCES saison(id),
  type type_mouvement NOT NULL,
  quantite_delta FLOAT NOT NULL,
  pressage_id UUID REFERENCES pressage(id),
  fournisseur_id UUID REFERENCES fournisseur(id),
  client_id UUID REFERENCES client(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
