interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 py-4">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="min-h-[48px] px-4 rounded-lg border-2 border-gray-200 font-semibold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors motion-reduce:transition-none"
      >
        Précédent
      </button>
      <p className="text-sm text-gray-500 min-w-[90px] text-center" aria-live="polite">
        Page {currentPage} / {pageCount}
      </p>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
        className="min-h-[48px] px-4 rounded-lg border-2 border-gray-200 font-semibold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors motion-reduce:transition-none"
      >
        Suivant
      </button>
    </nav>
  );
}
