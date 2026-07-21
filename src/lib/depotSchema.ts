import { z } from "zod";
import { computeNetWeight, computeTotalAmount } from "./depotCalculations";

export const depotSchema = z
  .object({
    client_id: z.string().min(1, "Sélectionnez un client"),

    poids_brut_kg: z.number().positive("Le poids brut doit être supérieur à 0"),
    poids_tare_kg: z.number().nonnegative("La tare ne peut pas être négative"),

    ref_bac: z.string().trim().max(50).optional(),

    is_achat_olives: z.boolean(),

    prix_achat_unitaire: z.number().positive("Le prix doit être supérieur à 0").optional(),
    montant_paye_achat: z.number().nonnegative("Le montant payé ne peut pas être négatif").optional(),
  })
  .superRefine((data, ctx) => {
    const tareValide = data.poids_tare_kg < data.poids_brut_kg;
    if (!tareValide) {
      ctx.addIssue({
        code: "custom",
        path: ["poids_tare_kg"],
        message: "La tare doit être inférieure au poids brut",
      });
    }

    if (!data.is_achat_olives) return;

    if (data.prix_achat_unitaire === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["prix_achat_unitaire"],
        message: "Le prix d'achat au kilo est requis pour un achat",
      });
    }

    if (data.montant_paye_achat === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["montant_paye_achat"],
        message: "Indiquez le montant payé (0 si le paiement est différé)",
      });
      return;
    }

    if (tareValide && data.prix_achat_unitaire !== undefined) {
      const poidsNet = computeNetWeight(data.poids_brut_kg, data.poids_tare_kg);
      const montantTotal = computeTotalAmount(data.prix_achat_unitaire, poidsNet);
      if (data.montant_paye_achat > montantTotal) {
        ctx.addIssue({
          code: "custom",
          path: ["montant_paye_achat"],
          message: "Le montant payé ne peut pas dépasser le montant total",
        });
      }
    }
  });

export type DepotFormInput = z.infer<typeof depotSchema>;
