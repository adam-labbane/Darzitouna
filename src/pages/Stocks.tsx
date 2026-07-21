// src/pages/Stocks.tsx
//
// Module Cuves : canvas visuel (vue d'ensemble) + liste avec actions.
// La logique métier (accès données, calculs d'affichage) est déléguée à
// src/lib/cuves.ts et src/lib/cuveDisplay.ts — cette page orchestre l'UI.
import { useEffect, useState } from "react";
import { Warehouse } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId } from "../lib/session";
import { archiveCuve, correctCuveLevel, createCuve, getCuves, updateCuve } from "../lib/cuves";
import { formatLiters, TYPE_HUILE_LABELS } from "../lib/cuveDisplay";
import type { Cuve } from "../types/cuve";
import type { CuveFormInput } from "../lib/cuveSchema";
import { useSeasonConsultation } from "../hooks/useSeasonConsultation";
import TankCanvas from "../components/TankCanvas";
import CuveFormModal from "../components/CuveFormModal";
import CuveCorrectionModal from "../components/CuveCorrectionModal";
import ConfirmDialog from "../components/ConfirmDialog";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function Stocks() {
  const huilerieId = getHuilerieId();
  const currentUser = getCurrentUser();
  // Décision UX uniquement : la vraie protection est le trigger
  // enforce_correction_role côté base (voir supabase/migrations/
  // 20260721090000_cuve_stock_safety.sql) — masquer ce bouton n'empêche
  // pas un appel API direct, seule la base le fait.
  const isGerant = currentUser?.role === "GERANT";

  // Les cuves sont un actif permanent, pas une donnée de saison : elles
  // s'affichent identiquement quelle que soit la saison consultée. Seule
  // la correction de niveau écrit un mouvement de stock daté d'une
  // saison — elle cible donc toujours activeSaison (jamais la saison
  // consultée) et disparaît en mode lecture seule, comme les autres
  // actions d'écriture de saison (dépôt, pressage, facture, règlement).
  const { activeSaison, isReadOnly } = useSeasonConsultation();

  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCuves(supabase)
      .then((data) => {
        if (!cancelled) {
          setCuves(data);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les cuves. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCuves = async () => {
    try {
      const data = await getCuves(supabase);
      setCuves(data);
      setError("");
    } catch {
      setError("Impossible de charger les cuves. Vérifiez votre connexion.");
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editingCuve, setEditingCuve] = useState<Cuve | null>(null);

  const [correctionTarget, setCorrectionTarget] = useState<Cuve | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Cuve | null>(null);
  const [archiveError, setArchiveError] = useState("");

  const handleOpenCreate = () => {
    setEditingCuve(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (cuve: Cuve) => {
    setEditingCuve(cuve);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: CuveFormInput) => {
    if (editingCuve) {
      await updateCuve(supabase, editingCuve.id, data);
    } else {
      if (!huilerieId) return;
      await createCuve(supabase, huilerieId, data);
    }
    setFormOpen(false);
    await refreshCuves();
  };

  const handleCorrectionSubmit = async (data: { newLevel: number; raison: string }) => {
    if (!correctionTarget || !activeSaison) return;
    await correctCuveLevel(supabase, {
      cuveId: correctionTarget.id,
      saisonId: activeSaison.id,
      currentLevel: correctionTarget.niveau_actuel,
      newLevel: data.newLevel,
      raison: data.raison,
    });
    setCorrectionTarget(null);
    await refreshCuves();
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiveError("");
    try {
      await archiveCuve(supabase, archiveTarget.id);
      setArchiveTarget(null);
      await refreshCuves();
    } catch {
      setArchiveError("Impossible d'archiver cette cuve. Vérifiez qu'elle est bien vide.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-xl font-bold text-[#1B4332]">Stocks — cuves</h1>
      </header>

      <main className="p-4 space-y-6 max-w-4xl mx-auto">
        {loading && <Skeleton count={1} className="h-40" label="Chargement des cuves" />}

        {!loading && error && (
          <p role="alert" className="text-center text-[#E63946] mt-8">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <TankCanvas cuves={cuves} />

            {!isReadOnly && !activeSaison && (
              <p className="text-sm text-gray-500 text-center">
                Aucune saison active — la correction manuelle de niveau est indisponible tant
                qu'une saison n'est pas ouverte.
              </p>
            )}

            {cuves.length === 0 ? (
              <EmptyState icon={Warehouse} title="Aucune cuve" description="Créez la première avec le bouton +." />
            ) : (
              <div className="bg-white rounded-2xl shadow-soft divide-y divide-gray-100">
                {cuves.map((cuve) => (
                  <div key={cuve.id} className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <p className="font-semibold text-gray-900">{cuve.nom_reference}</p>
                      <p className="text-sm text-gray-500">
                        {TYPE_HUILE_LABELS[cuve.type_huile]}
                        {cuve.emplacement ? ` — ${cuve.emplacement}` : ""}
                      </p>
                      <p className="text-sm text-gray-700 font-mono">
                        {formatLiters(cuve.niveau_actuel)} / {formatLiters(cuve.capacite_max)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cuve)}
                      className="min-h-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors motion-reduce:transition-none"
                    >
                      Modifier
                    </button>

                    {isGerant && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setCorrectionTarget(cuve)}
                        disabled={!activeSaison}
                        aria-label={`Corriger le niveau de ${cuve.nom_reference}`}
                        className="min-h-[48px] px-4 rounded-xl border-2 border-[#2D6A4F] text-[#2D6A4F] font-semibold hover:bg-green-50 disabled:opacity-40 disabled:pointer-events-none transition-colors motion-reduce:transition-none"
                      >
                        Corriger le niveau
                      </button>
                    )}

                  {isGerant && (
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(cuve)}
                      disabled={cuve.niveau_actuel > 0}
                      aria-label={`Archiver ${cuve.nom_reference}`}
                      title={
                        cuve.niveau_actuel > 0
                          ? "Impossible d'archiver une cuve non vide"
                          : undefined
                      }
                      className="min-h-[48px] px-4 rounded-xl text-[#E63946] hover:bg-red-50 font-semibold disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Archiver
                    </button>
                  )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <button
        type="button"
        onClick={handleOpenCreate}
        aria-label="Nouvelle cuve"
        className="fixed bottom-24 md:bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 transition-transform motion-reduce:transition-none active:scale-95 flex items-center justify-center"
      >
        +
      </button>

      {formOpen && (
        <CuveFormModal
          initialValues={
            editingCuve
              ? {
                  nom_reference: editingCuve.nom_reference,
                  emplacement: editingCuve.emplacement,
                  type_huile: editingCuve.type_huile,
                  capacite_max: editingCuve.capacite_max,
                  niveau_actuel: editingCuve.niveau_actuel,
                }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

      {correctionTarget && (
        <CuveCorrectionModal
          cuve={correctionTarget}
          onSubmit={handleCorrectionSubmit}
          onClose={() => setCorrectionTarget(null)}
        />
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archiver cette cuve ?"
        message={
          archiveTarget
            ? `${archiveTarget.nom_reference} ne sera plus visible dans le canvas ni la liste.`
            : ""
        }
        confirmLabel="Archiver"
        destructive
        onConfirm={() => void handleArchiveConfirm()}
        onCancel={() => setArchiveTarget(null)}
      />

      {archiveError && (
        <p
          role="alert"
          className="fixed bottom-24 left-4 right-4 text-center text-[#E63946] bg-white rounded-xl shadow-lg p-3"
        >
          {archiveError}
        </p>
      )}
    </div>
  );
}
