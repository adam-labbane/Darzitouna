import { z } from "zod";

export const MODES_REGLEMENT = ["ESPECES", "VIREMENT", "HUILE"] as const;

export const reglementSchema = z
  .object({
    montant: z.number().positive("Le montant doit être supérieur à 0"),
    mode: z.enum(MODES_REGLEMENT),
    note: z
      .string()
      .trim()
      .max(200, "La note ne peut pas dépasser 200 caractères")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),

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
