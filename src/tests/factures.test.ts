import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addReglement, createFacture, getFactureById, getFactures, getPressagesNonFactures } from "../lib/factures";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: vi.fn((_payload: Record<string, unknown>) => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe("getPressagesNonFactures", () => {
  it("exclut les pressages déjà facturés (facture_service non null)", async () => {
    const builder = createQueryBuilder({
      data: [
        { id: "pressage-1", facture_service: null },
        { id: "pressage-2", facture_service: { id: "facture-existante" } },
      ],
      error: null,
    });
    const from = vi.fn(() => builder);

    const pressages = await getPressagesNonFactures(mockClient(from), "client-1");

    expect(from).toHaveBeenCalledWith("pressage");
    expect(builder.eq).toHaveBeenCalledWith("depot.client_id", "client-1");
    expect(pressages).toEqual([{ id: "pressage-1", facture_service: null }]);
  });

  it("renvoie un tableau vide si data est null", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);
    expect(await getPressagesNonFactures(mockClient(from), "client-1")).toEqual([]);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(getPressagesNonFactures(mockClient(from), "client-1")).rejects.toThrow("network");
  });
});

describe("getFactures", () => {
  it("récupère les factures d'une saison avec le client embarqué", async () => {
    const builder = createQueryBuilder({
      data: [{ id: "facture-1", client: { nom_complet: "Client A" } }],
      error: null,
    });
    const from = vi.fn(() => builder);

    const factures = await getFactures(mockClient(from), "saison-1");

    expect(from).toHaveBeenCalledWith("facture_service");
    expect(builder.eq).toHaveBeenCalledWith("saison_id", "saison-1");
    expect(factures).toEqual([{ id: "facture-1", client: { nom_complet: "Client A" } }]);
  });
});

describe("getFactureById", () => {
  it("récupère une facture avec ses relations", async () => {
    const builder = createQueryBuilder({ data: { id: "facture-1" }, error: null });
    const from = vi.fn(() => builder);

    const facture = await getFactureById(mockClient(from), "facture-1");

    expect(from).toHaveBeenCalledWith("facture_service");
    expect(builder.eq).toHaveBeenCalledWith("id", "facture-1");
    expect(facture).toEqual({ id: "facture-1" });
  });

  it("renvoie null si la facture n'existe pas", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);
    expect(await getFactureById(mockClient(from), "inconnue")).toBeNull();
  });
});

describe("createFacture", () => {
  it("insère uniquement pressage_id (tout le reste est dérivé côté base)", async () => {
    const builder = createQueryBuilder({ data: { id: "facture-1" }, error: null });
    const from = vi.fn(() => builder);

    await createFacture(mockClient(from), "pressage-1");

    expect(from).toHaveBeenCalledWith("facture_service");
    expect(builder.insert).toHaveBeenCalledWith({ pressage_id: "pressage-1" });
  });

  it("renvoie un message clair sur une violation de contrainte unique (23505)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const from = vi.fn(() => builder);

    await expect(createFacture(mockClient(from), "pressage-1")).rejects.toThrow(
      "Ce pressage a déjà été facturé.",
    );
  });

  it("propage les autres erreurs telles quelles", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(createFacture(mockClient(from), "pressage-1")).rejects.toThrow("network");
  });
});

describe("addReglement", () => {
  it("insère le règlement avec les bons champs", async () => {
    const builder = createQueryBuilder({ data: { id: "reglement-1" }, error: null });
    const from = vi.fn(() => builder);

    await addReglement(mockClient(from), {
      facture_id: "facture-1",
      montant: 10,
      mode: "ESPECES",
    });

    expect(from).toHaveBeenCalledWith("reglement");
    expect(builder.insert).toHaveBeenCalledWith({
      facture_id: "facture-1",
      montant: 10,
      mode: "ESPECES",
      note: null,
    });
  });

  it("propage l'erreur si le trigger refuse (dépassement du reste dû)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Règlement refusé : le total réglé (30.00 DT) dépasserait le montant de la facture (25.00 DT)"),
    });
    const from = vi.fn(() => builder);

    await expect(
      addReglement(mockClient(from), { facture_id: "facture-1", montant: 30, mode: "VIREMENT" }),
    ).rejects.toThrow("dépasserait le montant");
  });
});
