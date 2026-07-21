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
