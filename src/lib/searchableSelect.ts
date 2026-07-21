// src/lib/searchableSelect.ts
//
// Calcul pur de l'index actif lors de la navigation clavier (flèches)
// dans SearchableSelect.tsx — isolé de React pour être testable
// directement (C2.2.2). Boucle aux deux extrémités (dernier élément
// → premier avec ArrowDown, et inversement), comportement standard
// d'un combobox ARIA.
export function moveActiveIndex(current: number, length: number, direction: 1 | -1): number {
  if (length === 0) return -1;
  const next = current + direction;
  if (next < 0) return length - 1;
  if (next >= length) return 0;
  return next;
}
