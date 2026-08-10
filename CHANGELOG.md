# Journal des versions

Toutes les évolutions notables de Dar Zitouna sont consignées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
versionnage respecte [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

**Convention** — une entrée par version effectivement **déployée en production**,
datée du jour de sa mise en ligne. Une version mineure ajoute une fonctionnalité
sans rupture, une version corrective ne contient que des correctifs. Chaque
version correspond à une étiquette Git annotée (`vX.Y.Z`) et à une release GitHub.

**Traçabilité des correctifs** — toute entrée « Corrigé » référence sa fiche
d'anomalie (`A-nn`) et le changement qui l'a résolue. Les correctifs antérieurs à
la version 1.3.0 sont dépourvus de fiche : le processus de consignation n'existait
pas encore, et aucune fiche n'a été créée rétrospectivement.

**Processus de livraison** — à compter de la version 1.3.0, toute modification
transite par une Pull Request ; chaque déploiement notable donne lieu à une montée
de version SemVer, son entrée dans ce journal, son étiquette Git annotée et sa
release GitHub.

---

## [1.3.0] — 2026-08-10

Version de maintenance : supervision, fiabilisation de la chaîne de livraison et
outillage de suivi des anomalies. Aucun changement fonctionnel pour l'utilisateur.

### Ajouté

- **Sonde de supervision `/sonde-api`** — Cloudflare Pages Function qui appelle la
  RPC `get_ticket_public` côté serveur et reflète l'état réel de l'API dans son
  propre code HTTP (200 si l'API répond, 503 sinon), avec temps de réponse et
  raison de panne détaillée. Exploitable par un moniteur d'uptime externe.
- **Supervision des erreurs frontend (Sentry)** — capture des erreurs JavaScript
  réelles survenues sur les appareils des utilisateurs. Un filtre écarte les échecs
  réseau attendus lorsque l'appareil est hors ligne, comportement normal de
  l'application en zone blanche, tout en laissant remonter les mêmes erreurs
  lorsque le réseau est présent. `release` alignée sur la version du `package.json`.
- **Écran de repli en cas d'erreur** — un message en français avec bouton de
  rechargement remplace la page blanche, et l'erreur est transmise à Sentry.
- **Smoke test de démarrage (jsdom)** — monte l'application réelle dans un DOM.
  Il couvre l'angle mort qui a laissé passer l'anomalie A-03 : `tsc`, ESLint et les
  tests de logique métier réussissent tous sans jamais monter un composant.
- **Fiche d'anomalie GitHub** — formulaire structuré en français (gravité,
  environnement, version, appareil, rôle, étapes de reproduction, résultats attendu
  et obtenu, source de détection). Les issues vierges sont désactivées.
- **Journal des versions** — ce fichier, accompagné des étiquettes Git annotées
  `v1.0.0` à `v1.2.1` posées rétrospectivement sur les jalons réels.

### Modifié

- **Regroupement des mises à jour Dependabot** — `react` et `react-dom` sont
  désormais montés de version ensemble, les dépendances de développement et de
  production sont regroupées, et les versions majeures du socle (React, Vite,
  TypeScript) sont exclues des montées automatiques.
- **Mises à jour de dépendances** — react-router-dom 7.18.2, tailwindcss 4.3.3,
  eslint 10.8.0, @vitejs/plugin-react 6.0.5, @types/node 26.1.2, actions/checkout 7,
  actions/setup-node 7.

### Corrigé

- **Page blanche en production, versions de React désalignées** — fiche **A-03**,
  commit [`4f8ea0c`](https://github.com/adam-labbane/Darzitouna/commit/4f8ea0c).
  Une mise à jour automatique avait monté `react` en 19.2.8 sans toucher à
  `react-dom`, resté en 19.2.7 ; React refuse de démarrer sur deux versions
  différentes (erreur #527) et l'application ne s'affichait plus, alors que
  l'intégration continue était au vert. Séquence de traitement : détection en
  production, puis rétablissement immédiat du service par retour arrière Cloudflare
  Pages vers le build antérieur — opération de plateforme, sans trace dans Git —,
  puis correction de fond par alignement de `react-dom` en 19.2.8, enfin prévention
  par le regroupement Dependabot de `react` et `react-dom` et par le smoke test
  jsdom, qui échoue désormais sur ce désalignement avant toute fusion.
- **Sonde `/sonde-api` inaccessible depuis un navigateur** — commit
  [`803b681`](https://github.com/adam-labbane/Darzitouna/commit/803b681). Le service
  worker servait `index.html` pour toute navigation, empêchant la requête
  d'atteindre la Function ; le chemin est désormais exclu via
  `navigateFallbackDenylist`.
- **Erreurs de page non remontées à la supervision** — commit
  [`2634842`](https://github.com/adam-labbane/Darzitouna/commit/2634842). Le routeur
  de données intercepte lui-même les erreurs de rendu, qui n'atteignaient donc
  jamais la frontière d'erreur ni Sentry ; ajout d'un `errorElement` sur la route
  racine, couvrant toutes les pages.

### Sécurité

- La clé anon Supabase utilisée par la sonde est désormais transmise en en-tête
  depuis le serveur, à partir d'une variable d'environnement Cloudflare, au lieu de
  figurer dans une URL de redirection publique. Elle disparaît ainsi des journaux
  Cloudflare, des journaux du moniteur et de l'en-tête `Referer`.

---

## [1.2.1] — 2026-07-22

### Corrigé

- **Actions d'écriture proposées sur l'écran Cuves en mode consultation** —
  [PR #3](https://github.com/adam-labbane/Darzitouna/pull/3), merge
  [`84e144c`](https://github.com/adam-labbane/Darzitouna/commit/84e144c). Les boutons
  de modification, de correction de niveau et d'archivage restaient visibles alors
  que l'écriture était indisponible, dans les deux situations qui font basculer
  l'application en consultation : saison archivée et mode hors ligne. Ils sont
  désormais masqués, en cohérence avec le blocage déjà appliqué côté base. Aucune
  fiche d'anomalie : le processus de consignation n'existait pas encore.

---

## [1.2.0] — 2026-07-22

### Ajouté

- **Application installable (PWA)** — manifeste, icônes, service worker Workbox et
  précache de l'application.
- **Consultation hors ligne** — mise en cache des données consultées, bandeau d'état
  réseau annoncé aux lecteurs d'écran, préchauffage du cache à la connexion.

---

## [1.1.0] — 2026-07-22

### Ajouté

- **Portail agriculteur public** — page `/t/<token>` accessible sans
  authentification : l'agriculteur consulte l'état de son dépôt (en attente ou
  pressé, montants, reste à payer) à tout moment, sans rien installer.
- **QR code sur le ticket de dépôt** pointant vers ce portail.
- **Fonction RPC `get_ticket_public`** et token public non énumérable généré à
  l'insertion de chaque dépôt, sans lien avec l'identifiant interne.

### Modifié

- Refonte de l'habillage visuel et améliorations d'accessibilité.

---

## [1.0.0] — 2026-07-21

Première mise en production.

### Ajouté

- **Authentification par PIN** — sélection du profil puis code à quatre chiffres,
  avec protection contre les tentatives répétées.
- **Clients** — création, modification, recherche et archivage réversible ; fiche
  agrégée par client (historique des dépôts, pressages, factures et règlements,
  reste dû).
- **Dépôts** — enregistrement d'un dépôt d'olives par assistant de saisie (pesée,
  achat direct ou prestation de service) et ticket imprimable.
- **Pressage** — clôture d'un dépôt : quantité d'huile obtenue, rendement calculé,
  affectation à une cuve.
- **Cuves** — vue d'ensemble par niveau de remplissage, correction manuelle tracée,
  archivage.
- **Facturation** — génération de facture depuis un pressage, règlements partiels ou
  multiples, statut de paiement systématiquement recalculé.
- **Configuration** — gestion des saisons (ouverture, clôture avec bilan,
  consultation des archives en lecture seule) et du personnel (rôles, PIN).
- **Rôles** — Gérant (accès complet) et Opérateur (saisie quotidienne, actions
  sensibles masquées et bloquées côté base).
- **Intégration continue** — lint, compilation TypeScript et tests unitaires à
  chaque poussée et à chaque demande de fusion.

### Sécurité

- Isolation multi-tenant par politiques RLS PostgreSQL, filtrées sur `huilerie_id`.
- Claims JWT personnalisés injectés par un hook Supabase, seule source de vérité des
  politiques RLS.
- PIN haché en bcrypt côté base, jamais stocké ni transmis en clair.
- Fonctions RPC `SECURITY DEFINER` whitelistées comme seuls points d'entrée avant
  authentification ; le rôle `anon` n'a aucun accès direct aux tables.

---

[1.3.0]: https://github.com/adam-labbane/Darzitouna/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/adam-labbane/Darzitouna/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/adam-labbane/Darzitouna/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/adam-labbane/Darzitouna/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adam-labbane/Darzitouna/releases/tag/v1.0.0
