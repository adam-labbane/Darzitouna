// src/lib/personnelSchema.ts
//
// Validation du formulaire personnel (OWASP). Défense en profondeur :
// doublée côté base par create_utilisateur()/reset_utilisateur_pin()
// (migration 20260721150000_configuration.sql), qui revalident le
// format du PIN indépendamment de ce schéma.
import { z } from "zod";

export const ROLES = ["GERANT", "OPERATEUR"] as const;

// Source unique du format PIN — réutilisé par la création et la
// réinitialisation, pour ne jamais faire diverger la règle.
export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "Le code PIN doit comporter exactement 4 chiffres");

export const personnelSchema = z.object({
  nom_complet: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  role: z.enum(ROLES),
});

export const personnelCreateSchema = personnelSchema.extend({ pin: pinSchema });

export type PersonnelFormInput = z.infer<typeof personnelSchema>;
export type PersonnelCreateInput = z.infer<typeof personnelCreateSchema>;
