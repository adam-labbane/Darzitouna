// src/components/CuveCorrectionModal.tsx
//
// Correction manuelle du niveau d'une cuve — réservée au GERANT (le
// parent, Stocks.tsx, ne rend ce composant que pour ce rôle ; la vraie
// protection est le trigger enforce_correction_role côté base, voir
// supabase/migrations/20260721090000_cuve_stock_safety.sql). L'opérateur
// saisit le niveau RÉELLEMENT constaté (pas un delta) : le delta à
// envoyer est calculé pour lui, en clair, avant validation.
import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { computeCorrectionDelta, formatLiters } from "../lib/cuveDisplay";
import type { Cuve } from "../types/cuve";

interface CuveCorrectionModalProps {
  cuve: Cuve;
  onSubmit: (data: { newLevel: number; raison: string }) => Promise<void>;
  onClose: () => void;
}

export default function CuveCorrectionModal({ cuve, onSubmit, onClose }: CuveCorrectionModalProps) {
  const dialogRef = useFocusTrap(true, onClose);

  const [newLevelInput, setNewLevelInput] = useState(String(cuve.niveau_actuel));
  const [raison, setRaison] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const newLevelNum = Number(newLevelInput);
  const newLevelValid =
    newLevelInput !== "" && !Number.isNaN(newLevelNum) && newLevelNum >= 0 && newLevelNum <= cuve.capacite_max;
  const delta = newLevelValid ? computeCorrectionDelta(cuve.niveau_actuel, newLevelNum) : 0;
  const raisonValid = raison.trim() !== "";
  const canSubmit = newLevelValid && raisonValid;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit({ newLevel: newLevelNum, raison: raison.trim() });
    } catch {
      setFormError("Impossible d'enregistrer la correction. Vérifiez votre connexion.");
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
        aria-labelledby="cuve-correction-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cuve-correction-title" className="text-lg font-bold text-[#1B4332] mb-1">
          Corriger le niveau — {cuve.nom_reference}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Niveau actuellement enregistré : {formatLiters(cuve.niveau_actuel)}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-2">
            <label htmlFor="correction-niveau" className="block text-sm font-medium text-gray-600 mb-1">
              Niveau réel constaté (L)
            </label>
            <input
              id="correction-niveau"
              type="number"
              inputMode="decimal"
              step="1"
              value={newLevelInput}
              onChange={(event) => setNewLevelInput(event.target.value)}
              aria-invalid={newLevelInput !== "" && !newLevelValid}
              aria-describedby={newLevelInput !== "" && !newLevelValid ? "correction-niveau-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono text-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {newLevelInput !== "" && !newLevelValid && (
              <p id="correction-niveau-error" role="alert" className="text-[#E63946] text-sm mt-1">
                Le niveau doit être compris entre 0 et {formatLiters(cuve.capacite_max)}.
              </p>
            )}
          </div>

          {newLevelValid && delta !== 0 && (
            <p
              className={`text-sm font-semibold mb-4 ${delta > 0 ? "text-[#2D6A4F]" : "text-[#E63946]"}`}
            >
              Correction : {delta > 0 ? "+" : ""}
              {formatLiters(delta)}
            </p>
          )}

          <div className="mb-6">
            <label htmlFor="correction-raison" className="block text-sm font-medium text-gray-600 mb-1">
              Raison
            </label>
            <textarea
              id="correction-raison"
              value={raison}
              onChange={(event) => setRaison(event.target.value)}
              rows={3}
              placeholder="Ex : évaporation constatée à l'inventaire physique"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none resize-none"
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
              disabled={submitting || !canSubmit}
              className="h-12 min-w-[48px] px-5 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : "Corriger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
