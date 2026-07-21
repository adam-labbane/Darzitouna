import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createUtilisateur,
  deleteUtilisateur,
  getUtilisateurs,
  resetPin,
  updateUtilisateur,
} from "../lib/personnel";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    select: vi.fn((_columns?: string) => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update: vi.fn((_payload: Record<string, unknown>) => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

function mockRpcClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn(() => Promise.resolve(result));
  const rpc = vi.fn(() => ({ single }));
  const client = { rpc } as unknown as SupabaseClient;
  return { client, rpc, single };
}

describe("getUtilisateurs", () => {
  it("sélectionne des colonnes explicites, jamais select('*') (hash_pin ne doit jamais transiter)", async () => {
    const builder = createQueryBuilder({ data: [{ id: "u1" }], error: null });
    const from = vi.fn(() => builder);

    await getUtilisateurs(mockClient(from));

    expect(from).toHaveBeenCalledWith("utilisateur");
    const selectArg = builder.select.mock.calls[0][0] as string;
    expect(selectArg).not.toBe("*");
    expect(selectArg).not.toContain("hash_pin");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(getUtilisateurs(mockClient(from))).rejects.toThrow("network");
  });
});

describe("createUtilisateur", () => {
  it("appelle le RPC create_utilisateur avec les bons paramètres", async () => {
    const { client, rpc } = mockRpcClient({ data: { id: "u1" }, error: null });

    await createUtilisateur(client, { nom_complet: "Sami Nouveau", role: "OPERATEUR", pin: "7777" });

    expect(rpc).toHaveBeenCalledWith("create_utilisateur", {
      p_nom_complet: "Sami Nouveau",
      p_role: "OPERATEUR",
      p_pin: "7777",
    });
  });

  it("propage l'erreur si l'appelant n'est pas gérant", async () => {
    const { client } = mockRpcClient({
      data: null,
      error: new Error("Seul un gérant peut créer un utilisateur"),
    });

    await expect(
      createUtilisateur(client, { nom_complet: "Intrus", role: "GERANT", pin: "1111" }),
    ).rejects.toThrow("Seul un gérant");
  });
});

describe("updateUtilisateur", () => {
  it("modifie uniquement nom_complet et role", async () => {
    const builder = createQueryBuilder({ data: { id: "u1" }, error: null });
    const from = vi.fn(() => builder);

    await updateUtilisateur(mockClient(from), "u1", { nom_complet: "Nouveau Nom", role: "GERANT" });

    expect(builder.update).toHaveBeenCalledWith({ nom_complet: "Nouveau Nom", role: "GERANT" });
  });

  it("propage l'erreur si la démotion du dernier gérant est refusée", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Impossible : Mohamed est le dernier gérant de cette huilerie"),
    });
    const from = vi.fn(() => builder);

    await expect(
      updateUtilisateur(mockClient(from), "u1", { nom_complet: "Mohamed", role: "OPERATEUR" }),
    ).rejects.toThrow("dernier gérant");
  });
});

describe("resetPin", () => {
  it("appelle le RPC reset_utilisateur_pin", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const client = { rpc } as unknown as SupabaseClient;

    await resetPin(client, "u1", "8888");

    expect(rpc).toHaveBeenCalledWith("reset_utilisateur_pin", { p_user_id: "u1", p_pin: "8888" });
  });

  it("propage l'erreur si l'utilisateur cible est d'une autre huilerie", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: new Error("Utilisateur introuvable") }));
    const client = { rpc } as unknown as SupabaseClient;

    await expect(resetPin(client, "u1", "8888")).rejects.toThrow("Utilisateur introuvable");
  });
});

describe("deleteUtilisateur", () => {
  it("fait un UPDATE (deleted_at), jamais un DELETE", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await deleteUtilisateur(mockClient(from), "u1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "u1");
  });

  it("propage l'erreur si le trigger refuse (auto-suppression)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Vous ne pouvez pas archiver ou rétrograder votre propre compte"),
    });
    const from = vi.fn(() => builder);

    await expect(deleteUtilisateur(mockClient(from), "u1")).rejects.toThrow("propre compte");
  });

  it("propage l'erreur si le trigger refuse (dernier gérant)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Impossible : Mohamed est le dernier gérant de cette huilerie"),
    });
    const from = vi.fn(() => builder);

    await expect(deleteUtilisateur(mockClient(from), "u1")).rejects.toThrow("dernier gérant");
  });
});
