// src/tests/seasonClosure.test.ts
//
// Même approche que src/tests/factures.test.ts : un query builder
// Supabase simulé et chaînable, plus un mock RPC dédié pour
// close_season_and_open_new.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeSeasonAndOpenNew, getSeasonSummaryData } from "../lib/seasonClosure";
import type { Saison } from "../types/saison";

const baseSaison: Saison = {
  id: "saison-1",
  huilerie_id: "huilerie-1",
  nom: "2025-2026",
  date_debut: "2025-09-01",
  date_fin: "2026-01-31",
  is_active: true,
  config_prix_kilo_service: 0.25,
  date_cloture: null,
};

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

describe("getSeasonSummaryData", () => {
  it("interroge dépôts/pressages/factures/cuves filtrés par saison ou huilerie, et aplatit les règlements embarqués", async () => {
    const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {
      depot: createQueryBuilder({ data: [{ poids_olives_kg: 100, is_achat_olives: false }], error: null }),
      pressage: createQueryBuilder({ data: [{ quantite_huile_kg: 18 }], error: null }),
      facture_service: createQueryBuilder({
        data: [{ montant_ttc: 25, reglement: [{ montant: 10 }, { montant: 15 }] }],
        error: null,
      }),
      cuve: createQueryBuilder({ data: [{ nom_reference: "Cuve 1", niveau_actuel: 500, capacite_max: 2000 }], error: null }),
    };
    const from = vi.fn((table: string) => builders[table]);
    const client = { from } as unknown as SupabaseClient;

    const raw = await getSeasonSummaryData(client, baseSaison, "Huilerie Mohamed");

    expect(from).toHaveBeenCalledWith("depot");
    expect(from).toHaveBeenCalledWith("pressage");
    expect(from).toHaveBeenCalledWith("facture_service");
    expect(from).toHaveBeenCalledWith("cuve");
    expect(builders.depot.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(builders.cuve.eq).toHaveBeenCalledWith("huilerie_id", "huilerie-1");
    expect(builders.cuve.is).toHaveBeenCalledWith("deleted_at", null);

    expect(raw.huilerieNom).toBe("Huilerie Mohamed");
    expect(raw.saisonNom).toBe("2025-2026");
    expect(raw.depots).toEqual([{ poids_olives_kg: 100, is_achat_olives: false }]);
    expect(raw.factures).toEqual([{ montant_ttc: 25 }]);
    expect(raw.reglements).toEqual([{ montant: 10 }, { montant: 15 }]);
    expect(raw.cuves).toEqual([{ nom_reference: "Cuve 1", niveau_actuel: 500, capacite_max: 2000 }]);
  });

  it("propage l'erreur si une des requêtes échoue", async () => {
    const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {
      depot: createQueryBuilder({ data: null, error: new Error("network") }),
      pressage: createQueryBuilder({ data: [], error: null }),
      facture_service: createQueryBuilder({ data: [], error: null }),
      cuve: createQueryBuilder({ data: [], error: null }),
    };
    const from = vi.fn((table: string) => builders[table]);
    const client = { from } as unknown as SupabaseClient;

    await expect(getSeasonSummaryData(client, baseSaison, "Huilerie Mohamed")).rejects.toThrow("network");
  });
});

describe("closeSeasonAndOpenNew", () => {
  function mockRpcClient(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn(() => Promise.resolve(result));
    const client = { rpc } as unknown as SupabaseClient;
    return { client, rpc };
  }

  it("appelle le RPC close_season_and_open_new avec les bons paramètres", async () => {
    const { client, rpc } = mockRpcClient({
      data: {
        ancienne_saison: { ...baseSaison, is_active: false, date_cloture: "2026-07-21T00:00:00Z" },
        nouvelle_saison: { ...baseSaison, id: "saison-2", nom: "2026-2027" },
        clients_proteges_count: 2,
      },
      error: null,
    });

    await closeSeasonAndOpenNew(client, {
      oldSaisonId: "saison-1",
      reporterStock: false,
      conserverClients: false,
      nouvelleSaison: {
        nom: "2026-2027",
        date_debut: "2026-09-01",
        date_fin: "2027-01-31",
        config_prix_kilo_service: 0.3,
      },
    });

    expect(rpc).toHaveBeenCalledWith("close_season_and_open_new", {
      p_old_saison_id: "saison-1",
      p_reporter_stock: false,
      p_conserver_clients: false,
      p_nom: "2026-2027",
      p_date_debut: "2026-09-01",
      p_date_fin: "2027-01-31",
      p_prix: 0.3,
    });
  });

  it("convertit le résultat JSONB en objet camelCase (ancienneSaison/nouvelleSaison/clientsProtegesCount)", async () => {
    const nouvelleSaison = { ...baseSaison, id: "saison-2", nom: "2026-2027" };
    const ancienneSaison = { ...baseSaison, is_active: false, date_cloture: "2026-07-21T00:00:00Z" };
    const { client } = mockRpcClient({
      data: { ancienne_saison: ancienneSaison, nouvelle_saison: nouvelleSaison, clients_proteges_count: 2 },
      error: null,
    });

    const result = await closeSeasonAndOpenNew(client, {
      oldSaisonId: "saison-1",
      reporterStock: true,
      conserverClients: true,
      nouvelleSaison: {
        nom: "2026-2027",
        date_debut: undefined,
        date_fin: undefined,
        config_prix_kilo_service: 0.3,
      },
    });

    expect(result).toEqual({
      ancienneSaison,
      nouvelleSaison,
      clientsProtegesCount: 2,
    });
  });

  it("propage l'erreur si l'appelant n'est pas gérant", async () => {
    const { client } = mockRpcClient({
      data: null,
      error: new Error("Seul un gérant peut clôturer une saison"),
    });

    await expect(
      closeSeasonAndOpenNew(client, {
        oldSaisonId: "saison-1",
        reporterStock: true,
        conserverClients: true,
        nouvelleSaison: { nom: "2026-2027", date_debut: undefined, date_fin: undefined, config_prix_kilo_service: 0.3 },
      }),
    ).rejects.toThrow("Seul un gérant");
  });

  it("propage l'erreur si la saison est déjà clôturée", async () => {
    const { client } = mockRpcClient({
      data: null,
      error: new Error("Cette saison est déjà clôturée"),
    });

    await expect(
      closeSeasonAndOpenNew(client, {
        oldSaisonId: "saison-1",
        reporterStock: true,
        conserverClients: true,
        nouvelleSaison: { nom: "2026-2027", date_debut: undefined, date_fin: undefined, config_prix_kilo_service: 0.3 },
      }),
    ).rejects.toThrow("déjà clôturée");
  });
});
