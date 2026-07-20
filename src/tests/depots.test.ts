// src/tests/depots.test.ts
//
// Même approche que src/tests/clients.test.ts : un query builder Supabase
// simulé et chaînable, pour vérifier quelle requête est construite sans
// réseau ni base réelle.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDepot, getActiveSeason, getDepotById, getDepots } from "../lib/depots";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    // Le paramètre sert uniquement à typer insert.mock.calls[0][0] utilisé plus bas.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: vi.fn((_payload: Record<string, unknown>) => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe("getActiveSeason", () => {
  it("filtre sur is_active = true et renvoie la saison", async () => {
    const builder = createQueryBuilder({ data: { id: "saison-1", is_active: true }, error: null });
    const from = vi.fn(() => builder);

    const season = await getActiveSeason(mockClient(from));

    expect(from).toHaveBeenCalledWith("saison");
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
    expect(season).toEqual({ id: "saison-1", is_active: true });
  });

  it("renvoie null si aucune saison active (pas d'erreur)", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    expect(await getActiveSeason(mockClient(from))).toBeNull();
  });
});

describe("getDepots", () => {
  const depotTicketMatch = {
    id: "1",
    numero_ticket: "TK-2026-0001",
    client: { nom_complet: "Ali Ben Salah" },
  };
  const depotClientMatch = {
    id: "2",
    numero_ticket: "TK-2026-0002",
    client: { nom_complet: "Karim Jebali" },
  };
  const depotNoMatch = {
    id: "3",
    numero_ticket: "TK-2026-0003",
    client: { nom_complet: "Sonia Trabelsi" },
  };

  it("filtre toujours par saison_id", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => builder);

    await getDepots(mockClient(from), "saison-1");

    expect(from).toHaveBeenCalledWith("depot");
    expect(builder.eq).toHaveBeenCalledWith("saison_id", "saison-1");
  });

  it("applique le filtre de statut de paiement en SQL", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => builder);

    await getDepots(mockClient(from), "saison-1", { statutPaiement: "PARTIEL" });

    expect(builder.eq).toHaveBeenCalledWith("statut_paiement_achat", "PARTIEL");
  });

  it("filtre en mémoire sur le numéro de ticket OU le nom du client", async () => {
    const builder = createQueryBuilder({
      data: [depotTicketMatch, depotClientMatch, depotNoMatch],
      error: null,
    });
    const from = vi.fn(() => builder);

    const results = await getDepots(mockClient(from), "saison-1", { search: "0001" });
    expect(results.map((d) => d.id)).toEqual(["1"]);

    const resultsByName = await getDepots(mockClient(from), "saison-1", { search: "karim" });
    expect(resultsByName.map((d) => d.id)).toEqual(["2"]);
  });

  it("renvoie tout si aucun terme de recherche", async () => {
    const builder = createQueryBuilder({
      data: [depotTicketMatch, depotClientMatch],
      error: null,
    });
    const from = vi.fn(() => builder);

    const results = await getDepots(mockClient(from), "saison-1");
    expect(results).toHaveLength(2);
  });
});

describe("getDepotById", () => {
  it("renvoie null si le dépôt n'existe pas (ou n'est pas visible via RLS)", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    expect(await getDepotById(mockClient(from), "depot-1")).toBeNull();
  });
});

describe("createDepot", () => {
  it("calcule poids_olives_kg et n'envoie jamais numero_ticket (généré par trigger)", async () => {
    const builder = createQueryBuilder({ data: { id: "depot-1" }, error: null });
    const from = vi.fn(() => builder);

    await createDepot(mockClient(from), {
      saison_id: "saison-1",
      user_id: "user-1",
      client_id: "client-1",
      poids_brut_kg: 100,
      poids_tare_kg: 15,
      is_achat_olives: false,
    });

    const insertedPayload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedPayload.poids_olives_kg).toBe(85);
    expect(insertedPayload).not.toHaveProperty("numero_ticket");
  });

  it("n'ajoute pas les champs d'achat en mode prestation", async () => {
    const builder = createQueryBuilder({ data: { id: "depot-1" }, error: null });
    const from = vi.fn(() => builder);

    await createDepot(mockClient(from), {
      saison_id: "saison-1",
      user_id: "user-1",
      client_id: "client-1",
      poids_brut_kg: 100,
      poids_tare_kg: 15,
      is_achat_olives: false,
    });

    const insertedPayload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedPayload).not.toHaveProperty("prix_achat_unitaire");
    expect(insertedPayload).not.toHaveProperty("statut_paiement_achat");
  });

  it("calcule statut_paiement_achat = PARTIEL pour un achat payé partiellement", async () => {
    const builder = createQueryBuilder({ data: { id: "depot-1" }, error: null });
    const from = vi.fn(() => builder);

    // poids net = 85, total = 85 * 0.8 = 68, payé 30 -> PARTIEL
    await createDepot(mockClient(from), {
      saison_id: "saison-1",
      user_id: "user-1",
      client_id: "client-1",
      poids_brut_kg: 100,
      poids_tare_kg: 15,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 30,
    });

    const insertedPayload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedPayload.statut_paiement_achat).toBe("PARTIEL");
  });

  it("calcule statut_paiement_achat = NON_PAYE pour un achat différé", async () => {
    const builder = createQueryBuilder({ data: { id: "depot-1" }, error: null });
    const from = vi.fn(() => builder);

    await createDepot(mockClient(from), {
      saison_id: "saison-1",
      user_id: "user-1",
      client_id: "client-1",
      poids_brut_kg: 100,
      poids_tare_kg: 15,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 0,
    });

    const insertedPayload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedPayload.statut_paiement_achat).toBe("NON_PAYE");
  });

  it("propage l'erreur si le trigger user_id la rejette", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("user_id doit correspondre à l'utilisateur connecté"),
    });
    const from = vi.fn(() => builder);

    await expect(
      createDepot(mockClient(from), {
        saison_id: "saison-1",
        user_id: "user-autre",
        client_id: "client-1",
        poids_brut_kg: 100,
        poids_tare_kg: 15,
        is_achat_olives: false,
      }),
    ).rejects.toThrow("user_id doit correspondre à l'utilisateur connecté");
  });
});
