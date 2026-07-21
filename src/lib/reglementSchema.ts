// src/lib/reglementSchema.ts
//
// Validation du formulaire de règlement. Défense en profondeur : doublée
// côté base par le trigger enforce_reglement_not_exceeding_solde et la
// contrainte CHECK reglement_montant_positive (migration
// 20260721140000_facturation.sql). `reste_du` n'est pas un champ envoyé
// au serveur : c'est un contexte de validation croisée (montant à ne pas
// dépasser), même pattern que poids_olives_kg/cuve_place_restante_l dans
// pressageSchema.ts.
import { z } from "zod";

export const MODES_REGLEMENT = ["ESPECES", "VIREMENT", "HUILE"] as const;

export const reglementSchema = z
  .object({
    montant: z.number().positive("Le montant doit être supérieur à 0"),
    mode: z.enum(MODES_REGLEMENT),
    // Chaîne vide normalisée en undefined (même traitement que
    // cuveSchema.ts pour emplacement).
    note: z
      .string()
      .trim()
      .max(200, "La note ne peut pas dépasser 200 caractères")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),

    // Contexte de validation croisée, pas un champ envoyé au serveur.
    reste_du: z.number(),
  })
  .superRefine((data, ctx) => {
    if (data.montant > data.reste_du) {
      ctx.addIssue({
        code: "custom",
        path: ["montant"],
        message: `Le montant ne peut pas dépasser le reste dû (${data.reste_du.toFixed(2)} DT)`,
      });
    }
  });

export type ReglementFormInput = z.infer<typeof reglementSchema>;
