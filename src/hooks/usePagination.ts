// src/hooks/usePagination.ts
//
// Pagination côté client d'une liste déjà chargée. La page courante est
// dérivée (clampée entre 1 et pageCount) plutôt que synchronisée par un
// effect : si `items` rétrécit (ex. une recherche filtre la liste) alors
// que la page mémorisée est devenue trop grande, currentPage retombe
// automatiquement sans setState supplémentaire.
import { useState } from "react";
import { computePageCount, paginateItems } from "../lib/pagination";

const DEFAULT_PAGE_SIZE = 20;

export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = computePageCount(items.length, pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pageItems = paginateItems(items, currentPage, pageSize);

  return {
    pageItems,
    currentPage,
    pageCount,
    totalItems: items.length,
    goToPage: setPage,
  };
}
