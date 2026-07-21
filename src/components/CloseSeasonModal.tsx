// src/components/CloseSeasonModal.tsx
//
// Flux de clôture de saison, en 4 étapes : synthèse → choix de report →
// nouvelle saison → confirmation. Même architecture de wizard que
// DepotNouveau.tsx (état `step`, wrapper min-h-[420px] pour stabiliser
// la position des boutons de navigation entre étapes de hauteurs
// différentes — voir le bug corrigé sur ce module). La validation finale
// passe par ConfirmDialog (même pattern que l'archivage) : une
// confirmation forte avant l'action structurante.
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { getSeasonSummaryData, closeSeasonAndOpenNew, type CloseSeasonResult } from "../lib/seasonClosure";
import { buildSeasonSummary, type SeasonSummaryData } from "../lib/seasonSummary";
import { saisonSchema } from "../lib/saisonSchema";
import type { Saison } from "../types/saison";
import SeasonSummaryView from "./SeasonSummaryView";
import ConfirmDialog from "./ConfirmDialog";

const TOTAL_STEPS = 4;

interface CloseSeasonModalProps {
  client: SupabaseClient;
  activeSaison: Saison;
  huilerieNom: string;
  onClosed: (result: CloseSeasonResult) => void;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"nom" | "date_debut" | "date_fin" | "config_prix_kilo_service", string>>;

export default function CloseSeasonModal({
  client,
  activeSaison,
  huilerieNom,
  onClosed,
  onClose,
}: CloseSeasonModalProps) {
  const dialogRef = useFocusTrap(true, onClose);
  const [step, setStep] = useState(1);

  // Étape 1 — synthèse de la saison en cours.
  const [summary, setSummary] = useState<SeasonSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSeasonSummaryData(client, activeSaison, huilerieNom)
      .then((raw) => {
        if (!cancelled) {
          setSummary(buildSeasonSummary(raw));
          setSummaryError("");
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryError("Impossible de calculer le bilan de la saison. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, activeSaison, huilerieNom]);

  // Étape 2 — choix de report.
  const [reporterStock, setReporterStock] = useState(true);
  const [conserverClients, setConserverClients] = useState(true);

  // Étape 3 — nouvelle saison.
  const [nom, setNom] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [prix, setPrix] = useState(String(activeSaison.config_prix_kilo_service ?? ""));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Étape 4 — confirmation + soumission.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validateStep3 = () => {
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
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const canGoNext =
    (step === 1 && !summaryLoading && !summaryError) ||
    step === 2 ||
    (step === 3 && nom.trim() !== "" && prix !== "");

  const handleNext = () => {
    if (step === 3 && !validateStep3()) return;
    setStep((s) => s + 1);
  };

  const handleConfirmClosure = async () => {
    setConfirmOpen(false);
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await closeSeasonAndOpenNew(client, {
        oldSaisonId: activeSaison.id,
        reporterStock,
        conserverClients,
        nouvelleSaison: {
          nom,
          date_debut: dateDebut || undefined,
          date_fin: dateFin || undefined,
          config_prix_kilo_service: Number(prix),
        },
      });
      onClosed(result);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Impossible de clôturer cette saison. Réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-season-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 id="close-season-title" className="text-lg font-bold text-[#1B4332] mb-1">
          Clôturer {activeSaison.nom} et ouvrir une nouvelle campagne
        </h2>
        <p className="text-sm text-gray-500 mb-4" aria-live="polite">
          Étape {step} / {TOTAL_STEPS}
        </p>
        <div className="flex gap-1 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-[#2D6A4F]" : "bg-gray-200"}`}
            />
          ))}
        </div>

        {/* min-h stabilise la position des boutons de navigation d'une
            étape à l'autre — voir le commentaire équivalent dans
            DepotNouveau.tsx (bug de décalage déjà corrigé sur ce module). */}
        <div className="min-h-[420px]">
          {step === 1 && (
            <section>
              <h3 className="font-semibold text-gray-900 mb-3">Bilan de la saison en cours</h3>
              {summaryLoading && <p className="text-center text-gray-400 py-8">Calcul du bilan…</p>}
              {!summaryLoading && summaryError && (
                <p role="alert" className="text-center text-[#E63946] py-8">
                  {summaryError}
                </p>
              )}
              {!summaryLoading && !summaryError && summary && <SeasonSummaryView summary={summary} />}
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="font-semibold text-gray-900 mb-3">Que reporter vers la nouvelle campagne ?</h3>

              <p className="text-sm text-gray-600 bg-[#F7F8FA] rounded-xl p-3 mb-4">
                Les dépôts et pressages de {activeSaison.nom} restent archivés dans cette saison — la
                nouvelle campagne démarre sans eux, ce n'est pas un choix.
              </p>

              <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-200 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reporterStock}
                  onChange={(event) => setReporterStock(event.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <span>
                  <span className="block font-semibold text-gray-900">Reporter le stock des cuves</span>
                  <span className="block text-sm text-gray-500">
                    {reporterStock
                      ? "L'huile reste physiquement dans les cuves, les niveaux sont conservés."
                      : "Si vous décochez, le stock de chaque cuve non vide sera remis à zéro — avec un mouvement de sortie tracé (motif « Clôture saison »), jamais une remise à zéro silencieuse."}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conserverClients}
                  onChange={(event) => setConserverClients(event.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <span>
                  <span className="block font-semibold text-gray-900">Conserver les clients</span>
                  <span className="block text-sm text-gray-500">
                    {conserverClients
                      ? "Tous les clients restent actifs pour la nouvelle campagne."
                      : "Si vous décochez, les clients sans impayé ni solde seront archivés. Un client avec une facture non payée ou un solde non nul est toujours conservé, quoi qu'il arrive."}
                  </span>
                </span>
              </label>
            </section>
          )}

          {step === 3 && (
            <section>
              <h3 className="font-semibold text-gray-900 mb-3">Nouvelle saison</h3>
              <div className="mb-4">
                <label htmlFor="nouvelle-saison-nom" className="block text-sm font-medium text-gray-600 mb-1">
                  Nom de la saison
                </label>
                <input
                  id="nouvelle-saison-nom"
                  type="text"
                  placeholder="ex. 2026-2027"
                  value={nom}
                  onChange={(event) => setNom(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.nom)}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
                />
                {fieldErrors.nom && (
                  <p role="alert" className="text-[#E63946] text-sm mt-1">
                    {fieldErrors.nom}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="nouvelle-saison-debut" className="block text-sm font-medium text-gray-600 mb-1">
                    Date de début
                  </label>
                  <input
                    id="nouvelle-saison-debut"
                    type="date"
                    value={dateDebut}
                    onChange={(event) => setDateDebut(event.target.value)}
                    className="w-full h-14 px-3 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="nouvelle-saison-fin" className="block text-sm font-medium text-gray-600 mb-1">
                    Date de fin
                  </label>
                  <input
                    id="nouvelle-saison-fin"
                    type="date"
                    value={dateFin}
                    onChange={(event) => setDateFin(event.target.value)}
                    aria-invalid={Boolean(fieldErrors.date_fin)}
                    className="w-full h-14 px-3 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
                  />
                </div>
              </div>
              {fieldErrors.date_fin && (
                <p role="alert" className="text-[#E63946] text-sm -mt-2 mb-4">
                  {fieldErrors.date_fin}
                </p>
              )}

              <div>
                <label htmlFor="nouvelle-saison-prix" className="block text-sm font-medium text-gray-600 mb-1">
                  Prix du service au kilo (DT)
                </label>
                <input
                  id="nouvelle-saison-prix"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={prix}
                  onChange={(event) => setPrix(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.config_prix_kilo_service)}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono text-xl focus:border-[#2D6A4F] focus:outline-none"
                />
                {fieldErrors.config_prix_kilo_service && (
                  <p role="alert" className="text-[#E63946] text-sm mt-1">
                    {fieldErrors.config_prix_kilo_service}
                  </p>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h3 className="font-semibold text-gray-900 mb-4">Récapitulatif avant validation</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-[#F7F8FA] rounded-xl">
                  <dt className="text-gray-600">Saison clôturée</dt>
                  <dd className="font-semibold text-gray-900">{activeSaison.nom}</dd>
                </div>
                <div className="flex justify-between p-3 bg-[#F7F8FA] rounded-xl">
                  <dt className="text-gray-600">Nouvelle saison</dt>
                  <dd className="font-semibold text-gray-900">{nom || "—"}</dd>
                </div>
                <div className="flex justify-between p-3 bg-[#F7F8FA] rounded-xl">
                  <dt className="text-gray-600">Stock des cuves</dt>
                  <dd className="font-semibold text-gray-900">
                    {reporterStock ? "Reporté (niveaux conservés)" : "Vidé (mouvement tracé)"}
                  </dd>
                </div>
                <div className="flex justify-between p-3 bg-[#F7F8FA] rounded-xl">
                  <dt className="text-gray-600">Clients</dt>
                  <dd className="font-semibold text-gray-900">
                    {conserverClients ? "Tous conservés" : "Archivés sauf impayés/solde"}
                  </dd>
                </div>
              </dl>

              {submitError && (
                <p role="alert" className="text-[#E63946] text-sm mt-4 text-center">
                  {submitError}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex gap-3 mt-6 justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}
            className="h-14 min-w-[56px] px-6 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
          >
            {step === 1 ? "Annuler" : "Précédent"}
          </button>
          {step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="h-14 min-w-[56px] px-6 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-green-800 disabled:opacity-50"
            >
              Suivant
            </button>
          )}
          {step === TOTAL_STEPS && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="h-14 min-w-[56px] px-6 rounded-xl bg-[#E63946] text-white font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Clôture en cours…" : "Confirmer la clôture"}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Clôturer définitivement cette saison ?"
        message={`${activeSaison.nom} sera clôturée et son bilan figé. ${nom} sera créée et activée immédiatement. Cette action ne peut pas être annulée.`}
        confirmLabel="Clôturer"
        destructive
        onConfirm={() => void handleConfirmClosure()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
