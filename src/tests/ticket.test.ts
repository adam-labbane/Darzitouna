import { describe, expect, it } from "vitest";
import { buildTicketData } from "../lib/ticket";
import type { Depot } from "../types/depot";

const basePrestationDepot: Depot = {
  id: "depot-1",
  saison_id: "saison-1",
  client_id: "client-1",
  user_id: "user-1",
  numero_ticket: "TK-2026-0001",
  date_depot: "2026-07-20T10:00:00.000Z",
  poids_olives_kg: 85,
  ref_bac: null,
  is_achat_olives: false,
  prix_achat_unitaire: null,
  statut_paiement_achat: "NON_PAYE",
  montant_paye_achat: 0,
  token_public: "a1b2c3d4e5f6",
};

describe("buildTicketData", () => {
  it("reprend le numéro de ticket, la date et le poids net du dépôt", () => {
    const ticket = buildTicketData(basePrestationDepot, "Ali Ben Salah", "Huilerie Mohamed");

    expect(ticket.numeroTicket).toBe("TK-2026-0001");
    expect(ticket.dateDepotIso).toBe("2026-07-20T10:00:00.000Z");
    expect(ticket.poidsNetKg).toBe(85);
    expect(ticket.clientNom).toBe("Ali Ben Salah");
    expect(ticket.huilerieNom).toBe("Huilerie Mohamed");
    expect(ticket.tokenPublic).toBe("a1b2c3d4e5f6");
  });

  it("n'inclut pas de montant pour une prestation", () => {
    const ticket = buildTicketData(basePrestationDepot, "Ali Ben Salah", "Huilerie Mohamed");
    expect(ticket.isAchat).toBe(false);
    expect(ticket.montantTotal).toBeUndefined();
  });

  it("calcule le montant total pour un achat (prix × poids net)", () => {
    const achatDepot: Depot = {
      ...basePrestationDepot,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
    };

    const ticket = buildTicketData(achatDepot, "Ali Ben Salah", "Huilerie Mohamed");
    expect(ticket.isAchat).toBe(true);
    expect(ticket.montantTotal).toBeCloseTo(68);
  });
});
