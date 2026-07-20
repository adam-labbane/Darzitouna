// src/lib/clientSchema.ts
//
// Validation des entrées du formulaire client (OWASP A03/A04 — injection &
// design non sécurisé : ne jamais faire confiance à une entrée utilisateur
// sans la valider). Cette validation est une première ligne de défense côté
// client ; la base de données reste la deuxième (colonnes NOT NULL, RLS,
// trigger protect_client_archiving) — voir l'explication "défense en
// profondeur" fournie avec ce module.
import { z } from "zod";

// Numéro tunisien : 8 chiffres commençant par 2-9 (les numéros locaux ne
// commencent pas par 0/1), avec un préfixe +216 optionnel. On reste
// volontairement permissif sur les préfixes d'opérateur : le but est
// d'attraper les erreurs de saisie grossières, pas de valider un plan de
// numérotation exhaustif.
const TUNISIAN_PHONE_REGEX = /^(\+216)?[2-9]\d{7}$/;

// Retire espaces, points et tirets typiques d'une saisie humaine
// ("20 123 456", "20-123-456") avant de tester le format.
function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, "");
}

export const clientSchema = z.object({
  nom_complet: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),

  // Optionnel : une chaîne vide ou absente est valide. Si une valeur est
  // fournie, elle doit respecter le format tunisien après nettoyage.
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
