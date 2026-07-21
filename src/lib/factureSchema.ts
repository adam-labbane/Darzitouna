// src/lib/factureSchema.ts
//
// Validation de la création de facture (OWASP — ne jamais faire confiance
// à une entrée non validée, même si set_facture_derived_fields revalide
// et dérive tout côté base). V1 simple (voir décision 1 du module) : une
// facture = un pressage, donc un seul champ à valider.
import { z } from "zod";

export const factureSchema = z.object({
  pressage_id: z.string().min(1, "Sélectionnez un pressage à facturer"),
});

export type FactureFormInput = z.infer<typeof factureSchema>;
