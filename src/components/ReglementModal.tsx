// src/components/ReglementModal.tsx
//
// Enregistrement d'un règlement sur une facture — même pattern que
// CuveFormModal/PressageModal (rendu conditionnel par le parent,
// useFocusTrap, validation Zod au submit). Montant total / déjà payé /
// reste dû toujours affichés en clair (pas seulement calculés en
// silence), cartes de mode façon boutons aria-pressed (même pattern que
// l'étape 3 de DepotNouveau.tsx pour Prestation/Achat).
import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { computeResteDu } from "../lib/factureCalculations";
import { MODES_REGLEMENT, reglementSchema } from "../lib/reglementSchema";
import type { ModeReglement, Reglement } from "../types/reglement";

const MODE_LABELS: Record<ModeReglement, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  HUILE: "Huile",
};

interface ReglementModalProps {
  montantTtc: number;
  reglements: Reglement[];
  onSubmit: (data: { montant: number; mode: ModeReglement; note?: string }) => Promise<void>;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"montant" | "mode", string>>;

export default function ReglementModal({ montantTtc, reglements, onSubmit, onClose }: ReglementModalProps) {
  const dialogRef = useFocusTrap(true, onClose);

  const dejaRegle = reglements.reduce((sum, r) => sum + r.montant, 0);
  const resteDu = computeResteDu(montantTtc, reglements);

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ModeReglement>("ESPECES");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = reglementSchema.safeParse({
      montant: Number(montant),
      mode,
      note,
      reste_du: resteDu,
    });

    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "montant" || key === "mode") errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({ montant: result.data.montant, mode: result.data.mode, note: result.data.note });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer ce règlement. Vérifiez votre connexion.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reglement-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reglement-form-title" className="text-lg font-bold text-[#1B4332] mb-4">
          Enregistrer un règlement
        </h2>

        <dl className="bg-[#F7F8FA] rounded-xl p-4 mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Montant total</dt>
            <dd className="font-mono font-semibold">{montantTtc.toFixed(2)} DT</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Déjà payé</dt>
            <dd className="font-mono font-semibold">{dejaRegle.toFixed(2)} DT</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Reste dû</dt>
            <dd className="font-mono font-bold text-[#E63946]">{resteDu.toFixed(2)} DT</dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <span className="block text-sm font-medium text-gray-600 mb-2" id="reglement-mode-label">
              Mode de règlement
            </span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="reglement-mode-label">
              {MODES_REGLEMENT.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={`h-16 rounded-xl border-2 font-semibold text-sm ${
                    mode === option
                      ? "border-[#2D6A4F] bg-green-50 text-[#1B4332]"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {MODE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="reglement-montant" className="block text-sm font-medium text-gray-600 mb-1">
              Montant (DT)
            </label>
            <input
              id="reglement-montant"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={montant}
              onChange={(event) => setMontant(event.target.value)}
              aria-invalid={Boolean(fieldErrors.montant)}
              aria-describedby={fieldErrors.montant ? "reglement-montant-error" : undefined}
              className="w-full h-14 px-4 text-xl border-2 border-gray-200 rounded-xl font-mono focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.montant && (
              <p id="reglement-montant-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.montant}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="reglement-note" className="block text-sm font-medium text-gray-600 mb-1">
              Note <span className="text-gray-400 font-normal">(optionnel — ex. litres équivalents pour un paiement en huile)</span>
            </label>
            <input
              id="reglement-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>

          {formError && (
            <p role="alert" className="text-[#E63946] text-sm mb-4 text-center">
              {formError}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-12 min-w-[48px] px-5 rounded-xl border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || resteDu <= 0}
              className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
