import { z } from "zod";

export const TYPES_HUILE = ["EXTRA", "VIERGE", "LAMPANTE"] as const;

export const cuveSchema = z.object({
  nom_reference: z
    .string()
    .trim()
    .min(1, "La référence est obligatoire")
    .max(50, "La référence ne peut pas dépasser 50 caractères"),
  emplacement: z
    .string()
    .trim()
    .max(100, "L'emplacement ne peut pas dépasser 100 caractères")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  type_huile: z.enum(TYPES_HUILE),
  capacite_max: z.number().positive("La capacité doit être supérieure à 0"),
});

export type CuveFormInput = z.infer<typeof cuveSchema>;
