import type { StatutPaiement } from "../types/depot";

export const STATUT_LABELS: Record<StatutPaiement, string> = {
  NON_PAYE: "Non payé",
  PARTIEL: "Partiel",
  PAYE: "Payé",
};

export const STATUT_COLOR_HEX: Record<StatutPaiement, string> = {
  NON_PAYE: "#E63946",
  PARTIEL: "#F59E0B",
  PAYE: "#2D6A4F",
};

export function computeMontantTotal(montantsPressages: number[]): number {
  const total = montantsPressages.reduce((sum, m) => sum + m, 0);
  return Math.round(total * 100) / 100;
}

export function computeResteDu(montantTotal: number, reglements: { montant: number }[]): number {
  const dejaRegle = reglements.reduce((sum, r) => sum + r.montant, 0);
  const reste = Math.round((montantTotal - dejaRegle) * 100) / 100;
  return Math.max(0, reste);
}

export function getStatutLabel(statut: StatutPaiement): string {
  return STATUT_LABELS[statut];
}

export function getStatutColor(statut: StatutPaiement): string {
  return STATUT_COLOR_HEX[statut];
}
