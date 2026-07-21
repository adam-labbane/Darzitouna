import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const ticketPublicSchema = z.object({
  numero_ticket: z.string(),
  date_depot: z.string(),
  poids_olives_kg: z.number(),
  est_presse: z.boolean(),
  quantite_huile_kg: z.number().nullable(),
  rendement_final: z.number().nullable(),
  type_huile: z.enum(["EXTRA", "VIERGE", "LAMPANTE"]).nullable(),
  huilerie_nom: z.string(),
  montant_total: z.number().nullable(),
  montant_paye: z.number().nullable(),
  reste_du: z.number().nullable(),
});

export type TicketPublic = z.infer<typeof ticketPublicSchema>;

export async function getTicketPublic(client: SupabaseClient, token: string): Promise<TicketPublic | null> {
  const { data, error } = await client.rpc("get_ticket_public", { p_token: token });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return ticketPublicSchema.parse(data[0]);
}
