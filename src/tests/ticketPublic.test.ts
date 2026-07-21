import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTicketPublic } from "../lib/ticketPublic";

function mockClient(rpc: SupabaseClient["rpc"]): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

const validRow = {
  numero_ticket: "TK-2026-0001",
  date_depot: "2026-09-15T10:00:00.000Z",
  poids_olives_kg: 120.5,
  est_presse: false,
  quantite_huile_kg: null,
  rendement_final: null,
  type_huile: null,
  huilerie_nom: "Huilerie Labbane",
  montant_total: null,
  montant_paye: null,
  reste_du: null,
};

describe("getTicketPublic", () => {
  it("appelle get_ticket_public avec le token et renvoie la ligne validée", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [validRow], error: null });

    const ticket = await getTicketPublic(mockClient(rpc), "abc123");

    expect(rpc).toHaveBeenCalledWith("get_ticket_public", { p_token: "abc123" });
    expect(ticket).toEqual(validRow);
  });

  it("renvoie null si data est un tableau vide (token inconnu)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const ticket = await getTicketPublic(mockClient(rpc), "unknown-token");
    expect(ticket).toBeNull();
  });

  it("renvoie null si data est null", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const ticket = await getTicketPublic(mockClient(rpc), "unknown-token");
    expect(ticket).toBeNull();
  });

  it("mappe correctement un dépôt pressé avec le volet financier", async () => {
    const pressedRow = {
      ...validRow,
      est_presse: true,
      quantite_huile_kg: 22.4,
      rendement_final: 18.6,
      type_huile: "EXTRA",
      montant_total: 30,
      montant_paye: 10,
      reste_du: 20,
    };
    const rpc = vi.fn().mockResolvedValue({ data: [pressedRow], error: null });

    const ticket = await getTicketPublic(mockClient(rpc), "abc123");

    expect(ticket).toEqual(pressedRow);
  });

  it("propage l'erreur Supabase sans l'avaler silencieusement", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("network") });
    await expect(getTicketPublic(mockClient(rpc), "abc123")).rejects.toThrow("network");
  });

  it("rejette si la ligne renvoyée ne respecte pas le schéma attendu", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ numero_ticket: "TK-2026-0001" }],
      error: null,
    });
    await expect(getTicketPublic(mockClient(rpc), "abc123")).rejects.toThrow();
  });
});
