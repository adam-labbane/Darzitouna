export function isValidTokenParam(token: string | undefined): token is string {
  return typeof token === "string" && token.trim().length > 0;
}

export function getPressageStatusLabel(estPresse: boolean): string {
  return estPresse ? "Pressage terminé" : "En attente de pressage";
}

export function getPressageStatusClasses(estPresse: boolean): string {
  return estPresse ? "bg-green-50 text-[#2D6A4F]" : "bg-amber-50 text-amber-700";
}

export function formatMontantDT(value: number): string {
  return `${value.toFixed(2)} DT`;
}
