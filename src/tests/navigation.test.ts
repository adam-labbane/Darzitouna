import { describe, expect, it } from "vitest";
import { getVisibleMenuItems, MENU_ITEMS } from "../lib/navigation";

describe("getVisibleMenuItems", () => {
  it("affiche Configuration pour un GERANT", () => {
    const items = getVisibleMenuItems("GERANT");
    expect(items.some((item) => item.path === "/config")).toBe(true);
    expect(items).toHaveLength(MENU_ITEMS.length);
  });

  it("masque Configuration pour un OPERATEUR", () => {
    const items = getVisibleMenuItems("OPERATEUR");
    expect(items.some((item) => item.path === "/config")).toBe(false);
    expect(items).toHaveLength(MENU_ITEMS.length - 1);
  });

  it("masque Configuration si le rôle est inconnu/absent", () => {
    const items = getVisibleMenuItems(undefined);
    expect(items.some((item) => item.path === "/config")).toBe(false);
  });

  it("ne filtre aucune autre entrée que Configuration", () => {
    const operateurItems = getVisibleMenuItems("OPERATEUR").map((item) => item.path);
    expect(operateurItems).toEqual([
      "/dashboard",
      "/depots",
      "/pressages",
      "/clients",
      "/stocks",
      "/factures",
      "/grignons",
    ]);
  });
});
