// src/lib/cuveSchema.ts
//
// Validation du formulaire cuve (création/édition). Défense en profondeur :
// doublée côté base par les contraintes CHECK cuve_capacite_max_positive et
// cuve_niveau_within_capacity (migration 20260721090000_cuve_stock_safety.sql).
import { z } from "zod";

export const TYPES_HUILE = ["EXTRA", "VIERGE", "LAMPANTE"] as const;

export const cuveSchema = z.object({
  nom_reference: z
    .string()
    .trim()
    .min(1, "La référence est obligatoire")
    .max(50, "La référence ne peut pas dépasser 50 caractères"),
  // Chaîne vide normalisée en undefined (même traitement que
  // clientSchema.ts pour telephone) : un champ optionnel laissé vide ne
  // doit pas être stocké comme "" plutôt que null.
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
