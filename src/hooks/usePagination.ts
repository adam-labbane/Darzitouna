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
