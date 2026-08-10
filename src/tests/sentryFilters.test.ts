import { describe, expect, it } from "vitest";
import {
  isNetworkError,
  resolveEnvironment,
  shouldReportEvent,
} from "../lib/sentryFilters";

describe("isNetworkError", () => {
  it.each([
    ["TypeError", "Failed to fetch"],
    ["TypeError", "NetworkError when attempting to fetch resource."],
    ["TypeError", "Load failed"],
    ["TypeError", "The network connection was lost."],
    ["TypeError", "Network request failed"],
    ["AuthRetryableFetchError", "Failed to fetch"],
  ])("reconnaît %s : %s", (name, message) => {
    expect(isNetworkError({ name, message })).toBe(true);
  });

  it("ignore la casse du message", () => {
    expect(isNetworkError({ name: "TypeError", message: "FAILED TO FETCH" })).toBe(true);
  });

  it("reconnaît une erreur sans nom, sérialisée ou issue d'un rejet non typé", () => {
    expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isNetworkError({ name: null, message: "Failed to fetch" })).toBe(true);
  });

  it("ne classe pas un bug applicatif comme une erreur réseau", () => {
    expect(
      isNetworkError({
        name: "Error",
        message: "Minified React error #527",
      }),
    ).toBe(false);
    expect(isNetworkError({ name: "TypeError", message: "x is not a function" })).toBe(false);
  });

  it("ne se fie pas au seul nom TypeError", () => {
    expect(isNetworkError({ name: "TypeError", message: "Cannot read properties of null" })).toBe(
      false,
    );
  });

  it("tolère un message absent", () => {
    expect(isNetworkError({})).toBe(false);
  });
});

describe("shouldReportEvent", () => {
  const networkError = { name: "TypeError", message: "Failed to fetch" };
  const applicationError = { name: "Error", message: "Minified React error #527" };

  it("écarte une erreur réseau quand l'appareil est hors ligne", () => {
    expect(shouldReportEvent({ isOnline: false, error: networkError })).toBe(false);
  });

  it("remonte la MÊME erreur réseau quand l'appareil est en ligne", () => {
    expect(shouldReportEvent({ isOnline: true, error: networkError })).toBe(true);
  });

  it("remonte un bug applicatif même hors ligne", () => {
    expect(shouldReportEvent({ isOnline: false, error: applicationError })).toBe(true);
  });

  it("remonte un bug applicatif en ligne", () => {
    expect(shouldReportEvent({ isOnline: true, error: applicationError })).toBe(true);
  });

  it("remonte un événement sans signature d'erreur exploitable", () => {
    expect(shouldReportEvent({ isOnline: false, error: {} })).toBe(true);
  });
});

describe("resolveEnvironment", () => {
  it("classe le domaine de production", () => {
    expect(resolveEnvironment("darzitounas.com")).toBe("production");
    expect(resolveEnvironment("www.darzitounas.com")).toBe("production");
  });

  it("classe les previews Cloudflare Pages", () => {
    expect(resolveEnvironment("a1b2c3.dar-zitouna.pages.dev")).toBe("preview");
    expect(resolveEnvironment("dar-zitouna.pages.dev")).toBe("preview");
  });

  it("classe le développement local", () => {
    expect(resolveEnvironment("localhost")).toBe("local");
    expect(resolveEnvironment("127.0.0.1")).toBe("local");
  });

  it("ignore la casse du hostname", () => {
    expect(resolveEnvironment("DarZitounaS.com")).toBe("production");
    expect(resolveEnvironment("PREVIEW.PAGES.DEV")).toBe("preview");
  });
});
