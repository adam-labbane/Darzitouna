import { z } from "zod";

export const saisonSchema = z
  .object({
    nom: z.string().trim().min(1, "Le nom est obligatoire").max(50, "Le nom ne peut pas dépasser 50 caractères"),

    date_debut: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
    date_fin: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),

    config_prix_kilo_service: z.number().nonnegative("Le prix ne peut pas être négatif"),
  })
  .superRefine((data, ctx) => {
    if (data.date_debut && data.date_fin && data.date_debut >= data.date_fin) {
      ctx.addIssue({
        code: "custom",
        path: ["date_fin"],
        message: "La date de fin doit être postérieure à la date de début",
      });
    }
  });

export type SaisonFormInput = z.infer<typeof saisonSchema>;
