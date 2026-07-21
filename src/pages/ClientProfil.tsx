// src/pages/ClientProfil.tsx
//
// Fiche client détaillée : en-tête (reste dû visible), cartes de
// chiffres, 3 onglets (Dépôts/Factures/Règlements), bascule saison
// active / tout l'historique. Agrège Dépôts/Factures/Règlements
// (src/lib/clientProfile.ts) et calcule les totaux à la volée
// (src/lib/clientProfileCalculations.ts) — jamais le champ
// client.solde_compte seul, qui n'est qu'un ajustement manuel. Route
// /clients/:id.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { getCurrentUser } from "../lib/session";
import { getActiveSeason } from "../lib/depots";
import { getClientProfile, type ClientProfileData, type ClientProfileFacture } from "../lib/clientProfile";
import { computeClientTotals } from "../lib/clientProfileCalculations";
import { getStatutColor, getStatutLabel } from "../lib/factureCalculations";
import { getRendementColor, RENDEMENT_COLOR_HEX } from "../lib/pressageCalculations";
import { addReglement } from "../lib/factures";
import { archiveClient, updateClient } from "../lib/clients";
import type { Saison } from "../types/saison";
import type { StatutPaiement } from "../types/depot";
import type { ModeReglement } from "../types/reglement";
import type { ClientFormInput } from "../lib/clientSchema";
import ClientFormModal from "../components/ClientFormModal";
import ReglementModal from "../components/ReglementModal";
import ConfirmDialog from "../components/ConfirmDialog";

type Tab = "depots" | "pressages" | "factures" | "reglements";
type Scope = "active" | "all";

const TAB_LABELS: Record<Tab, string> = {
  depots: "Dépôts",
  pressages: "Pressages",
  factures: "Factures",
  reglements: "Règlements",
};

const DEPOT_STATUT_LABELS: Record<StatutPaiement, string> = {
  NON_PAYE: "Non payé",
  PARTIEL: "Partiel",
  PAYE: "Payé",
};

const DEPOT_STATUT_COLORS: Record<StatutPaiement, string> = {
  NON_PAYE: "text-[#E63946]",
  PARTIEL: "text-amber-600",
  PAYE: "text-[#2D6A4F]",
};

const MODE_LABELS: Record<ModeReglement, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  HUILE: "Huile",
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-mono font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function ClientProfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isGerant = getCurrentUser()?.role === "GERANT";

  // Périmètre : saison active par défaut, bascule possible vers tout
  // l'historique. On attend la résolution de la saison active avant le
  // premier chargement de la fiche, pour ne jamais afficher "historique
  // complet" par erreur pendant une fraction de seconde en scope "active".
  const [activeSaison, setActiveSaison] = useState<Saison | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("active");

  useEffect(() => {
    let cancelled = false;
    getActiveSeason(supabase)
      .then((saison) => {
        if (!cancelled) setActiveSaison(saison);
      })
      .catch(() => {
        // Non bloquant : sans saison active, la bascule "active" se
        // comporte comme "tout l'historique" (aucun filtre à appliquer).
      })
      .finally(() => {
        if (!cancelled) setSeasonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saisonIdPourFiltre = scope === "active" && activeSaison ? activeSaison.id : undefined;

  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || seasonLoading) return;
    let cancelled = false;
    getClientProfile(supabase, id, saisonIdPourFiltre)
      .then((data) => {
        if (!cancelled) {
          if (data) {
            setProfile(data);
            setNotFound(false);
          } else {
            setNotFound(true);
          }
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la fiche client. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, seasonLoading, saisonIdPourFiltre]);

  const refreshProfile = async () => {
    if (!id) return;
    try {
      const data = await getClientProfile(supabase, id, saisonIdPourFiltre);
      if (data) {
        setProfile(data);
        setError("");
      }
    } catch {
      setError("Impossible de charger la fiche client. Vérifiez votre connexion.");
    }
  };

  const handleScopeChange = (next: Scope) => {
    setLoading(true);
    setScope(next);
  };

  const [tab, setTab] = useState<Tab>("depots");

  const [editOpen, setEditOpen] = useState(false);
  const handleEditSubmit = async (data: ClientFormInput) => {
    if (!profile) return;
    await updateClient(supabase, profile.client.id, data);
    setEditOpen(false);
    await refreshProfile();
  };

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const handleArchiveConfirm = async () => {
    if (!profile) return;
    setArchiveError("");
    try {
      await archiveClient(supabase, profile.client.id);
      navigate("/clients");
    } catch {
      setArchiveError("Impossible d'archiver ce client — vérifiez qu'il n'a pas d'impayé.");
      setArchiveConfirmOpen(false);
    }
  };

  const [reglementTarget, setReglementTarget] = useState<ClientProfileFacture | null>(null);
  const handleReglementSubmit = async (data: { montant: number; mode: ModeReglement; note?: string }) => {
    if (!reglementTarget) return;
    await addReglement(supabase, { facture_id: reglementTarget.id, ...data });
    setReglementTarget(null);
    await refreshProfile();
  };

  if (seasonLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-4">
        <div className="space-y-3 max-w-3xl mx-auto" aria-label="Chargement de la fiche client">
          <div className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-64 rounded-2xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
        <p role="alert" className="text-center text-[#E63946]">
          {error}
        </p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FA] p-4 gap-4">
        <p role="alert" className="text-center text-gray-600">
          Client introuvable.
        </p>
        <button
          type="button"
          onClick={() => navigate("/clients")}
          className="h-12 min-w-[48px] px-5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
        >
          ← Retour aux clients
        </button>
      </div>
    );
  }

  const reglementsAplatis = profile.factures.flatMap((facture) =>
    facture.reglement.map((reglement) => ({ ...reglement, numeroFacture: facture.numero_facture })),
  );
  const totals = computeClientTotals(
    profile.depots,
    profile.factures,
    reglementsAplatis,
    profile.client.solde_compte,
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <button
          type="button"
          onClick={() => navigate("/clients")}
          className="min-h-[48px] px-3 -ml-3 mb-2 rounded-xl text-gray-600 font-semibold hover:bg-gray-50"
        >
          ← Retour aux clients
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1B4332]">{profile.client.nom_complet}</h1>
            <p className="text-sm text-gray-500">{profile.client.telephone ?? "Pas de téléphone"}</p>
          </div>

          {/* Le reste dû n'est jamais porté par la seule couleur : le
              libellé "Reste dû" accompagne toujours le montant. */}
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-gray-400">Reste dû</p>
            <p
              className="text-3xl font-mono font-bold"
              style={{ color: totals.resteDu > 0 ? "#E63946" : "#2D6A4F" }}
            >
              {totals.resteDu.toFixed(2)} DT
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="min-h-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            Modifier
          </button>
          {isGerant && (
            <button
              type="button"
              onClick={() => setArchiveConfirmOpen(true)}
              className="min-h-[48px] px-4 rounded-xl text-[#E63946] hover:bg-red-50 font-semibold"
            >
              Archiver
            </button>
          )}
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500" aria-live="polite">
            Période : {scope === "active" ? (activeSaison ? activeSaison.nom : "aucune saison active") : "tout l'historique"}
          </p>
          <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => handleScopeChange("active")}
              aria-pressed={scope === "active"}
              className={`min-h-[40px] px-3 rounded-lg text-sm font-semibold ${
                scope === "active" ? "bg-green-50 text-[#2D6A4F]" : "text-gray-500"
              }`}
            >
              Saison active
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("all")}
              aria-pressed={scope === "all"}
              className={`min-h-[40px] px-3 rounded-lg text-sm font-semibold ${
                scope === "all" ? "bg-green-50 text-[#2D6A4F]" : "text-gray-500"
              }`}
            >
              Tout l'historique
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatBlock label="Olives apportées" value={`${totals.totalKilos.toFixed(2)} kg`} />
          <StatBlock label="Dépôts" value={String(totals.nombreDepots)} />
          <StatBlock label="Total facturé" value={`${totals.totalFacture.toFixed(2)} DT`} />
          <StatBlock label="Total payé" value={`${totals.totalPaye.toFixed(2)} DT`} />
          <StatBlock label="Reste dû" value={`${totals.resteDu.toFixed(2)} DT`} />
        </div>

        <div role="tablist" aria-label="Détail du client" className="flex gap-2 mb-4 flex-wrap">
          {(["depots", "pressages", "factures", "reglements"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[48px] px-4 rounded-xl font-semibold ${
                tab === t
                  ? "bg-green-50 text-[#2D6A4F] border-2 border-[#2D6A4F]"
                  : "text-gray-600 border-2 border-transparent hover:bg-gray-50 bg-white"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === "depots" && (
          <section role="tabpanel" aria-label="Dépôts">
            {profile.depots.length === 0 ? (
              <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                Aucun dépôt {scope === "active" ? "cette saison" : ""}.
              </p>
            ) : (
              <ul className="space-y-3">
                {profile.depots.map((depot) => (
                  <li key={depot.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono font-bold text-[#1B4332]">{depot.numero_ticket}</span>
                      <span className="text-sm text-gray-400">
                        {new Date(depot.date_depot).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        {depot.poids_olives_kg.toFixed(2)} kg —{" "}
                        {depot.is_achat_olives ? "Achat direct" : "Prestation"}
                      </span>
                      {depot.is_achat_olives && (
                        <span className={`font-semibold ${DEPOT_STATUT_COLORS[depot.statut_paiement_achat]}`}>
                          {DEPOT_STATUT_LABELS[depot.statut_paiement_achat]}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "pressages" && (
          <section role="tabpanel" aria-label="Pressages">
            {profile.pressages.length === 0 ? (
              <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                Aucun pressage {scope === "active" ? "cette saison" : ""}.
              </p>
            ) : (
              <ul className="space-y-3">
                {profile.pressages.map((pressage) => {
                  const rendementColor =
                    pressage.rendement_final !== null ? getRendementColor(pressage.rendement_final) : null;
                  return (
                    <li key={pressage.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-[#1B4332]">
                          {pressage.depot?.numero_ticket ?? "—"}
                        </span>
                        <span className="text-sm text-gray-400">
                          {pressage.date_fin ? new Date(pressage.date_fin).toLocaleDateString("fr-FR") : "—"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {pressage.depot?.poids_olives_kg.toFixed(2) ?? "—"} kg olives →{" "}
                        {pressage.quantite_huile_kg?.toFixed(2) ?? "—"} kg huile
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        {/* Le rendement n'est jamais porté par la seule
                            couleur : la valeur en pourcentage est toujours
                            affichée à côté (RGAA). */}
                        {rendementColor ? (
                          <span className="font-semibold" style={{ color: RENDEMENT_COLOR_HEX[rendementColor] }}>
                            Rendement : {pressage.rendement_final?.toFixed(2)} %
                          </span>
                        ) : (
                          <span className="text-gray-400">Rendement inconnu</span>
                        )}
                        <span className="font-mono text-gray-700">
                          {pressage.montant_service_total?.toFixed(2) ?? "0.00"} DT
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "factures" && (
          <section role="tabpanel" aria-label="Factures">
            {profile.factures.length === 0 ? (
              <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                Aucune facture {scope === "active" ? "cette saison" : ""}.
              </p>
            ) : (
              <ul className="space-y-3">
                {profile.factures.map((facture) => (
                  <li key={facture.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono font-bold text-[#1B4332]">{facture.numero_facture}</span>
                      <span className="text-sm text-gray-400">
                        {new Date(facture.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-gray-700">{facture.montant_ttc.toFixed(2)} DT</span>
                      <span className="flex items-center gap-2" role="status">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: getStatutColor(facture.statut_paiement) }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold" style={{ color: getStatutColor(facture.statut_paiement) }}>
                          {getStatutLabel(facture.statut_paiement)}
                        </span>
                      </span>
                    </div>
                    {facture.statut_paiement !== "PAYE" && (
                      <button
                        type="button"
                        onClick={() => setReglementTarget(facture)}
                        className="mt-3 min-h-[48px] px-4 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 w-full sm:w-auto"
                      >
                        Enregistrer un règlement
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "reglements" && (
          <section role="tabpanel" aria-label="Règlements">
            {reglementsAplatis.length === 0 ? (
              <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                Aucun règlement {scope === "active" ? "cette saison" : ""}.
              </p>
            ) : (
              <ul className="space-y-3">
                {reglementsAplatis.map((reglement) => (
                  <li key={reglement.id} className="bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{MODE_LABELS[reglement.mode]}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(reglement.date_reglement).toLocaleDateString("fr-FR")} — facture{" "}
                        {reglement.numeroFacture}
                        {reglement.note ? ` — ${reglement.note}` : ""}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-gray-900">{reglement.montant.toFixed(2)} DT</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {editOpen && (
        <ClientFormModal
          initialValues={{ nom_complet: profile.client.nom_complet, telephone: profile.client.telephone }}
          onSubmit={handleEditSubmit}
          onClose={() => setEditOpen(false)}
        />
      )}

      {reglementTarget && (
        <ReglementModal
          montantTtc={reglementTarget.montant_ttc}
          reglements={reglementTarget.reglement}
          onSubmit={handleReglementSubmit}
          onClose={() => setReglementTarget(null)}
        />
      )}

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="Archiver ce client ?"
        message={`${profile.client.nom_complet} ne sera plus visible dans la liste, mais son historique (dépôts, factures) est conservé.`}
        confirmLabel="Archiver"
        destructive
        onConfirm={() => void handleArchiveConfirm()}
        onCancel={() => setArchiveConfirmOpen(false)}
      />

      {archiveError && (
        <p role="alert" className="fixed bottom-24 left-4 right-4 text-center text-[#E63946] bg-white rounded-xl shadow-lg p-3">
          {archiveError}
        </p>
      )}
    </div>
  );
}
