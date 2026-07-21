import type { StatutPaiement } from "../types/depot";

export function computeNetWeight(poidsBrutKg: number, poidsTareKg: number): number {
  return poidsBrutKg - poidsTareKg;
}

export function computeTotalAmount(prixUnitaire: number, poidsNetKg: number): number {
  return prixUnitaire * poidsNetKg;
}

export function computeRemainingDue(montantTotal: number, montantPaye: number): number {
  return montantTotal - montantPaye;
}

export function computePaymentStatus(montantTotal: number, montantPaye: number): StatutPaiement {
  if (montantPaye <= 0) return "NON_PAYE";
  if (montantPaye >= montantTotal) return "PAYE";
  return "PARTIEL";
}
