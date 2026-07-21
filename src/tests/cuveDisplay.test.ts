import { describe, expect, it } from "vitest";
import {
  computeCorrectionDelta,
  computeFillPercentage,
  formatLiters,
  getFillColor,
  isCapacityReductionValid,
} from "../lib/cuveDisplay";

describe("computeFillPercentage", () => {
  it("calcule le pourcentage normal", () => {
    expect(computeFillPercentage(500, 1000)).toBe(50);
  });

  it("une cuve vide donne 0 %", () => {
    expect(computeFillPercentage(0, 1000)).toBe(0);
  });

  it("une cuve pleine donne 100 %", () => {
    expect(computeFillPercentage(1000, 1000)).toBe(100);
  });

  it("plafonne à 100 % même si niveau_actuel dépasse capacite_max", () => {
    expect(computeFillPercentage(1200, 1000)).toBe(100);
  });

  it("ne descend jamais sous 0 % (niveau négatif défensif)", () => {
    expect(computeFillPercentage(-50, 1000)).toBe(0);
  });

  it("renvoie 0 si la capacité est nulle ou négative (évite une division par 0)", () => {
    expect(computeFillPercentage(100, 0)).toBe(0);
  });
});

describe("getFillColor", () => {
  it("gris à 0 %", () => {
    expect(getFillColor(0)).toBe("gray");
  });

  it("rouge en dessous de 20 % (mais non vide)", () => {
    expect(getFillColor(15)).toBe("red");
  });

  it("orange à 49 %", () => {
    expect(getFillColor(49)).toBe("orange");
  });

  it("orange à la borne 20 %", () => {
    expect(getFillColor(20)).toBe("orange");
  });

  it("orange à la borne 50 %", () => {
    expect(getFillColor(50)).toBe("orange");
  });

  it("vert à 51 %", () => {
    expect(getFillColor(51)).toBe("green");
  });

  it("vert à 100 %", () => {
    expect(getFillColor(100)).toBe("green");
  });
});

describe("formatLiters", () => {
  const NARROW_NBSP = " ";

  it("formate avec séparateur de milliers français", () => {
    expect(formatLiters(1250)).toBe(`1${NARROW_NBSP}250 L`);
  });

  it("arrondit les décimales", () => {
    expect(formatLiters(999.6)).toBe(`1${NARROW_NBSP}000 L`);
  });

  it("formate 0 correctement", () => {
    expect(formatLiters(0)).toBe("0 L");
  });
});

describe("computeCorrectionDelta", () => {
  it("delta positif si le niveau réel est supérieur au niveau connu", () => {
    expect(computeCorrectionDelta(500, 550)).toBe(50);
  });

  it("delta négatif si le niveau réel est inférieur (évaporation...)", () => {
    expect(computeCorrectionDelta(500, 480)).toBe(-20);
  });

  it("delta nul si aucun écart", () => {
    expect(computeCorrectionDelta(500, 500)).toBe(0);
  });
});

describe("isCapacityReductionValid", () => {
  it("rejette une capacité inférieure au niveau actuel", () => {
    expect(isCapacityReductionValid(1000, 1500)).toBe(false);
  });

  it("accepte une capacité égale au niveau actuel", () => {
    expect(isCapacityReductionValid(1500, 1500)).toBe(true);
  });

  it("accepte une capacité supérieure au niveau actuel", () => {
    expect(isCapacityReductionValid(2000, 1500)).toBe(true);
  });
});
