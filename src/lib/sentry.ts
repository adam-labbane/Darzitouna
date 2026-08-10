import * as Sentry from "@sentry/react";
import { resolveEnvironment, shouldReportEvent } from "./sentryFilters";
import type { ErrorSignature } from "./sentryFilters";

/** Injecté au build par `define` (vite.config.ts), depuis package.json. */
declare const __APP_VERSION__: string;

/**
 * Extrait nom et message quelle que soit la forme de l'événement : Sentry
 * fournit l'exception d'origine quand elle existe, sinon seule la valeur
 * sérialisée de l'événement est disponible.
 */
function signatureOf(event: Sentry.ErrorEvent, hint: Sentry.EventHint): ErrorSignature {
  const original = hint.originalException;
  if (original instanceof Error) {
    return { name: original.name, message: original.message };
  }
  const reported = event.exception?.values?.[0];
  return { name: reported?.type, message: reported?.value };
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Deux conditions cumulatives : sans DSN il n'y a rien à faire, et en
  // développement le bruit du HMR et des erreurs de travail en cours
  // polluerait les alertes réelles. `PROD` est faux sous `npm run dev` et
  // vrai sur un build (donc aussi sous `npm run preview`, ce qui permet de
  // vérifier l'intégration en local avant de déployer).
  if (!dsn || !import.meta.env.PROD) return;

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT || resolveEnvironment(window.location.hostname),
    release: __APP_VERSION__,
    // On supervise les ERREURS, pas la performance : aucune transaction
    // envoyée, le quota reste entièrement disponible pour les incidents.
    tracesSampleRate: 0,
    beforeSend(event, hint) {
      const online = navigator.onLine;
      return shouldReportEvent({ isOnline: online, error: signatureOf(event, hint) })
        ? event
        : null;
    },
  });
}
