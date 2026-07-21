// src/components/SaisonFormModal.tsx
//
// Modal de création ET d'édition d'une saison — même pattern que
// CuveFormModal.tsx (rendu conditionnel par le parent, pas de prop
// `open`, useFocusTrap, validation Zod au submit). N'expose jamais
// is_active : l'activation/désactivation est un geste séparé (boutons
// dédiés dans Config.tsx), pas un champ de ce formulaire.
import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { saisonSchema, type SaisonFormInput } from "../lib/saisonSchema";

interface SaisonFormModalProps {
  // Présent = mode édition (pré-remplit le formulaire), absent = création.
  initialValues?: {
    nom: string;
    date_debut: string | null;
    date_fin: string | null;
    config_prix_kilo_service: number | null;
  };
  onSubmit: (data: SaisonFormInput) => Promise<void>;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"nom" | "date_debut" | "date_fin" | "config_prix_kilo_service", string>>;

export default function SaisonFormModal({ initialValues, onSubmit, onClose }: SaisonFormModalProps) {
  const dialogRef = useFocusTrap(true, onClose);
  const isEditMode = Boolean(initialValues);

  const [nom, setNom] = useState(initialValues?.nom ?? "");
  const [dateDebut, setDateDebut] = useState(initialValues?.date_debut ?? "");
  const [dateFin, setDateFin] = useState(initialValues?.date_fin ?? "");
  const [prix, setPrix] = useState(
    initialValues?.config_prix_kilo_service !== null && initialValues?.config_prix_kilo_service !== undefined
      ? String(initialValues.config_prix_kilo_service)
      : "",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = saisonSchema.safeParse({
      nom,
      date_debut: dateDebut,
      date_fin: dateFin,
      config_prix_kilo_service: Number(prix),
    });

    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "nom" || key === "date_debut" || key === "date_fin" || key === "config_prix_kilo_service") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer cette saison. Vérifiez votre connexion.",
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
        aria-labelledby="saison-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="saison-form-title" className="text-lg font-bold text-[#1B4332] mb-4">
          {isEditMode ? "Modifier la saison" : "Nouvelle saison"}
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="saison-nom" className="block text-sm font-medium text-gray-600 mb-1">
              Nom de la saison
            </label>
            <input
              id="saison-nom"
              type="text"
              placeholder="ex. 2026-2027"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              aria-invalid={Boolean(fieldErrors.nom)}
              aria-describedby={fieldErrors.nom ? "saison-nom-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.nom && (
              <p id="saison-nom-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.nom}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="saison-debut" className="block text-sm font-medium text-gray-600 mb-1">
                Date de début
              </label>
              <input
                id="saison-debut"
                type="date"
                value={dateDebut}
                onChange={(event) => setDateDebut(event.target.value)}
                className="w-full h-14 px-3 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="saison-fin" className="block text-sm font-medium text-gray-600 mb-1">
                Date de fin
              </label>
              <input
                id="saison-fin"
                type="date"
                value={dateFin}
                onChange={(event) => setDateFin(event.target.value)}
                aria-invalid={Boolean(fieldErrors.date_fin)}
                aria-describedby={fieldErrors.date_fin ? "saison-fin-error" : undefined}
                className="w-full h-14 px-3 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
              />
            </div>
          </div>
          {fieldErrors.date_fin && (
            <p id="saison-fin-error" role="alert" className="text-[#E63946] text-sm -mt-2 mb-4">
              {fieldErrors.date_fin}
            </p>
          )}

          <div className="mb-6">
            <label htmlFor="saison-prix" className="block text-sm font-medium text-gray-600 mb-1">
              Prix du service au kilo (DT)
            </label>
            <input
              id="saison-prix"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={prix}
              onChange={(event) => setPrix(event.target.value)}
              aria-invalid={Boolean(fieldErrors.config_prix_kilo_service)}
              aria-describedby={fieldErrors.config_prix_kilo_service ? "saison-prix-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono text-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.config_prix_kilo_service && (
              <p id="saison-prix-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.config_prix_kilo_service}
              </p>
            )}
            {isEditMode && (
              <p className="text-xs text-gray-400 mt-1">
                Modifier ce prix n'affecte que les futurs pressages — les pressages déjà réalisés
                gardent leur montant.
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
              className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : isEditMode ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
