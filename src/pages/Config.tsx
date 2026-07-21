import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { CalendarRange } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId } from "../lib/session";
import { getHuilerieName } from "../lib/huilerie";
import { createSaison, updateSaison, activateSaison, deactivateSaison } from "../lib/saisons";
import {
  getUtilisateurs,
  createUtilisateur,
  updateUtilisateur,
  resetPin,
  deleteUtilisateur,
} from "../lib/personnel";
import { getSeasonSummaryData, type CloseSeasonResult } from "../lib/seasonClosure";
import { buildSeasonSummary, type SeasonSummaryData } from "../lib/seasonSummary";
import type { Saison } from "../types/saison";
import type { UserRole, Utilisateur } from "../types/utilisateur";
import type { SaisonFormInput } from "../lib/saisonSchema";
import { useSeasonConsultation } from "../hooks/useSeasonConsultation";
import SaisonFormModal from "../components/SaisonFormModal";
import UtilisateurFormModal from "../components/UtilisateurFormModal";
import CloseSeasonModal from "../components/CloseSeasonModal";
import SeasonSummaryView from "../components/SeasonSummaryView";
import ConfirmDialog from "../components/ConfirmDialog";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

const ROLE_LABELS: Record<UserRole, string> = {
  GERANT: "Gérant",
  OPERATEUR: "Opérateur",
};

type Tab = "saisons" | "personnel";

export default function Config() {
  const currentUser = getCurrentUser();
  const huilerieId = getHuilerieId();

  const [tab, setTab] = useState<Tab>("saisons");

  const [huilerieNom, setHuilerieNom] = useState("Huilerie");
  useEffect(() => {
    if (!huilerieId) return;
    let cancelled = false;
    getHuilerieName(supabase, huilerieId)
      .then((nom) => {
        if (!cancelled && nom) setHuilerieNom(nom);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  const { allSaisons: saisons, loading: saisonsLoading, refreshSaisons } = useSeasonConsultation();
  const [saisonModalOpen, setSaisonModalOpen] = useState(false);
  const [editingSaison, setEditingSaison] = useState<Saison | null>(null);
  const [saisonActionError, setSaisonActionError] = useState("");

  const [closeSeasonTarget, setCloseSeasonTarget] = useState<Saison | null>(null);
  const [closureMessage, setClosureMessage] = useState("");

  const [viewingBilanSaison, setViewingBilanSaison] = useState<Saison | null>(null);
  const [bilan, setBilan] = useState<SeasonSummaryData | null>(null);
  const [bilanLoading, setBilanLoading] = useState(false);
  const [bilanError, setBilanError] = useState("");

  useEffect(() => {
    if (!viewingBilanSaison) return;
    let cancelled = false;
    getSeasonSummaryData(supabase, viewingBilanSaison, huilerieNom)
      .then((raw) => {
        if (!cancelled) {
          setBilan(buildSeasonSummary(raw));
          setBilanError("");
        }
      })
      .catch(() => {
        if (!cancelled) setBilanError("Impossible de calculer le bilan de cette saison. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setBilanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingBilanSaison, huilerieNom]);

  const handleClosureComplete = async (result: CloseSeasonResult) => {
    setCloseSeasonTarget(null);
    setClosureMessage(
      result.clientsProtegesCount > 0
        ? `Saison clôturée. ${result.clientsProtegesCount} client(s) conservé(s) malgré le décochage, à cause d'impayés ou d'un solde non nul.`
        : "Saison clôturée et nouvelle campagne ouverte.",
    );
    await refreshSaisons();
  };

  const handleSaisonSubmit = async (data: SaisonFormInput) => {
    if (editingSaison) {
      await updateSaison(supabase, editingSaison.id, data);
    } else {
      if (!huilerieId) return;
      await createSaison(supabase, huilerieId, data);
    }
    setSaisonModalOpen(false);
    setEditingSaison(null);
    await refreshSaisons();
  };

  const handleToggleActive = async (saison: Saison) => {
    setSaisonActionError("");
    try {
      if (saison.is_active) {
        await deactivateSaison(supabase, saison.id);
      } else {
        await activateSaison(supabase, saison.id);
      }
      await refreshSaisons();
    } catch {
      setSaisonActionError("Impossible de modifier le statut de cette saison.");
    }
  };

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [personnelError, setPersonnelError] = useState("");
  const [personnelActionError, setPersonnelActionError] = useState("");

  const [userModal, setUserModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; utilisateur: Utilisateur }
    | { mode: "reset-pin"; utilisateur: Utilisateur }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<Utilisateur | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUtilisateurs(supabase)
      .then((data) => {
        if (!cancelled) {
          setUtilisateurs(data);
          setPersonnelError("");
        }
      })
      .catch(() => {
        if (!cancelled) setPersonnelError("Impossible de charger le personnel. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setPersonnelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUtilisateurs = async () => {
    try {
      const data = await getUtilisateurs(supabase);
      setUtilisateurs(data);
      setPersonnelError("");
    } catch {
      setPersonnelError("Impossible de charger le personnel. Vérifiez votre connexion.");
    }
  };

  const handleCreateUtilisateur = async (data: { nom_complet: string; role: UserRole; pin: string }) => {
    await createUtilisateur(supabase, data);
    setUserModal(null);
    await refreshUtilisateurs();
  };

  const handleEditUtilisateur = async (data: { nom_complet: string; role: UserRole }) => {
    if (userModal?.mode !== "edit") return;
    await updateUtilisateur(supabase, userModal.utilisateur.id, data);
    setUserModal(null);
    await refreshUtilisateurs();
  };

  const handleResetPin = async (data: { pin: string }) => {
    if (userModal?.mode !== "reset-pin") return;
    await resetPin(supabase, userModal.utilisateur.id, data.pin);
    setUserModal(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setPersonnelActionError("");
    try {
      await deleteUtilisateur(supabase, deleteTarget.id);
      setDeleteTarget(null);
      await refreshUtilisateurs();
    } catch (error) {
      setPersonnelActionError(
        error instanceof Error ? error.message : "Impossible d'archiver cet utilisateur.",
      );
    }
  };

  if (currentUser?.role !== "GERANT") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-xl font-bold text-[#1B4332] mb-3">Configuration</h1>
        <div role="tablist" aria-label="Sections de configuration" className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "saisons"}
            onClick={() => setTab("saisons")}
            className={`min-h-[48px] px-5 rounded-xl font-semibold ${
              tab === "saisons" ? "bg-green-50 text-[#2D6A4F] border-2 border-[#2D6A4F]" : "text-gray-600 border-2 border-transparent hover:bg-gray-50"
            }`}
          >
            Saisons
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "personnel"}
            onClick={() => setTab("personnel")}
            className={`min-h-[48px] px-5 rounded-xl font-semibold ${
              tab === "personnel" ? "bg-green-50 text-[#2D6A4F] border-2 border-[#2D6A4F]" : "text-gray-600 border-2 border-transparent hover:bg-gray-50"
            }`}
          >
            Personnel
          </button>
        </div>
      </header>

      <main className="p-4">
        {tab === "saisons" && (
          <section role="tabpanel" aria-label="Saisons">
            {saisonsLoading && <Skeleton count={2} label="Chargement des saisons" />}
            {!saisonsLoading && saisons.length === 0 && (
              <EmptyState
                icon={CalendarRange}
                title="Aucune saison"
                description="Créez la première pour commencer à opérer."
              />
            )}
            {!saisonsLoading && saisons.length > 0 && (
              <ul className="space-y-3">
                {saisons.map((saison) => {
                  const estCloturee = saison.date_cloture !== null;
                  return (
                    <li
                      key={saison.id}
                      className={`bg-white rounded-2xl shadow-soft p-4 flex items-center gap-4 flex-wrap ${
                        !saison.is_active ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{saison.nom}</p>
                          {estCloturee ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-300">
                              Clôturée
                            </span>
                          ) : saison.is_active ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-[#2D6A4F] border border-[#2D6A4F]">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {saison.date_debut ?? "—"} au {saison.date_fin ?? "—"}
                        </p>
                        <p className="text-sm text-gray-700 font-mono">
                          {(saison.config_prix_kilo_service ?? 0).toFixed(2)} DT / kg
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setBilanLoading(true);
                          setViewingBilanSaison(saison);
                        }}
                        className="min-h-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                      >
                        Voir le bilan
                      </button>

                      {!estCloturee && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSaison(saison);
                              setSaisonModalOpen(true);
                            }}
                            className="min-h-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleActive(saison)}
                            className={`min-h-[48px] px-4 rounded-xl font-semibold ${
                              saison.is_active
                                ? "border-2 border-[#E63946] text-[#E63946] hover:bg-red-50"
                                : "bg-[#2D6A4F] text-white hover:bg-green-800"
                            }`}
                          >
                            {saison.is_active ? "Désactiver" : "Activer"}
                          </button>

                          {saison.is_active && (
                            <button
                              type="button"
                              onClick={() => setCloseSeasonTarget(saison)}
                              className="min-h-[48px] px-4 rounded-xl border-2 border-[#E63946] text-[#E63946] font-semibold hover:bg-red-50"
                            >
                              Clôturer et ouvrir une nouvelle campagne
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {saisonActionError && (
              <p role="alert" className="text-center text-[#E63946] mt-4">
                {saisonActionError}
              </p>
            )}

            {closureMessage && (
              <p role="status" className="text-center text-[#2D6A4F] bg-green-50 rounded-xl p-3 mt-4">
                {closureMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingSaison(null);
                setSaisonModalOpen(true);
              }}
              aria-label="Nouvelle saison"
              className="fixed bottom-24 md:bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 transition-transform motion-reduce:transition-none active:scale-95 flex items-center justify-center"
            >
              +
            </button>
          </section>
        )}

        {tab === "personnel" && (
          <section role="tabpanel" aria-label="Personnel">
            {personnelLoading && <Skeleton count={2} label="Chargement du personnel" />}
            {!personnelLoading && personnelError && (
              <p role="alert" className="text-center text-[#E63946] mt-8">
                {personnelError}
              </p>
            )}
            {!personnelLoading && !personnelError && (
              <ul className="space-y-3">
                {utilisateurs.map((utilisateur) => {
                  const isSelf = utilisateur.id === currentUser?.id;
                  return (
                    <li key={utilisateur.id} className="bg-white rounded-2xl shadow-soft p-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{utilisateur.nom_complet}</p>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              utilisateur.role === "GERANT"
                                ? "bg-green-50 text-[#2D6A4F] border-[#2D6A4F]"
                                : "bg-gray-100 text-gray-600 border-gray-300"
                            }`}
                          >
                            {ROLE_LABELS[utilisateur.role]}
                          </span>
                          {isSelf && <span className="text-xs text-gray-400">(vous)</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setUserModal({ mode: "edit", utilisateur })}
                        className="min-h-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserModal({ mode: "reset-pin", utilisateur })}
                        className="min-h-[48px] px-4 rounded-xl border-2 border-[#2D6A4F] text-[#2D6A4F] font-semibold hover:bg-green-50"
                      >
                        Réinitialiser le PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(utilisateur)}
                        disabled={isSelf}
                        title={isSelf ? "Vous ne pouvez pas archiver votre propre compte" : undefined}
                        className="min-h-[48px] px-4 rounded-xl text-[#E63946] hover:bg-red-50 font-semibold disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Archiver
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {personnelActionError && (
              <p role="alert" className="text-center text-[#E63946] mt-4">
                {personnelActionError}
              </p>
            )}

            <button
              type="button"
              onClick={() => setUserModal({ mode: "create" })}
              aria-label="Nouvel utilisateur"
              className="fixed bottom-24 md:bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 transition-transform motion-reduce:transition-none active:scale-95 flex items-center justify-center"
            >
              +
            </button>
          </section>
        )}
      </main>

      {saisonModalOpen && (
        <SaisonFormModal
          initialValues={
            editingSaison
              ? {
                  nom: editingSaison.nom,
                  date_debut: editingSaison.date_debut,
                  date_fin: editingSaison.date_fin,
                  config_prix_kilo_service: editingSaison.config_prix_kilo_service,
                }
              : undefined
          }
          onSubmit={handleSaisonSubmit}
          onClose={() => {
            setSaisonModalOpen(false);
            setEditingSaison(null);
          }}
        />
      )}

      {closeSeasonTarget && (
        <CloseSeasonModal
          client={supabase}
          activeSaison={closeSeasonTarget}
          huilerieNom={huilerieNom}
          onClosed={(result) => void handleClosureComplete(result)}
          onClose={() => setCloseSeasonTarget(null)}
        />
      )}

      {viewingBilanSaison && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => {
            setViewingBilanSaison(null);
            setBilan(null);
          }}
        >
          <div className="w-full max-w-3xl mt-8 mb-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  setViewingBilanSaison(null);
                  setBilan(null);
                }}
                aria-label="Fermer le bilan"
                className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-white shadow-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
            {bilanLoading && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                Chargement…
              </div>
            )}
            {!bilanLoading && bilanError && (
              <p role="alert" className="text-center text-[#E63946] bg-white rounded-2xl shadow-sm p-8">
                {bilanError}
              </p>
            )}
            {!bilanLoading && !bilanError && bilan && <SeasonSummaryView summary={bilan} />}
          </div>
        </div>
      )}

      {userModal?.mode === "create" && (
        <UtilisateurFormModal mode="create" onSubmit={handleCreateUtilisateur} onClose={() => setUserModal(null)} />
      )}
      {userModal?.mode === "edit" && (
        <UtilisateurFormModal
          mode="edit"
          nomComplet={userModal.utilisateur.nom_complet}
          role={userModal.utilisateur.role}
          onSubmit={handleEditUtilisateur}
          onClose={() => setUserModal(null)}
        />
      )}
      {userModal?.mode === "reset-pin" && (
        <UtilisateurFormModal
          mode="reset-pin"
          nomComplet={userModal.utilisateur.nom_complet}
          onSubmit={handleResetPin}
          onClose={() => setUserModal(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Archiver cet utilisateur ?"
        message={
          deleteTarget
            ? `${deleteTarget.nom_complet} ne pourra plus se connecter et disparaîtra de cette liste.`
            : ""
        }
        confirmLabel="Archiver"
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
