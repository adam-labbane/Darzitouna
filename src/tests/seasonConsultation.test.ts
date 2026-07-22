import { describe, expect, it } from "vitest";
import { isConsultationReadOnly, isSeasonMismatch } from "../lib/seasonConsultation";
import type { Saison } from "../types/saison";

function makeSaison(overrides: Partial<Saison> = {}): Saison {
  return {
    id: "saison-1",
    huilerie_id: "huilerie-1",
    nom: "2025-2026",
    date_debut: null,
    date_fin: null,
    is_active: true,
    config_prix_kilo_service: 0.25,
    date_cloture: null,
    ...overrides,
  };
}

describe("isSeasonMismatch", () => {
  it("false si aucune saison n'est consultée (état pas encore résolu)", () => {
    expect(isSeasonMismatch(null, makeSaison())).toBe(false);
  });

  it("false si la saison consultée est la saison active (mode de travail normal)", () => {
    const saison = makeSaison();
    expect(isSeasonMismatch(saison, saison)).toBe(false);
  });

  it("false si la saison consultée a le même id que l'active (objets distincts)", () => {
    const active = makeSaison({ id: "saison-1" });
    const consultee = makeSaison({ id: "saison-1", nom: "copie" });
    expect(isSeasonMismatch(consultee, active)).toBe(false);
  });

  it("true si la saison consultée diffère de la saison active", () => {
    const active = makeSaison({ id: "saison-2", nom: "2026-2027" });
    const consultee = makeSaison({ id: "saison-1", nom: "2025-2026" });
    expect(isSeasonMismatch(consultee, active)).toBe(true);
  });

  it("true si une saison est consultée mais qu'aucune saison n'est active du tout", () => {
    const consultee = makeSaison({ id: "saison-1" });
    expect(isSeasonMismatch(consultee, null)).toBe(true);
  });
});

describe("isConsultationReadOnly", () => {
  it("false en ligne sur la saison active", () => {
    const saison = makeSaison();
    expect(isConsultationReadOnly(saison, saison, true)).toBe(false);
  });

  it("true en ligne sur une saison passée (délègue à isSeasonMismatch)", () => {
    const active = makeSaison({ id: "saison-2", nom: "2026-2027" });
    const consultee = makeSaison({ id: "saison-1", nom: "2025-2026" });
    expect(isConsultationReadOnly(consultee, active, true)).toBe(true);
  });

  it("true hors ligne même sur la saison active", () => {
    const saison = makeSaison();
    expect(isConsultationReadOnly(saison, saison, false)).toBe(true);
  });

  it("true hors ligne sur une saison passée (deux causes cumulées)", () => {
    const active = makeSaison({ id: "saison-2", nom: "2026-2027" });
    const consultee = makeSaison({ id: "saison-1", nom: "2025-2026" });
    expect(isConsultationReadOnly(consultee, active, false)).toBe(true);
  });

  it("true hors ligne même si aucune saison n'est encore consultée", () => {
    expect(isConsultationReadOnly(null, makeSaison(), false)).toBe(true);
  });
});
