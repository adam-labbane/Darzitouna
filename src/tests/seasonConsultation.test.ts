// src/tests/seasonConsultation.test.ts
import { describe, expect, it } from "vitest";
import { isConsultationReadOnly } from "../lib/seasonConsultation";
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

describe("isConsultationReadOnly", () => {
  it("false si aucune saison n'est consultée (état pas encore résolu)", () => {
    expect(isConsultationReadOnly(null, makeSaison())).toBe(false);
  });

  it("false si la saison consultée est la saison active (mode de travail normal)", () => {
    const saison = makeSaison();
    expect(isConsultationReadOnly(saison, saison)).toBe(false);
  });

  it("false si la saison consultée a le même id que l'active (objets distincts)", () => {
    const active = makeSaison({ id: "saison-1" });
    const consultee = makeSaison({ id: "saison-1", nom: "copie" });
    expect(isConsultationReadOnly(consultee, active)).toBe(false);
  });

  it("true si la saison consultée diffère de la saison active", () => {
    const active = makeSaison({ id: "saison-2", nom: "2026-2027" });
    const consultee = makeSaison({ id: "saison-1", nom: "2025-2026" });
    expect(isConsultationReadOnly(consultee, active)).toBe(true);
  });

  it("true si une saison est consultée mais qu'aucune saison n'est active du tout", () => {
    const consultee = makeSaison({ id: "saison-1" });
    expect(isConsultationReadOnly(consultee, null)).toBe(true);
  });
});
