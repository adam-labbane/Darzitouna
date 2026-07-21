import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { cuveSchema, TYPES_HUILE, type CuveFormInput } from "../lib/cuveSchema";
import { isCapacityReductionValid, TYPE_HUILE_LABELS } from "../lib/cuveDisplay";

interface CuveFormModalProps {
  initialValues?: {
    nom_reference: string;
    emplacement: string | null;
    type_huile: CuveFormInput["type_huile"];
    capacite_max: number;
    niveau_actuel: number;
  };
  onSubmit: (data: CuveFormInput) => Promise<void>;
  onClose: () => void;
}

type FieldErrors = Partial<
  Record<"nom_reference" | "emplacement" | "type_huile" | "capacite_max", string>
>;

export default function CuveFormModal({ initialValues, onSubmit, onClose }: CuveFormModalProps) {
  const dialogRef = useFocusTrap(true, onClose);
  const isEditMode = Boolean(initialValues);

  const [nomReference, setNomReference] = useState(initialValues?.nom_reference ?? "");
  const [emplacement, setEmplacement] = useState(initialValues?.emplacement ?? "");
  const [typeHuile, setTypeHuile] = useState<CuveFormInput["type_huile"]>(
    initialValues?.type_huile ?? "VIERGE",
  );
  const [capaciteMax, setCapaciteMax] = useState(
    initialValues ? String(initialValues.capacite_max) : "",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = cuveSchema.safeParse({
      nom_reference: nomReference,
      emplacement,
      type_huile: typeHuile,
      capacite_max: Number(capaciteMax),
    });

    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (
          key === "nom_reference" ||
          key === "emplacement" ||
          key === "type_huile" ||
          key === "capacite_max"
        ) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    if (initialValues && !isCapacityReductionValid(result.data.capacite_max, initialValues.niveau_actuel)) {
      setFieldErrors({
        capacite_max: `La capacité ne peut pas être inférieure au niveau actuel de la cuve (${initialValues.niveau_actuel} L). Utilisez d'abord "Corriger le niveau" si besoin.`,
      });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setFormError("Impossible d'enregistrer cette cuve. Vérifiez votre connexion.");
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
        aria-labelledby="cuve-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cuve-form-title" className="text-lg font-bold text-[#1B4332] mb-4">
          {isEditMode ? "Modifier la cuve" : "Nouvelle cuve"}
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="cuve-nom" className="block text-sm font-medium text-gray-600 mb-1">
              Référence
            </label>
            <input
              id="cuve-nom"
              type="text"
              value={nomReference}
              onChange={(event) => setNomReference(event.target.value)}
              aria-invalid={Boolean(fieldErrors.nom_reference)}
              aria-describedby={fieldErrors.nom_reference ? "cuve-nom-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.nom_reference && (
              <p id="cuve-nom-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.nom_reference}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="cuve-emplacement" className="block text-sm font-medium text-gray-600 mb-1">
              Emplacement <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              id="cuve-emplacement"
              type="text"
              value={emplacement}
              onChange={(event) => setEmplacement(event.target.value)}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="cuve-type" className="block text-sm font-medium text-gray-600 mb-1">
              Type d'huile
            </label>
            <select
              id="cuve-type"
              value={typeHuile}
              onChange={(event) => setTypeHuile(event.target.value as CuveFormInput["type_huile"])}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none bg-white"
            >
              {TYPES_HUILE.map((type) => (
                <option key={type} value={type}>
                  {TYPE_HUILE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="cuve-capacite" className="block text-sm font-medium text-gray-600 mb-1">
              Capacité max (L)
            </label>
            <input
              id="cuve-capacite"
              type="number"
              inputMode="decimal"
              step="1"
              value={capaciteMax}
              onChange={(event) => setCapaciteMax(event.target.value)}
              aria-invalid={Boolean(fieldErrors.capacite_max)}
              aria-describedby={fieldErrors.capacite_max ? "cuve-capacite-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.capacite_max && (
              <p id="cuve-capacite-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.capacite_max}
              </p>
            )}
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
              className="h-12 min-w-[48px] px-5 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : isEditMode ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
