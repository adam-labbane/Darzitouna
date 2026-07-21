// src/tests/searchableSelect.test.ts
import { describe, expect, it } from "vitest";
import { moveActiveIndex } from "../lib/searchableSelect";

describe("moveActiveIndex", () => {
  it("retourne -1 si la liste est vide, quelle que soit la direction", () => {
    expect(moveActiveIndex(-1, 0, 1)).toBe(-1);
    expect(moveActiveIndex(2, 0, -1)).toBe(-1);
  });

  it("avance d'un cran vers le bas", () => {
    expect(moveActiveIndex(0, 3, 1)).toBe(1);
  });

  it("recule d'un cran vers le haut", () => {
    expect(moveActiveIndex(1, 3, -1)).toBe(0);
  });

  it("boucle du dernier au premier élément avec ArrowDown", () => {
    expect(moveActiveIndex(2, 3, 1)).toBe(0);
  });

  it("boucle du premier au dernier élément avec ArrowUp", () => {
    expect(moveActiveIndex(0, 3, -1)).toBe(2);
  });

  it("part de -1 (rien de survolé) vers le premier élément avec ArrowDown", () => {
    expect(moveActiveIndex(-1, 3, 1)).toBe(0);
  });

  it("part de -1 (rien de survolé) vers le dernier élément avec ArrowUp", () => {
    expect(moveActiveIndex(-1, 3, -1)).toBe(2);
  });
});
