// src/components/ConfirmDialog.tsx
//
// Dialog de confirmation générique, réutilisable pour toute action
// destructive de l'app (archivage client, plus tard fournisseur/cuve...).
// La "double confirmation" demandée pour les actions destructives, c'est
// ce dialog lui-même : le bouton d'action déclenche l'ouverture (1ère
// intention), et il faut confirmer explicitement dedans (2e étape) — pas
// de suppression accidentelle en un seul clic.
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useFocusTrap(open, onCancel);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#1B4332] mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-gray-600 mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 min-w-[48px] px-5 rounded-xl border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-12 min-w-[48px] px-5 rounded-xl font-semibold text-white ${
              destructive ? "bg-[#E63946] hover:bg-red-700" : "bg-[#2D6A4F] hover:bg-green-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
