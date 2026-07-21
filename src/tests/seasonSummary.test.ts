// src/tests/seasonSummary.test.ts
import { describe, expect, it } from "vitest";
import { buildSeasonSummary, type SeasonSummaryRawData } from "../lib/seasonSummary";

function baseData(overrides: Partial<SeasonSummaryRawData> = {}): SeasonSummaryRawData {
  return {
    huilerieNom: "Huilerie Mohamed",
    saisonNom: "2025-2026",
    dateDebut: "2025-09-01",
    dateFin: "2026-01-31",
    depots: [],
    pressages: [],
    factures: [],
    reglements: [],
    cuves: [],
    ...overrides,
  };
}

describe("buildSeasonSummary", () => {
  it("reprend l'en-tête (huilerie, saison, dates)", () => {
    const summary = buildSeasonSummary(baseData());
    expect(summary.huilerieNom).toBe("Huilerie Mohamed");
    expect(summary.saisonNom).toBe("2025-2026");
    expect(summary.dateDebut).toBe("2025-09-01");
    expect(summary.dateFin).toBe("2026-01-31");
  });

  it("additionne le poids des olives et compte prestation/achat séparément", () => {
    const summary = buildSeasonSummary(
      baseData({
        depots: [
          { poids_olives_kg: 100, is_achat_olives: false },
          { poids_olives_kg: 50, is_achat_olives: true },
          { poids_olives_kg: 80, is_achat_olives: false },
        ],
      }),
    );
    expect(summary.totalOlivesKg).toBe(230);
    expect(summary.nombreDepots).toBe(3);
    expect(summary.nombrePrestation).toBe(2);
    expect(summary.nombreAchat).toBe(1);
  });

  it("additionne l'huile produite, en traitant les pressages non clôturés (huile null) comme 0", () => {
    const summary = buildSeasonSummary(
      baseData({
        pressages: [{ quantite_huile_kg: 18 }, { quantite_huile_kg: 22 }, { quantite_huile_kg: null }],
      }),
    );
    expect(summary.totalHuileKg).toBe(40);
  });

  it("calcule le rendement moyen comme le ratio global huile/olives (pas la moyenne des rendements individuels)", () => {
    const summary = buildSeasonSummary(
      baseData({
        depots: [{ poids_olives_kg: 200, is_achat_olives: false }],
        pressages: [{ quantite_huile_kg: 36 }],
      }),
    );
    expect(summary.rendementMoyenPct).toBe(18);
  });

  it("additionne le facturé et l'encaissé, et calcule le reste dû", () => {
    const summary = buildSeasonSummary(
      baseData({
        factures: [{ montant_ttc: 25 }, { montant_ttc: 40 }],
        reglements: [{ montant: 25 }, { montant: 10 }],
      }),
    );
    expect(summary.totalFacture).toBe(65);
    expect(summary.totalEncaisse).toBe(35);
    expect(summary.totalResteDu).toBe(30);
  });

  it("plafonne le reste dû à 0 (jamais négatif)", () => {
    const summary = buildSeasonSummary(
      baseData({ factures: [{ montant_ttc: 25 }], reglements: [{ montant: 30 }] }),
    );
    expect(summary.totalResteDu).toBe(0);
  });

  it("reprend l'état des cuves tel quel", () => {
    const summary = buildSeasonSummary(
      baseData({ cuves: [{ nom_reference: "Cuve 1", niveau_actuel: 500, capacite_max: 2000 }] }),
    );
    expect(summary.cuves).toEqual([{ nomReference: "Cuve 1", niveauActuel: 500, capaciteMax: 2000 }]);
  });

  it("cas vide : tous les totaux à zéro, aucune division par zéro sur le rendement", () => {
    const summary = buildSeasonSummary(baseData());
    expect(summary.totalOlivesKg).toBe(0);
    expect(summary.nombreDepots).toBe(0);
    expect(summary.totalHuileKg).toBe(0);
    expect(summary.rendementMoyenPct).toBe(0);
    expect(summary.totalFacture).toBe(0);
    expect(summary.totalEncaisse).toBe(0);
    expect(summary.totalResteDu).toBe(0);
    expect(summary.cuves).toEqual([]);
  });
});
