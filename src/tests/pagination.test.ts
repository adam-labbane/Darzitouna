import { describe, expect, it } from "vitest";
import { computePageCount, paginateItems } from "../lib/pagination";

describe("computePageCount", () => {
  it("retourne 1 pour une liste vide (au moins une page, même vide)", () => {
    expect(computePageCount(0, 20)).toBe(1);
  });

  it("calcule le nombre exact de pages pour un multiple de la taille de page", () => {
    expect(computePageCount(40, 20)).toBe(2);
  });

  it("arrondit au-dessus quand il reste un reliquat", () => {
    expect(computePageCount(41, 20)).toBe(3);
  });

  it("retourne 1 si pageSize est invalide (0 ou négatif)", () => {
    expect(computePageCount(50, 0)).toBe(1);
    expect(computePageCount(50, -5)).toBe(1);
  });
});

describe("paginateItems", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("découpe la première page", () => {
    expect(paginateItems(items, 1, 20)).toEqual(items.slice(0, 20));
  });

  it("découpe la dernière page partielle", () => {
    expect(paginateItems(items, 2, 20)).toEqual(items.slice(20, 25));
  });

  it("ramène une page trop grande à la dernière page existante", () => {
    expect(paginateItems(items, 99, 20)).toEqual(items.slice(20, 25));
  });

  it("ramène une page inférieure à 1 sur la première page", () => {
    expect(paginateItems(items, 0, 20)).toEqual(items.slice(0, 20));
  });

  it("renvoie toute la liste sur une seule page si elle tient dedans", () => {
    expect(paginateItems(items, 1, 100)).toEqual(items);
  });
});
