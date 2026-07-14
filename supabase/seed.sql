-- ============================================================
-- DONNÉES DE TEST — Dar Zitouna
-- Rechargées à chaque `npx supabase db reset`
-- ============================================================

-- 1. Une huilerie de test avec son code d'activation
INSERT INTO huilerie (id, nom_societe, matricule_fiscal, code_activation)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Huilerie Mohamed',
  'TN-123456',
  'ZTN-4F8K-9XQ2-M7P3'
);

-- 2. Une saison active pour cette huilerie
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

-- 3. Deux utilisateurs : un gérant et un opérateur
-- Le PIN est hashé avec crypt() — PIN gérant = 1234, PIN opérateur = 0000
INSERT INTO utilisateur (id, huilerie_id, nom_complet, role, login_code, hash_pin)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Mohamed Ben Ali',
    'GERANT',
    'mohamed',
    crypt('1234', gen_salt('bf'))
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Ahmed Trabelsi',
    'OPERATEUR',
    'ahmed',
    crypt('0000', gen_salt('bf'))
  );