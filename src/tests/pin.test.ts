import { describe, expect, it } from "vitest";
import { appendDigit, isPinComplete, PIN_LENGTH, removeLastDigit } from "../lib/pin";

describe("appendDigit", () => {
  it("ajoute un chiffre à un PIN vide", () => {
    expect(appendDigit("", "3")).toBe("3");
  });

  it("empile les chiffres dans l'ordre de saisie", () => {
    expect(appendDigit("12", "9")).toBe("129");
  });

  it("ignore la saisie au-delà de la longueur maximale", () => {
    expect(appendDigit("1234", "5")).toBe("1234");
  });

  it("ignore les caractères non numériques", () => {
    expect(appendDigit("12", "a")).toBe("12");
    expect(appendDigit("12", "")).toBe("12");
    expect(appendDigit("12", "10")).toBe("12");
  });
});

describe("removeLastDigit", () => {
  it("retire le dernier chiffre saisi", () => {
    expect(removeLastDigit("123")).toBe("12");
  });

  it("ne casse pas sur un PIN déjà vide", () => {
    expect(removeLastDigit("")).toBe("");
  });
});

describe("isPinComplete", () => {
  it("est faux tant que la longueur attendue n'est pas atteinte", () => {
    expect(isPinComplete("")).toBe(false);
    expect(isPinComplete("123")).toBe(false);
  });

  it("est vrai une fois PIN_LENGTH chiffres saisis", () => {
    expect(isPinComplete("1".repeat(PIN_LENGTH))).toBe(true);
  });
});
