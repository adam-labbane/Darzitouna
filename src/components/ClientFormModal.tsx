import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { clientSchema, type ClientFormInput } from "../lib/clientSchema";

interface ClientFormModalProps {
  initialValues?: { nom_complet: string; telephone: string | null };
  onSubmit: (data: ClientFormInput) => Promise<void>;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"nom_complet" | "telephone", string>>;

export default function ClientFormModal({
  initialValues,
  onSubmit,
  onClose,
}: ClientFormModalProps) {
  const dialogRef = useFocusTrap(true, onClose);
  const isEditMode = Boolean(initialValues);

  const [nomComplet, setNomComplet] = useState(initialValues?.nom_complet ?? "");
  const [telephone, setTelephone] = useState(initialValues?.telephone ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = clientSchema.safeParse({ nom_complet: nomComplet, telephone });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "nom_complet" || key === "telephone") {
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
    } catch {
      setFormError("Impossible d'enregistrer ce client. Vérifiez votre connexion.");
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
        aria-labelledby="client-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="client-form-title" className="text-lg font-bold text-[#1B4332] mb-4">
          {isEditMode ? "Modifier le client" : "Nouveau client"}
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="client-nom" className="block text-sm font-medium text-gray-600 mb-1">
              Nom complet
            </label>
            <input
              id="client-nom"
              type="text"
              value={nomComplet}
              onChange={(event) => setNomComplet(event.target.value)}
              aria-invalid={Boolean(fieldErrors.nom_complet)}
              aria-describedby={fieldErrors.nom_complet ? "client-nom-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.nom_complet && (
              <p id="client-nom-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.nom_complet}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="client-tel" className="block text-sm font-medium text-gray-600 mb-1">
              Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              id="client-tel"
              type="tel"
              value={telephone}
              onChange={(event) => setTelephone(event.target.value)}
              placeholder="20 123 456"
              aria-invalid={Boolean(fieldErrors.telephone)}
              aria-describedby={fieldErrors.telephone ? "client-tel-error" : undefined}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
            {fieldErrors.telephone && (
              <p id="client-tel-error" role="alert" className="text-[#E63946] text-sm mt-1">
                {fieldErrors.telephone}
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
