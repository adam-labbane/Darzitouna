/**
 * Logique de filtrage des événements Sentry — pure, testable sans SDK.
 *
 * Enjeu métier : l'application est volontairement utilisable hors ligne
 * (PWA, tablette en zone blanche au milieu des oliviers). Quand le réseau
 * coupe, les appels Supabase échouent — c'est le fonctionnement NORMAL,
 * déjà traité par l'UI (bandeau hors ligne + données en cache). Remonter
 * ces échecs à Sentry noierait les vraies erreurs sous de fausses alertes.
 *
 * La règle est donc conditionnelle, jamais absolue : une erreur réseau est
 * écartée UNIQUEMENT hors ligne. La même erreur avec du réseau signale un
 * vrai incident (Supabase indisponible, CORS, DNS) et doit remonter.
 */

/**
 * Messages d'échec de `fetch` selon les navigateurs. Le libellé n'est pas
 * normalisé : chaque moteur a le sien, et les tablettes du terrain ne sont
 * pas toutes sur le même.
 */
const NETWORK_ERROR_PATTERNS = [
  "failed to fetch", // Chrome, Edge
  "networkerror when attempting to fetch resource", // Firefox
  "load failed", // Safari
  "the network connection was lost", // Safari / iOS
  "network request failed", // WebView Android
  "fetch failed", // undici
];

/**
 * Noms d'erreurs que supabase-js émet sur coupure réseau, en plus du
 * `TypeError` standard remonté par `fetch`.
 */
const NETWORK_ERROR_NAMES = ["typeerror", "authretryablefetcherror", "fetcherror"];

export interface ErrorSignature {
  name?: string | null;
  message?: string | null;
}

/** Vrai si l'erreur ressemble à un échec de transport, pas à un bug applicatif. */
export function isNetworkError({ name, message }: ErrorSignature): boolean {
  const normalizedMessage = (message ?? "").toLowerCase();
  const matchesMessage = NETWORK_ERROR_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern),
  );
  if (!matchesMessage) return false;

  // Le message seul suffit : un nom absent (erreur sérialisée, rejet de
  // promesse non typé) ne doit pas empêcher la reconnaissance.
  const normalizedName = (name ?? "").toLowerCase();
  return normalizedName === "" || NETWORK_ERROR_NAMES.includes(normalizedName);
}

export interface ReportDecisionInput {
  isOnline: boolean;
  error: ErrorSignature;
}

/**
 * Décide si un événement part vers Sentry.
 * Seul cas écarté : erreur réseau ET appareil hors ligne.
 */
export function shouldReportEvent({ isOnline, error }: ReportDecisionInput): boolean {
  if (isOnline) return true;
  return !isNetworkError(error);
}

/**
 * Environnement Sentry déduit du hostname, pour séparer les alertes de
 * production du bruit des previews Cloudflare.
 */
export function resolveEnvironment(hostname: string): "production" | "preview" | "local" {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]") {
    return "local";
  }
  if (normalized.endsWith(".pages.dev")) return "preview";
  return "production";
}
