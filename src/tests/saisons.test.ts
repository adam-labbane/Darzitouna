import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activateSaison, createSaison, deactivateSaison, getSaisons, updateSaison } from "../lib/saisons";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: vi.fn((_payload: Record<string, unknown>) => builder),
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

describe("getSaisons", () => {
  it("récupère les saisons triées par date de début décroissante", async () => {
    const builder = createQueryBuilder({ data: [{ id: "saison-1" }], error: null });
    const from = vi.fn(() => builder);

    const saisons = await getSaisons(mockClient(from));

    expect(from).toHaveBeenCalledWith("saison");
    expect(builder.order).toHaveBeenCalledWith("date_debut", { ascending: false });
    expect(saisons).toEqual([{ id: "saison-1" }]);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(getSaisons(mockClient(from))).rejects.toThrow("network");
  });
});

describe("createSaison", () => {
  it("crée toujours une saison inactive (is_active: false)", async () => {
    const builder = createQueryBuilder({ data: { id: "saison-1" }, error: null });
    const from = vi.fn(() => builder);

    await createSaison(mockClient(from), "huilerie-1", {
      nom: "2026-2027",
      date_debut: "2026-09-01",
      date_fin: "2027-01-31",
      config_prix_kilo_service: 0.25,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ huilerie_id: "huilerie-1", is_active: false }),
    );
  });
});

describe("updateSaison", () => {
  it("ne modifie jamais is_active", async () => {
    const builder = createQueryBuilder({ data: { id: "saison-1" }, error: null });
    const from = vi.fn(() => builder);

    await updateSaison(mockClient(from), "saison-1", {
      nom: "2026-2027 bis",
      date_debut: "2026-09-01",
      date_fin: "2027-01-31",
      config_prix_kilo_service: 0.3,
    });

    const payload = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("is_active");
    expect(payload.config_prix_kilo_service).toBe(0.3);
  });
});

describe("activateSaison", () => {
  it("passe uniquement is_active à true, la désactivation des autres est déléguée au trigger", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await activateSaison(mockClient(from), "saison-1");

    expect(builder.update).toHaveBeenCalledWith({ is_active: true });
    expect(builder.eq).toHaveBeenCalledWith("id", "saison-1");
  });

  it("propage l'erreur si le trigger GERANT-only refuse", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Seul un gérant peut modifier la configuration des saisons"),
    });
    const from = vi.fn(() => builder);
    await expect(activateSaison(mockClient(from), "saison-1")).rejects.toThrow("Seul un gérant");
  });
});

describe("deactivateSaison", () => {
  it("passe is_active à false", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await deactivateSaison(mockClient(from), "saison-1");

    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
  });
});
