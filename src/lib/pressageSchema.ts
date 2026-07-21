// src/lib/pressageSchema.ts
//
// Validation du formulaire de clôture de pressage (OWASP — ne jamais
// faire confiance à une saisie non validée, même si le trigger
// update_cuve_stock et la fonction create_pressage revalident tout côté
// base). poids_olives_kg et cuve_place_restante_l ne sont pas des champs
// du formulaire : ce sont des données de contexte (dépôt et cuve
// sélectionnés) transmises par PressageModal pour la validation croisée,
// jamais envoyées telles quelles au RPC create_pressage.
//
// Simplification assumée (déjà implicite dans tout le MCD) : cuve.capacite_max
// et pressage.quantite_huile_kg partagent la même unité numérique sans
// conversion de densité (kg d'huile ≈ L de cuve) — aucune table du schéma
// ne modélise la densité de l'huile, ce n'est pas une omission de ce module.
import { z } from "zod";

export const TYPES_HUILE = ["EXTRA", "VIERGE", "LAMPANTE"] as const;

export const pressageSchema = z
  .object({
    depot_id: z.string().min(1, "Sélectionnez un dépôt"),
    cuve_id: z.string().min(1, "Sélectionnez une cuve"),
    quantite_huile_kg: z.number().positive("La quantité d'huile doit être supérieure à 0"),
    type_huile: z.enum(TYPES_HUILE),

    // Contexte de validation croisée, pas des champs à envoyer au RPC.
    poids_olives_kg: z.number().positive(),
    cuve_place_restante_l: z.number(),
  })
  .superRefine((data, ctx) => {
    if (data.quantite_huile_kg > data.poids_olives_kg) {
      ctx.addIssue({
        code: "custom",
        path: ["quantite_huile_kg"],
        message: "La quantité d'huile ne peut pas dépasser le poids d'olives du dépôt",
      });
    }

    if (data.quantite_huile_kg > data.cuve_place_restante_l) {
      ctx.addIssue({
        code: "custom",
        path: ["cuve_id"],
        message: `Cette cuve n'a pas assez de place (${data.cuve_place_restante_l} L restants)`,
      });
    }
  });

export type PressageFormInput = z.infer<typeof pressageSchema>;
