// src/pages/Factures.tsx
//
// Module Facturation : liste des factures de la saison + génération
// depuis un pressage non facturé + détail (aperçu + règlements). La
// logique métier (accès données, calculs d'affichage) est déléguée à
// src/lib/factures.ts, src/lib/factureCalculations.ts et
// src/lib/factureDocument.ts — cette page orchestre l'UI, même
// architecture que Pressages.tsx/Stocks.tsx.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getHuilerieId } from "../lib/session";
import { getActiveSeason } from "../lib/depots";
import { getHuilerieName } from "../lib/huilerie";
import { addReglement, getFactureById, getFactures } from "../lib/factures";
import { buildFactureDocument } from "../lib/factureDocument";
import { getStatutColor, getStatutLabel } from "../lib/factureCalculations";
import type { Facture, FactureWithClient, FactureWithRelations } from "../types/facture";
import type { Saison } from "../types/saison";
import type { ModeReglement } from "../types/reglement";
import FactureCreationModal from "../components/FactureCreationModal";
import FacturePreview from "../components/FacturePreview";
import ReglementModal from "../components/ReglementModal";
import NoActiveSeasonMessage from "../components/NoActiveSeasonMessage";

export default function Factures() {
  const huilerieId = getHuilerieId();

  const [season, setSeason] = useState<Saison | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [seasonError, setSeasonError] = useState("");
  const [huilerieNom, setHuilerieNom] = useState("Huilerie");

  useEffect(() => {
    let cancelled = false;
    getActiveSeason(supabase)
      .then((data) => {
        if (!cancelled) setSeason(data);
      })
      .catch(() => {
        if (!cancelled) {
          setSeasonError("Impossible de vérifier la saison active. Vérifiez votre connexion.");
        }
      })
      .finally(() => {
        if (!cancelled) setSeasonLoading(false);
      });

    if (huilerieId) {
      getHuilerieName(supabase, huilerieId)
        .then((nom) => {
          if (!cancelled && nom) setHuilerieNom(nom);
        })
        .catch(() => {
          // Non bloquant : l'aperçu affichera juste le nom par défaut.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  const [factures, setFactures] = useState<FactureWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    getFactures(supabase, season.id)
      .then((data) => {
        if (!cancelled) {
          setFactures(data);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les factures. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [season]);

  const refreshFactures = async () => {
    if (!season) return;
    try {
      const data = await getFactures(supabase, season.id);
      setFactures(data);
      setError("");
    } catch {
      setError("Impossible de charger les factures. Vérifiez votre connexion.");
    }
  };

  const [creationOpen, setCreationOpen] = useState(false);

  const [selectedFactureId, setSelectedFactureId] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<FactureWithRelations | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [reglementOpen, setReglementOpen] = useState(false);

  // setDetailLoading(true) part des gestionnaires qui posent
  // selectedFactureId (clic sur une facture, création réussie), pas de
  // l'effect lui-même — même contrainte react-hooks/set-state-in-effect
  // déjà rencontrée dans FactureCreationModal.tsx/DepotsList.tsx.
  useEffect(() => {
    if (!selectedFactureId) return;
    let cancelled = false;
    getFactureById(supabase, selectedFactureId)
      .then((data) => {
        if (!cancelled) {
          setSelectedFacture(data);
          setDetailError("");
        }
      })
      .catch(() => {
        if (!cancelled) setDetailError("Impossible de charger cette facture. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFactureId]);

  const handleFactureCreated = (facture: Facture) => {
    setCreationOpen(false);
    void refreshFactures();
    setDetailLoading(true);
    setSelectedFactureId(facture.id);
  };

  const handleReglementSubmit = async (data: { montant: number; mode: ModeReglement; note?: string }) => {
    if (!selectedFactureId) return;
    await addReglement(supabase, { facture_id: selectedFactureId, ...data });
    // Le modal ne se ferme qu'une fois la facture rechargée : sinon
    // l'aperçu sous-jacent (jamais démonté, seulement masqué par le
    // modal) redeviendrait visible un instant avec le statut/reste dû
    // encore périmés, avant que le re-fetch ne termine.
    const [refreshedFacture] = await Promise.all([
      getFactureById(supabase, selectedFactureId),
      refreshFactures(),
    ]);
    setSelectedFacture(refreshedFacture);
    setReglementOpen(false);
  };

  if (seasonLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (seasonError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
        <p role="alert" className="text-center text-[#E63946]">
          {seasonError}
        </p>
      </div>
    );
  }

  if (!season) {
    return <NoActiveSeasonMessage action="facturer" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-xl font-bold text-[#1B4332]">Facturation — {season.nom}</h1>
      </header>

      <main className="p-4">
        {loading && (
          <div className="space-y-3" aria-label="Chargement des factures">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p role="alert" className="text-center text-[#E63946] mt-8">
            {error}
          </p>
        )}

        {!loading && !error && factures.length === 0 && (
          <p className="text-center text-gray-500 mt-8">
            Aucune facture cette saison — générez la première depuis un pressage.
          </p>
        )}

        {!loading && !error && factures.length > 0 && (
          <ul className="space-y-3">
            {factures.map((facture) => (
              <li key={facture.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailLoading(true);
                    setSelectedFactureId(facture.id);
                  }}
                  className="w-full text-left bg-white rounded-2xl shadow-sm p-4 hover:border-2 hover:border-[#2D6A4F]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono font-bold text-[#1B4332]">{facture.numero_facture}</span>
                    <span className="text-sm text-gray-400">
                      {new Date(facture.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {facture.client?.nom_complet ?? "Client inconnu"}
                  </p>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="font-mono text-gray-700">{facture.montant_ttc.toFixed(2)} DT</span>
                    {/* Le statut n'est jamais porté par la seule couleur :
                        le libellé texte accompagne toujours la pastille. */}
                    <span className="flex items-center gap-2" role="status">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: getStatutColor(facture.statut_paiement) }}
                        aria-hidden="true"
                      />
                      <span
                        className="font-semibold"
                        style={{ color: getStatutColor(facture.statut_paiement) }}
                      >
                        {getStatutLabel(facture.statut_paiement)}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <button
        type="button"
        onClick={() => setCreationOpen(true)}
        aria-label="Nouvelle facture"
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 flex items-center justify-center"
      >
        +
      </button>

      {creationOpen && (
        <FactureCreationModal
          client={supabase}
          onCreated={handleFactureCreated}
          onClose={() => setCreationOpen(false)}
        />
      )}

      {selectedFactureId && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setSelectedFactureId(null)}
        >
          <div className="w-full max-w-2xl mt-8 mb-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setSelectedFactureId(null)}
                aria-label="Fermer l'aperçu de la facture"
                className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-white shadow-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>

            {detailLoading && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                Chargement…
              </div>
            )}
            {!detailLoading && detailError && (
              <p role="alert" className="text-center text-[#E63946] bg-white rounded-2xl shadow-sm p-8">
                {detailError}
              </p>
            )}
            {!detailLoading && !detailError && selectedFacture && (
              <>
                <FacturePreview facture={buildFactureDocument(selectedFacture, huilerieNom)} />
                {selectedFacture.statut_paiement !== "PAYE" && (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={() => setReglementOpen(true)}
                      className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
                    >
                      Enregistrer un règlement
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {reglementOpen && selectedFacture && (
        <ReglementModal
          montantTtc={selectedFacture.montant_ttc}
          reglements={selectedFacture.reglement}
          onSubmit={handleReglementSubmit}
          onClose={() => setReglementOpen(false)}
        />
      )}
    </div>
  );
}
