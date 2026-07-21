INSERT INTO huilerie (id, nom_societe, matricule_fiscal, code_activation)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Huilerie Mohamed',
  'TN-123456',
  'ZTN-4F8K-9XQ2-M7P3'
);

INSERT INTO saison (id, huilerie_id, nom, date_debut, date_fin, is_active, config_prix_kilo_service)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '2025-2026',
  '2025-09-01',
  '2026-01-31',
  true,
  0.25
);

INSERT INTO utilisateur (id, huilerie_id, nom_complet, role, login_code, hash_pin)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Mohamed Ben Ali',
    'GERANT',
    'mohamed',
    crypt('placeholder', gen_salt('bf'))
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Ahmed Trabelsi',
    'OPERATEUR',
    'ahmed',
    crypt('placeholder', gen_salt('bf'))
  );

SELECT set_user_pin('33333333-3333-3333-3333-333333333333', '1234');
SELECT set_user_pin('44444444-4444-4444-4444-444444444444', '0000');

INSERT INTO huilerie (id, nom_societe, matricule_fiscal, code_activation)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'Huilerie Zitouna Nord',
  'TN-654321',
  'ZTN-9K2P-3F8X-Q7M4'
);

INSERT INTO saison (id, huilerie_id, nom, date_debut, date_fin, is_active, config_prix_kilo_service)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  '2025-2026',
  '2025-09-01',
  '2026-01-31',
  true,
  0.25
);

INSERT INTO utilisateur (id, huilerie_id, nom_complet, role, login_code, hash_pin)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  'Fatma Gharbi',
  'GERANT',
  'fatma',
  crypt('placeholder', gen_salt('bf'))
);

SELECT set_user_pin('77777777-7777-7777-7777-777777777777', '5678');

INSERT INTO client (id, huilerie_id, nom_complet, telephone)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  'Client Huilerie A',
  '20000001'
);

INSERT INTO client (id, huilerie_id, nom_complet, telephone)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '55555555-5555-5555-5555-555555555555',
  'Client Huilerie B',
  '20000002'
);

INSERT INTO cuve (id, huilerie_id, nom_reference, emplacement, type_huile, capacite_max, niveau_actuel)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    '11111111-1111-1111-1111-111111111111',
    'Cuve 1',
    'Hangar A',
    'EXTRA',
    2000,
    1500
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    '11111111-1111-1111-1111-111111111111',
    'Cuve 2',
    'Hangar A',
    'VIERGE',
    2000,
    800
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    '11111111-1111-1111-1111-111111111111',
    'Cuve 3',
    'Hangar B',
    'VIERGE',
    1500,
    150
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc4',
    '11111111-1111-1111-1111-111111111111',
    'Cuve 4',
    'Hangar B',
    'LAMPANTE',
    1000,
    0
  );

INSERT INTO cuve (id, huilerie_id, nom_reference, emplacement, type_huile, capacite_max, niveau_actuel)
VALUES (
  'dddddddd-dddd-dddd-dddd-ddddddddddd1',
  '55555555-5555-5555-5555-555555555555',
  'Cuve B1',
  'Hangar principal',
  'VIERGE',
  2000,
  1000
);
