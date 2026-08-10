import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import * as Sentry from "@sentry/react";
import ErrorFallback from "./ErrorFallback";

/**
 * Frontière d'erreur des routes.
 *
 * `createBrowserRouter` intercepte lui-même les erreurs levées pendant le
 * rendu d'une route : elles ne remontent JAMAIS jusqu'au Sentry.ErrorBoundary
 * qui enveloppe <RouterProvider>. Sans cet errorElement, React Router affiche
 * sa page technique en anglais et rien ne part vers Sentry.
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    // Une URL inconnue lève une réponse de route (404), pas une exception :
    // c'est une faute de frappe d'utilisateur, pas un bug à remonter.
    if (isRouteErrorResponse(error)) return;
    Sentry.captureException(error);
  }, [error]);

  return <ErrorFallback />;
}
