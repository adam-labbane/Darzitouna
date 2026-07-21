import { useMemo, useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  computeMontantService,
  computeRendement,
  getRendementColor,
  RENDEMENT_COLOR_HEX,
  RENDEMENT_COLOR_LABELS,
} from "../lib/pressageCalculations";
import { pressageSchema, TYPES_HUILE } from "../lib/pressageSchema";
import { TYPE_HUILE_LABELS, formatLiters } from "../lib/cuveDisplay";
import type { DepotEnAttente } from "../lib/pressages";
import type { Cuve, TypeHuile } from "../types/cuve";

interface PressageModalProps {
  depot: DepotEnAttente;
  cuves: Cuve[];
  prixKiloService: number | null;
  onSubmit: (data: { cuve_id: string; quantite_huile_kg: number; type_huile: TypeHuile }) => Promise<void>;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"quantite_huile_kg" | "cuve_id" | "type_huile", string>>;

export default function PressageModal({
  depot,
  cuves,
  prixKiloService,
  onSubmit,
  onClose,
}: PressageModalProps) {
  const dialogRef = useFocusTrap(true, onClose);

  const [quantiteHuile, setQuantiteHuile] = useState("");
  const [typeHuile, setTypeHuile] = useState<TypeHuile>("VIERGE");
  const [cuveId, setCuveId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const quantiteHuileNum = Number(quantiteHuile);
  const rendement = useMemo(
    () => (quantiteHuile !== "" ? computeRendement(quantiteHuileNum, depot.poids_olives_kg) : null),
    [quantiteHuile, quantiteHuileNum, depot.poids_olives_kg],
  );
  const rendementColor = rendement !== null ? getRendementColor(rendement) : null;

  const montantPreview = computeMontantService(
    depot.poids_olives_kg,
    prixKiloService ?? 0,
    depot.is_achat_olives,
  );

  const selectedCuve = cuves.find((cuve) => cuve.id === cuveId) ?? null;
  const placeRestante = selectedCuve ? selectedCuve.capacite_max - selectedCuve.niveau_actuel : 0;
  const typeMismatch = Boolean(selectedCuve && selectedCuve.type_huile !== typeHuile);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = pressageSchema.safeParse({
      depot_id: depot.id,
      cuve_id: cuveId,
      quantite_huile_kg: quantiteHuileNum,
      type_huile: typeHuile,
      poids_olives_kg: depot.poids_olives_kg,
      cuve_place_restante_l: placeRestante,
    });

    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "quantite_huile_kg" || key === "cuve_id" || key === "type_huile") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        cuve_id: result.data.cuve_id,
        quantite_huile_kg: result.data.quantite_huile_kg,
        type_huile: result.data.type_huile,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer ce pressage. Vérifiez votre connexion.",
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
        aria-labelledby="pressage-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="pressage-form-title" className="text-lg font-bold text-[#1B4332] mb-1">
          Clôturer le pressage
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {depot.numero_ticket} — {depot.client?.nom_complet ?? "Client inconnu"} —{" "}
          {depot.poids_olives_kg.toFixed(2)} kg d'olives
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="pressage-huile" className="block text-sm font-medium text-gray-600 mb-1">
              Quantité d'huile obtenue (kg)
            </label>
            <input
              id="pressage-huile"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={quantiteHuile}
              onChange={(event) => setQuantiteHuile(event.target.value)}
              aria-invalid={Boolean(fieldErrors.quantite_huile_kg)}
              aria-describedby={
                fieldErrors.quantite_huile_kg ? "pressage-huile-error" : "pressage-rendement"
              }
              className="w-full h-14 px-4 text-xl border-2 border-gray-200 rounded-xl font-mono focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.quantite_huile_kg && (
              <p id="pressage-huile-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.quantite_huile_kg}
              </p>
            )}

            {rendement !== null && rendementColor && (
              <p id="pressage-rendement" className="mt-2 text-sm font-semibold">
                Rendement :{" "}
                <span style={{ color: RENDEMENT_COLOR_HEX[rendementColor] }}>
                  {rendement.toFixed(2)} % — {RENDEMENT_COLOR_LABELS[rendementColor]}
                </span>
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="pressage-type" className="block text-sm font-medium text-gray-600 mb-1">
              Type d'huile obtenu
            </label>
            <select
              id="pressage-type"
              value={typeHuile}
              onChange={(event) => setTypeHuile(event.target.value as TypeHuile)}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none bg-white"
            >
              {TYPES_HUILE.map((type) => (
                <option key={type} value={type}>
                  {TYPE_HUILE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="pressage-cuve" className="block text-sm font-medium text-gray-600 mb-1">
              Cuve de destination
            </label>
            <select
              id="pressage-cuve"
              value={cuveId}
              onChange={(event) => setCuveId(event.target.value)}
              aria-invalid={Boolean(fieldErrors.cuve_id)}
              aria-describedby={fieldErrors.cuve_id ? "pressage-cuve-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none bg-white"
            >
              <option value="">Sélectionnez une cuve</option>
              {cuves.map((cuve) => (
                <option key={cuve.id} value={cuve.id}>
                  {cuve.nom_reference} — {formatLiters(cuve.niveau_actuel)} /{" "}
                  {formatLiters(cuve.capacite_max)} ({TYPE_HUILE_LABELS[cuve.type_huile]})
                </option>
              ))}
            </select>
            {fieldErrors.cuve_id && (
              <p id="pressage-cuve-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.cuve_id}
              </p>
            )}
            {selectedCuve && !fieldErrors.cuve_id && (
              <p className="text-sm text-gray-500 mt-1">
                Place restante : {formatLiters(placeRestante)}
              </p>
            )}
            {typeMismatch && (
              <p role="status" className="text-sm text-amber-600 mt-1">
                ⚠ Cette cuve est destinée à {TYPE_HUILE_LABELS[selectedCuve!.type_huile]}, différent
                du type produit. Vous pouvez continuer si c'est voulu.
              </p>
            )}
          </div>

          <div className="mb-6 bg-[#F7F8FA] rounded-xl p-3 text-sm text-gray-700">
            Montant du service :{" "}
            <span className="font-semibold font-mono">
              {montantPreview.toFixed(2)} {depot.is_achat_olives ? "(dépôt achat — aucun montant)" : "DT"}
            </span>
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
              disabled={submitting}
              className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : "Valider le pressage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
