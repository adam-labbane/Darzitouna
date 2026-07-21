import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllClientsFinancials, getClientProfile } from "../lib/clientProfile";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function createProfileBuilders(overrides: Partial<Record<string, { data: unknown; error: unknown }>> = {}) {
  return {
    client: createQueryBuilder(overrides.client ?? { data: { id: "client-1" }, error: null }),
    depot: createQueryBuilder(overrides.depot ?? { data: [], error: null }),
    facture_service: createQueryBuilder(overrides.facture_service ?? { data: [], error: null }),
    pressage: createQueryBuilder(overrides.pressage ?? { data: [], error: null }),
  };
}

describe("getClientProfile", () => {
  it("récupère client + dépôts + factures (avec règlements embarqués), filtrés par client_id", async () => {
    const builders = createProfileBuilders({
      client: { data: { id: "client-1", nom_complet: "Ali", solde_compte: 0 }, error: null },
      depot: { data: [{ id: "depot-1", poids_olives_kg: 100 }], error: null },
      facture_service: {
        data: [{ id: "facture-1", montant_ttc: 25, reglement: [{ id: "r1", montant: 10 }] }],
        error: null,
      },
    });
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    const profile = await getClientProfile(client, "client-1");

    expect(from).toHaveBeenCalledWith("client");
    expect(from).toHaveBeenCalledWith("depot");
    expect(from).toHaveBeenCalledWith("facture_service");
    expect(builders.depot.eq).toHaveBeenCalledWith("client_id", "client-1");
    expect(builders.facture_service.eq).toHaveBeenCalledWith("client_id", "client-1");
    expect(profile?.client.nom_complet).toBe("Ali");
    expect(profile?.depots).toEqual([{ id: "depot-1", poids_olives_kg: 100 }]);
    expect(profile?.factures).toEqual([
      { id: "facture-1", montant_ttc: 25, reglement: [{ id: "r1", montant: 10 }] },
    ]);
  });

  it("récupère les pressages du client via le dépôt (depot!inner + eq sur depot.client_id)", async () => {
    const builders = createProfileBuilders({
      pressage: {
        data: [
          {
            id: "pressage-1",
            quantite_huile_kg: 18,
            rendement_final: 18,
            montant_service_total: 25,
            depot: { numero_ticket: "TK-2026-0001", poids_olives_kg: 100 },
          },
        ],
        error: null,
      },
    });
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    const profile = await getClientProfile(client, "client-1");

    expect(from).toHaveBeenCalledWith("pressage");
    expect(builders.pressage.eq).toHaveBeenCalledWith("depot.client_id", "client-1");
    expect(profile?.pressages).toEqual([
      {
        id: "pressage-1",
        quantite_huile_kg: 18,
        rendement_final: 18,
        montant_service_total: 25,
        depot: { numero_ticket: "TK-2026-0001", poids_olives_kg: 100 },
      },
    ]);
  });

  it("filtre en plus par saison_id quand saisonId est fourni (dépôts, factures ET pressages)", async () => {
    const builders = createProfileBuilders();
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    await getClientProfile(client, "client-1", "saison-1");

    expect(builders.depot.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(builders.facture_service.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(builders.pressage.eq).toHaveBeenCalledWith("saison_id", "saison-1");
  });

  it("n'ajoute pas de filtre saison_id quand saisonId est absent (tout l'historique)", async () => {
    const builders = createProfileBuilders();
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    await getClientProfile(client, "client-1");

    expect(builders.depot.eq).not.toHaveBeenCalledWith("saison_id", expect.anything());
    expect(builders.facture_service.eq).not.toHaveBeenCalledWith("saison_id", expect.anything());
    expect(builders.pressage.eq).not.toHaveBeenCalledWith("saison_id", expect.anything());
  });

  it("renvoie null si le client est introuvable (isolation multi-tenant : RLS filtre déjà)", async () => {
    const builders = createProfileBuilders({ client: { data: null, error: null } });
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    const profile = await getClientProfile(client, "client-autre-huilerie");
    expect(profile).toBeNull();
  });

  it("propage l'erreur Supabase (y compris depuis la requête pressages)", async () => {
    const builders = createProfileBuilders({ pressage: { data: null, error: new Error("network") } });
    const from = vi.fn((table: string) => builders[table as keyof typeof builders]);
    const client = { from } as unknown as SupabaseClient;

    await expect(getClientProfile(client, "client-1")).rejects.toThrow("network");
  });
});

describe("getAllClientsFinancials", () => {
  it("groupe les factures et règlements par client_id", async () => {
    const builder = createQueryBuilder({
      data: [
        { client_id: "client-1", montant_ttc: 25, reglement: [{ montant: 10 }] },
        { client_id: "client-1", montant_ttc: 40, reglement: [] },
        { client_id: "client-2", montant_ttc: 15, reglement: [{ montant: 15 }] },
      ],
      error: null,
    });
    const from = vi.fn(() => builder);
    const client = { from } as unknown as SupabaseClient;

    const result = await getAllClientsFinancials(client);

    expect(from).toHaveBeenCalledWith("facture_service");
    expect(result["client-1"].factures).toEqual([{ montant_ttc: 25 }, { montant_ttc: 40 }]);
    expect(result["client-1"].reglements).toEqual([{ montant: 10 }]);
    expect(result["client-2"].factures).toEqual([{ montant_ttc: 15 }]);
    expect(result["client-2"].reglements).toEqual([{ montant: 15 }]);
  });

  it("renvoie un objet vide si aucune facture", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => builder);
    const client = { from } as unknown as SupabaseClient;

    expect(await getAllClientsFinancials(client)).toEqual({});
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    const client = { from } as unknown as SupabaseClient;

    await expect(getAllClientsFinancials(client)).rejects.toThrow("network");
  });
});
