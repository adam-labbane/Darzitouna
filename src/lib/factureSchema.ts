import { z } from "zod";

export const factureSchema = z.object({
  pressage_id: z.string().min(1, "Sélectionnez un pressage à facturer"),
});

export type FactureFormInput = z.infer<typeof factureSchema>;
