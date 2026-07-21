// src/tests/cuves.test.ts
//
// Même approche que src/tests/clients.test.ts : un query builder Supabase
// simulé et chaînable, pour vérifier quelle requête est construite sans
// réseau ni base réelle.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  archiveCuve,
  correctCuveLevel,
  createCuve,
  getCuves,
  updateCuve,
} from "../lib/cuves";

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    // Les paramètres servent uniquement à typer .mock.calls[0][0], utilisé
    // plus bas pour inspecter le payload envoyé.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: vi.fn((_payload: Record<string, unknown>) => builder),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update: vi.fn((_payload: Record<string, unknown>) => builder),
    single: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

function mockClient(from: (table: string) => unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe("getCuves", () => {
  it("filtre les cuves archivées (deleted_at IS NULL)", async () => {
    const builder = createQueryBuilder({ data: [{ id: "1", nom_reference: "Cuve 1" }], error: null });
    const from = vi.fn(() => builder);

    const cuves = await getCuves(mockClient(from));

    expect(from).toHaveBeenCalledWith("cuve");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(cuves).toEqual([{ id: "1", nom_reference: "Cuve 1" }]);
  });

  it("renvoie un tableau vide si data est null", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);
    expect(await getCuves(mockClient(from))).toEqual([]);
  });

  it("propage l'erreur Supabase", async () => {
    const builder = createQueryBuilder({ data: null, error: new Error("network") });
    const from = vi.fn(() => builder);
    await expect(getCuves(mockClient(from))).rejects.toThrow("network");
  });
});

describe("createCuve", () => {
  it("initialise toujours niveau_actuel à 0", async () => {
    const builder = createQueryBuilder({ data: { id: "1" }, error: null });
    const from = vi.fn(() => builder);

    await createCuve(mockClient(from), "huilerie-1", {
      nom_reference: "Cuve 1",
      emplacement: undefined,
      type_huile: "VIERGE",
      capacite_max: 2000,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ huilerie_id: "huilerie-1", niveau_actuel: 0 }),
    );
  });
});

describe("updateCuve", () => {
  it("ne modifie jamais niveau_actuel", async () => {
    const builder = createQueryBuilder({ data: { id: "cuve-1" }, error: null });
    const from = vi.fn(() => builder);

    await updateCuve(mockClient(from), "cuve-1", {
      nom_reference: "Cuve 1 bis",
      emplacement: undefined,
      type_huile: "EXTRA",
      capacite_max: 2500,
    });

    const payload = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("niveau_actuel");
    expect(payload.capacite_max).toBe(2500);
    expect(builder.eq).toHaveBeenCalledWith("id", "cuve-1");
  });

  // Bug de recette : baisser la capacité sous le niveau actuel doit être
  // rejeté par la contrainte CHECK cuve_niveau_within_capacity côté base
  // (vérifié en direct : PATCH -> 400 "23514 violates check constraint").
  // updateCuve() doit propager cette erreur, pas l'avaler.
  it("propage l'erreur si la contrainte CHECK refuse une capacité sous le niveau actuel", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error('new row for relation "cuve" violates check constraint "cuve_niveau_within_capacity"'),
    });
    const from = vi.fn(() => builder);

    await expect(
      updateCuve(mockClient(from), "cuve-1", {
        nom_reference: "Cuve 1",
        emplacement: undefined,
        type_huile: "EXTRA",
        capacite_max: 1000,
      }),
    ).rejects.toThrow("cuve_niveau_within_capacity");
  });
});

describe("archiveCuve", () => {
  it("fait un UPDATE (deleted_at), jamais un DELETE", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await archiveCuve(mockClient(from), "cuve-1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "cuve-1");
  });

  it("propage l'erreur si le trigger refuse (cuve non vide)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Impossible d'archiver une cuve non vide"),
    });
    const from = vi.fn(() => builder);

    await expect(archiveCuve(mockClient(from), "cuve-1")).rejects.toThrow(
      "Impossible d'archiver une cuve non vide",
    );
  });

  // Bug de recette #2 : un OPERATEUR a réussi à archiver une cuve — le
  // trigger protect_cuve_deletion ne vérifiait jamais le rôle. Corrigé
  // dans supabase/migrations/20260721120000_cuve_archiving_role_fix.sql.
  // archiveCuve() doit propager cette erreur telle quelle, jamais
  // l'avaler ni réussir silencieusement.
  it("propage l'erreur si le trigger refuse (rôle non GERANT)", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Seul un gérant peut archiver ou restaurer une cuve"),
    });
    const from = vi.fn(() => builder);

    await expect(archiveCuve(mockClient(from), "cuve-1")).rejects.toThrow(
      "Seul un gérant peut archiver ou restaurer une cuve",
    );
  });
});

describe("correctCuveLevel", () => {
  it("passe par un INSERT dans mvt_stock_huile, jamais un UPDATE sur cuve", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await correctCuveLevel(mockClient(from), {
      cuveId: "cuve-1",
      saisonId: "saison-1",
      currentLevel: 500,
      newLevel: 480,
      raison: "Évaporation constatée à l'inventaire",
    });

    expect(from).toHaveBeenCalledWith("mvt_stock_huile");
    expect(from).not.toHaveBeenCalledWith("cuve");
    expect(builder.insert).toHaveBeenCalledWith({
      cuve_id: "cuve-1",
      saison_id: "saison-1",
      type: "CORRECTION",
      quantite_delta: -20,
      note: "Évaporation constatée à l'inventaire",
    });
  });

  it("calcule un delta positif si le niveau réel est supérieur au niveau connu", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);

    await correctCuveLevel(mockClient(from), {
      cuveId: "cuve-1",
      saisonId: "saison-1",
      currentLevel: 500,
      newLevel: 550,
      raison: "Inventaire",
    });

    const payload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.quantite_delta).toBe(50);
  });

  it("propage l'erreur si le trigger de rôle ou de bornes rejette la correction", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("Seul un gérant peut effectuer une correction manuelle de niveau"),
    });
    const from = vi.fn(() => builder);

    await expect(
      correctCuveLevel(mockClient(from), {
        cuveId: "cuve-1",
        saisonId: "saison-1",
        currentLevel: 500,
        newLevel: 480,
        raison: "Test",
      }),
    ).rejects.toThrow("Seul un gérant peut effectuer une correction manuelle de niveau");
  });

  // Bug de recette #1 signalé : "un niveau supérieur à la capacité est
  // accepté". Reproduit en direct sous plusieurs angles (UI avec bouton
  // désactivé, appel API brut, édition de la capacité) sans jamais
  // parvenir à corrompre les données — le trigger update_cuve_stock
  // rejette bien tout dépassement (vérifié : PATCH -> 400 P0001). Ce test
  // fige le contrat côté client : correctCuveLevel() ne doit jamais
  // avaler cette erreur.
  it("propage l'erreur si le trigger refuse un niveau qui dépasserait la capacité", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error(
        "Mouvement refusé : le niveau (3000.00 L) dépasserait la capacité de la cuve (2000.00 L)",
      ),
    });
    const from = vi.fn(() => builder);

    await expect(
      correctCuveLevel(mockClient(from), {
        cuveId: "cuve-1",
        saisonId: "saison-1",
        currentLevel: 1500,
        newLevel: 3000,
        raison: "Test dépassement capacité",
      }),
    ).rejects.toThrow("dépasserait la capacité");
  });
});
