export function moveActiveIndex(current: number, length: number, direction: 1 | -1): number {
  if (length === 0) return -1;
  const next = current + direction;
  if (next < 0) return length - 1;
  if (next >= length) return 0;
  return next;
}
