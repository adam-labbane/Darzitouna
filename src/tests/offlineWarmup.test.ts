import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearOfflineCache, warmOfflineCache } from "../lib/offlineWarmup";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(fromImpl: (table: string) => unknown): SupabaseClient {
  return { from: vi.fn(fromImpl) } as unknown as SupabaseClient;
}

function setOnline(value: boolean) {
  vi.stubGlobal("navigator", { onLine: value });
}

describe("warmOfflineCache", () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne fait rien hors ligne (pas la peine de réchauffer un cache déjà indisponible)", async () => {
    setOnline(false);
    const from = vi.fn();
    await warmOfflineCache(mockClient(from));
    expect(from).not.toHaveBeenCalled();
  });

  it("interroge cuve, client et saison en ligne", async () => {
    const tables: string[] = [];
    const from = (table: string) => {
      tables.push(table);
      if (table === "saison") return createQueryBuilder({ data: [], error: null });
      return createQueryBuilder({ data: [], error: null });
    };

    await warmOfflineCache(mockClient(from));

    expect(tables).toContain("cuve");
    expect(tables).toContain("client");
    expect(tables).toContain("saison");
  });

  it("réchauffe aussi les dépôts de la saison active si une saison est active", async () => {
    const tables: string[] = [];
    const from = (table: string) => {
      tables.push(table);
      if (table === "saison") {
        return createQueryBuilder({
          data: [{ id: "saison-1", is_active: true }, { id: "saison-0", is_active: false }],
          error: null,
        });
      }
      return createQueryBuilder({ data: [], error: null });
    };

    await warmOfflineCache(mockClient(from));

    expect(tables).toContain("depot");
  });

  it("ne réchauffe pas les dépôts si aucune saison n'est active", async () => {
    const tables: string[] = [];
    const from = (table: string) => {
      tables.push(table);
      if (table === "saison") {
        return createQueryBuilder({ data: [{ id: "saison-1", is_active: false }], error: null });
      }
      return createQueryBuilder({ data: [], error: null });
    };

    await warmOfflineCache(mockClient(from));

    expect(tables).not.toContain("depot");
  });

  it("un échec sur une requête n'empêche pas les autres (best-effort)", async () => {
    const tables: string[] = [];
    const from = (table: string) => {
      tables.push(table);
      if (table === "cuve") return createQueryBuilder({ data: null, error: new Error("network") });
      if (table === "saison") return createQueryBuilder({ data: [], error: null });
      return createQueryBuilder({ data: [], error: null });
    };

    await expect(warmOfflineCache(mockClient(from))).resolves.toBeUndefined();
    expect(tables).toContain("client");
  });
});

describe("clearOfflineCache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("supprime uniquement le cache de données supabase-data", async () => {
    const deleteFn = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: deleteFn });

    await clearOfflineCache();

    expect(deleteFn).toHaveBeenCalledWith("supabase-data");
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien si l'API Cache Storage est indisponible", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearOfflineCache()).resolves.toBeUndefined();
  });

  it("n'échoue jamais même si la suppression du cache échoue", async () => {
    vi.stubGlobal("caches", { delete: vi.fn().mockRejectedValue(new Error("Cache API error")) });
    await expect(clearOfflineCache()).resolves.toBeUndefined();
  });
});
