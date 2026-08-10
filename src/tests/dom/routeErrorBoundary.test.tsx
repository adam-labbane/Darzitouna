import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router";
import * as Sentry from "@sentry/react";
import RouteErrorBoundary from "../../components/RouteErrorBoundary";

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

/** Composant de test qui échoue au rendu, comme le ferait une vraie page. */
function PageQuiEchoue(): never {
  throw new Error("Panne simulée");
}

/**
 * Même forme que le routeur de App.tsx : une route racine sans chemin qui
 * porte l'errorElement, et les écrans en enfants.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: "/", element: <p>Accueil</p> },
          { path: "/casse", element: <PageQuiEchoue /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  // React Router journalise les erreurs interceptées : bruit attendu ici.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(Sentry.captureException).mockClear();
});

describe("RouteErrorBoundary", () => {
  it("laisse s'afficher une route saine", () => {
    renderAt("/");

    expect(screen.getByText("Accueil")).toBeDefined();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("remplace la page en erreur par l'écran de repli et alerte Sentry", async () => {
    renderAt("/casse");

    expect(await screen.findByText(/Une erreur est survenue/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Recharger l'application/i })).toBeDefined();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    const [captured] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((captured as Error).message).toBe("Panne simulée");
  });

  it("n'alerte pas Sentry sur une URL inconnue", async () => {
    renderAt("/introuvable");

    // L'utilisateur voit un écran propre, mais une faute de frappe n'est pas
    // un incident : elle ne doit pas consommer le quota ni déclencher d'alerte.
    expect(await screen.findByText(/Une erreur est survenue/i)).toBeDefined();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
