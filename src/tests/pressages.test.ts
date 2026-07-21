// src/tests/pressages.test.ts
//
// Même approche que src/tests/cuves.test.ts : un query builder Supabase
// simulé et chaînable, pour vérifier quelle requête est construite sans
// réseau ni base réelle.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPressage, getDepotsEnAttente, getPressages } from "../lib/pressages";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe("getDepotsEnAttente", () => {
  // pressage(id) s'embarque comme un objet unique ou null (relation 1-à-1
  // via la contrainte UNIQUE(depot_id)), pas un tableau — voir le
  // commentaire de getDepotsEnAttente dans pressages.ts.
  it("exclut les dépôts déjà pressés (pressage non null)", async () => {
    const builder = createQueryBuilder({
      data: [
        { id: "depot-1", pressage: null },
        { id: "depot-2", pressage: { id: "pressage-existant" } },
      ],
      error: null,
    });
    const from = vi.fn(() => builder);

    const depots = await getDepotsEnAttente(mockClient(from), "saison-1");

    expect(from).toHaveBeenCalledWith("depot");
    expect(builder.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(depots).toEqual([{ id: "depot-1", pressage: null }]);
  });

  it("renvoie un tableau vide si data est null", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);
    expect(await getDepotsEnAttente(mockClient(from), "saison-1")).toEqual([]);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(getDepotsEnAttente(mockClient(from), "saison-1")).rejects.toThrow("network");
  });
});

describe("getPressages", () => {
  it("récupère les pressages d'une saison avec le dépôt embarqué", async () => {
    const builder = createQueryBuilder({
      data: [{ id: "pressage-1", depot: { numero_ticket: "TK-2026-0001" } }],
      error: null,
    });
    const from = vi.fn(() => builder);

    const pressages = await getPressages(mockClient(from), "saison-1");

    expect(from).toHaveBeenCalledWith("pressage");
    expect(builder.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(pressages).toEqual([{ id: "pressage-1", depot: { numero_ticket: "TK-2026-0001" } }]);
  });
});

describe("createPressage", () => {
  function mockRpcClient(result: { data: unknown; error: unknown }) {
    const single = vi.fn(() => Promise.resolve(result));
    const rpc = vi.fn(() => ({ single }));
    const client = { rpc } as unknown as SupabaseClient;
    return { client, rpc, single };
  }

  it("appelle le RPC create_pressage avec les bons paramètres", async () => {
    const { client, rpc } = mockRpcClient({ data: { id: "pressage-1" }, error: null });

    await createPressage(client, {
      depot_id: "depot-1",
      cuve_id: "cuve-1",
      quantite_huile_kg: 18,
      type_huile: "VIERGE",
    });

    expect(rpc).toHaveBeenCalledWith("create_pressage", {
      p_depot_id: "depot-1",
      p_cuve_id: "cuve-1",
      p_quantite_huile_kg: 18,
      p_type_huile: "VIERGE",
    });
  });

  it("renvoie le pressage créé", async () => {
    const { client } = mockRpcClient({
      data: { id: "pressage-1", rendement_final: 18 },
      error: null,
    });

    const pressage = await createPressage(client, {
      depot_id: "depot-1",
      cuve_id: "cuve-1",
      quantite_huile_kg: 18,
      type_huile: "VIERGE",
    });

    expect(pressage).toEqual({ id: "pressage-1", rendement_final: 18 });
  });

  it("propage l'erreur si le RPC échoue (ex: double pressage)", async () => {
    const { client } = mockRpcClient({
      data: null,
      error: new Error("Ce dépôt a déjà été pressé"),
    });

    await expect(
      createPressage(client, {
        depot_id: "depot-1",
        cuve_id: "cuve-1",
        quantite_huile_kg: 18,
        type_huile: "VIERGE",
      }),
    ).rejects.toThrow("Ce dépôt a déjà été pressé");
  });
});
