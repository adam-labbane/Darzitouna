import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import ClientsList from "../../pages/ClientsList";
import { createClient, getClients } from "../../lib/clients";

/**
 * Non-régression de la fiche #29 : après une création réussie, la liste
 * affichée doit refléter le nouveau client sans rechargement manuel.
 *
 * Le défaut d'origine venait de la stratégie de cache du service worker, pas
 * de ce composant. Ce test verrouille le contrat côté application — la liste
 * est bien resynchronisée après mutation — pour qu'une refonte du flux ne
 * réintroduise pas le symptôme par un autre chemin.
 */

vi.mock("../../lib/supabase", () => ({ supabase: {} }));

vi.mock("../../lib/session", () => ({
  getHuilerieId: () => "huilerie-test",
  getCurrentUser: () => ({ id: "u1", nom_complet: "Test", role: "GERANT" }),
}));

vi.mock("../../lib/clientProfile", () => ({
  getAllClientsFinancials: () => Promise.resolve({}),
}));

vi.mock("../../lib/clients", () => ({
  getClients: vi.fn(),
  createClient: vi.fn(),
  archiveClient: vi.fn(),
}));

const NOUVEAU_CLIENT = {
  id: "c-1",
  nom_complet: "Salah Ben Youssef",
  telephone: "20123456",
  solde_compte: 0,
};

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue(NOUVEAU_CLIENT as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderListe() {
  return render(
    <MemoryRouter>
      <ClientsList />
    </MemoryRouter>,
  );
}

describe("rafraîchissement de la liste des clients", () => {
  it("affiche le client créé sans rechargement de la page", async () => {
    // La liste est vide au montage, puis contient le client après création :
    // c'est exactement la séquence que le cache périmé faisait échouer.
    vi.mocked(getClients)
      .mockResolvedValueOnce([])
      .mockResolvedValue([NOUVEAU_CLIENT as never]);

    const user = userEvent.setup();
    renderListe();

    expect(await screen.findByText("Aucun client")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Nouveau client" }));
    await user.type(screen.getByLabelText(/Nom complet/i), NOUVEAU_CLIENT.nom_complet);
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(await screen.findByText(NOUVEAU_CLIENT.nom_complet)).toBeDefined();
  });

  it("relit la liste après la création, sans se contenter de fermer la modale", async () => {
    vi.mocked(getClients).mockResolvedValue([]);

    const user = userEvent.setup();
    renderListe();
    await screen.findByText("Aucun client");

    const lecturesAvant = vi.mocked(getClients).mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Nouveau client" }));
    await user.type(screen.getByLabelText(/Nom complet/i), NOUVEAU_CLIENT.nom_complet);
    await user.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(getClients).mock.calls.length).toBeGreaterThan(lecturesAvant);
    });
  });
});
