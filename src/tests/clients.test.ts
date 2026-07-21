import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveClient, createClient, getClients, updateClient } from "../lib/clients";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe("getClients", () => {
  it("filtre toujours les clients archivés (deleted_at IS NULL)", async () => {
    const builder = createQueryBuilder({ data: [{ id: "1", nom_complet: "Ali" }], error: null });
    const from = vi.fn(() => builder);

    const clients = await getClients(mockClient(from));

    expect(from).toHaveBeenCalledWith("client");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(clients).toEqual([{ id: "1", nom_complet: "Ali" }]);
  });

  it("construit une recherche sur le nom OU le téléphone quand un terme est fourni", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => builder);

    await getClients(mockClient(from), "Ali");

    expect(builder.or).toHaveBeenCalledWith("nom_complet.ilike.%Ali%,telephone.ilike.%Ali%");
  });

  it("n'ajoute aucun filtre de recherche si le terme est vide", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => builder);

    await getClients(mockClient(from), "   ");

    expect(builder.or).not.toHaveBeenCalled();
  });

  it("renvoie un tableau vide si data est null", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    expect(await getClients(mockClient(from))).toEqual([]);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);

    await expect(getClients(mockClient(from))).rejects.toThrow("network");
  });
});

describe("createClient", () => {
  it("initialise toujours solde_compte à 0 et lie huilerie_id", async () => {
    const builder = createQueryBuilder({ data: { id: "1" }, error: null });
    const from = vi.fn(() => builder);

    await createClient(mockClient(from), "huilerie-1", {
      nom_complet: "Ali Ben Salah",
      telephone: undefined,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        huilerie_id: "huilerie-1",
        nom_complet: "Ali Ben Salah",
        solde_compte: 0,
      }),
    );
  });

  it("propage l'erreur Supabase (ex: violation RLS)", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("RLS violation") });
    const from = vi.fn(() => builder);

    await expect(
      createClient(mockClient(from), "huilerie-1", { nom_complet: "Ali", telephone: undefined }),
    ).rejects.toThrow("RLS violation");
  });
});

describe("updateClient", () => {
  it("modifie uniquement nom_complet et telephone", async () => {
    const builder = createQueryBuilder({ data: { id: "client-1" }, error: null });
    const from = vi.fn(() => builder);

    await updateClient(mockClient(from), "client-1", {
      nom_complet: "Ali Ben Salah",
      telephone: "20123456",
    });

    expect(builder.update).toHaveBeenCalledWith({
      nom_complet: "Ali Ben Salah",
      telephone: "20123456",
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "client-1");
  });
});

describe("archiveClient", () => {
  it("fait un UPDATE (deleted_at), jamais un DELETE", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await archiveClient(mockClient(from), "client-1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "client-1");
  });

  it("propage l'erreur si le trigger rejette (ex: opérateur non-gérant)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Seul un gérant peut archiver ou restaurer un client"),
    });
    const from = vi.fn(() => builder);

    await expect(archiveClient(mockClient(from), "client-1")).rejects.toThrow(
      "Seul un gérant peut archiver ou restaurer un client",
    );
  });
});
