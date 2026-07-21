// src/lib/pagination.ts
//
// Pagination côté client, pure et testable (C2.2.2) — appliquée aux
// listes déjà chargées (bornées par la saison consultée) qui peuvent
// devenir longues (clients, dépôts, factures, pressages). Pas de
// nouvelle requête offset/limit : un changement de portée plus large
// que nécessaire pour un gain non démontré ici.
export function computePageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const pageCount = computePageCount(items.length, pageSize);
  const clampedPage = Math.min(Math.max(1, page), pageCount);
  const start = (clampedPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
