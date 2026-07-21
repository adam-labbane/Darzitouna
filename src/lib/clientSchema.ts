import { z } from "zod";

const TUNISIAN_PHONE_REGEX = /^(\+216)?[2-9]\d{7}$/;

function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, "");
}

export const clientSchema = z.object({
  nom_complet: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),

  telephone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value === "" || TUNISIAN_PHONE_REGEX.test(value), {
      message: "Numéro tunisien invalide (8 chiffres, +216 optionnel)",
    })
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type ClientFormInput = z.infer<typeof clientSchema>;
