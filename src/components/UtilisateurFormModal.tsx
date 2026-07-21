import { useState, type FormEvent } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { isPinComplete } from "../lib/pin";
import { personnelCreateSchema, personnelSchema, pinSchema, ROLES } from "../lib/personnelSchema";
import type { UserRole } from "../types/utilisateur";
import PinKeypad from "./PinKeypad";

const ROLE_LABELS: Record<UserRole, string> = {
  GERANT: "Gérant",
  OPERATEUR: "Opérateur",
};

type UtilisateurFormModalProps =
  | {
      mode: "create";
      onSubmit: (data: { nom_complet: string; role: UserRole; pin: string }) => Promise<void>;
      onClose: () => void;
    }
  | {
      mode: "edit";
      nomComplet: string;
      role: UserRole;
      onSubmit: (data: { nom_complet: string; role: UserRole }) => Promise<void>;
      onClose: () => void;
    }
  | {
      mode: "reset-pin";
      nomComplet: string;
      onSubmit: (data: { pin: string }) => Promise<void>;
      onClose: () => void;
    };

export default function UtilisateurFormModal(props: UtilisateurFormModalProps) {
  const { mode, onClose } = props;
  const dialogRef = useFocusTrap(true, onClose);

  const [nomComplet, setNomComplet] = useState(mode === "create" ? "" : props.nomComplet);
  const [role, setRole] = useState<UserRole>(mode === "edit" ? props.role : "OPERATEUR");
  const [pin, setPin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"nom_complet" | "role" | "pin", string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titles: Record<typeof mode, string> = {
    create: "Nouvel utilisateur",
    edit: "Modifier l'utilisateur",
    "reset-pin": "Réinitialiser le code PIN",
  };

  const handleSubmit = async (event: FormEvent, pinOverride?: string) => {
    event.preventDefault();
    setFormError("");
    const currentPin = pinOverride ?? pin;

    if (mode === "create") {
      const result = personnelCreateSchema.safeParse({ nom_complet: nomComplet, role, pin: currentPin });
      if (!result.success) {
        const errors: typeof fieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "nom_complet" || key === "role" || key === "pin") errors[key] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      setSubmitting(true);
      try {
        await props.onSubmit(result.data);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Impossible de créer cet utilisateur.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "edit") {
      const result = personnelSchema.safeParse({ nom_complet: nomComplet, role });
      if (!result.success) {
        const errors: typeof fieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "nom_complet" || key === "role") errors[key] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      setSubmitting(true);
      try {
        await props.onSubmit(result.data);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Impossible de modifier cet utilisateur.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const result = pinSchema.safeParse(currentPin);
    if (!result.success) {
      setFieldErrors({ pin: result.error.issues[0]?.message });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await props.onSubmit({ pin: result.data });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible de réinitialiser ce PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    if (isPinComplete(newPin) && !submitting) {
      const syntheticEvent = { preventDefault: () => {} } as FormEvent;
      void handleSubmit(syntheticEvent, newPin);
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
        aria-labelledby="utilisateur-form-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="utilisateur-form-title" className="text-lg font-bold text-[#1B4332] mb-1">
          {titles[mode]}
        </h2>
        {mode === "reset-pin" && (
          <p className="text-sm text-gray-500 mb-4">
            Nouveau code pour <span className="font-semibold">{props.nomComplet}</span>
          </p>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          {(mode === "create" || mode === "edit") && (
            <>
              <div className="mb-4">
                <label htmlFor="utilisateur-nom" className="block text-sm font-medium text-gray-600 mb-1">
                  Nom complet
                </label>
                <input
                  id="utilisateur-nom"
                  type="text"
                  value={nomComplet}
                  onChange={(event) => setNomComplet(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.nom_complet)}
                  aria-describedby={fieldErrors.nom_complet ? "utilisateur-nom-error" : undefined}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
                />
                {fieldErrors.nom_complet && (
                  <p id="utilisateur-nom-error" role="alert" className="text-[#E63946] text-sm mt-1">
                    {fieldErrors.nom_complet}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <span className="block text-sm font-medium text-gray-600 mb-2" id="utilisateur-role-label">
                  Rôle
                </span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="utilisateur-role-label">
                  {ROLES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      aria-pressed={role === option}
                      className={`h-14 rounded-xl border-2 font-semibold ${
                        role === option
                          ? "border-[#2D6A4F] bg-green-50 text-[#1B4332]"
                          : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {ROLE_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {(mode === "create" || mode === "reset-pin") && (
            <div className="mb-6 flex flex-col items-center">
              <p className="text-sm font-medium text-gray-600 mb-3">Code PIN (4 chiffres)</p>
              <PinKeypad value={pin} onChange={handlePinChange} disabled={submitting} />
              {fieldErrors.pin && (
                <p role="alert" className="text-[#E63946] text-sm mt-3">
                  {fieldErrors.pin}
                </p>
              )}
            </div>
          )}

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
            {mode !== "reset-pin" && (
              <button
                type="submit"
                disabled={submitting}
                className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
              >
                {submitting ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
