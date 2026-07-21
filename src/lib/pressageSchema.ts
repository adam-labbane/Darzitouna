import { z } from "zod";

export const TYPES_HUILE = ["EXTRA", "VIERGE", "LAMPANTE"] as const;

export const pressageSchema = z
  .object({
    depot_id: z.string().min(1, "Sélectionnez un dépôt"),
    cuve_id: z.string().min(1, "Sélectionnez une cuve"),
    quantite_huile_kg: z.number().positive("La quantité d'huile doit être supérieure à 0"),
    type_huile: z.enum(TYPES_HUILE),

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
