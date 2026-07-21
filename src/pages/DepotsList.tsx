import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Truck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getHuilerieId } from "../lib/session";
import { getDepots } from "../lib/depots";
import { getHuilerieName } from "../lib/huilerie";
import { buildTicketData } from "../lib/ticket";
import type { DepotWithClient, StatutPaiement } from "../types/depot";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSeasonConsultation } from "../hooks/useSeasonConsultation";
import { usePagination } from "../hooks/usePagination";
import NoActiveSeasonMessage from "../components/NoActiveSeasonMessage";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import TicketPreview from "../components/TicketPreview";

const STATUT_LABELS: Record<StatutPaiement, string> = {
  NON_PAYE: "Non payé",
  PARTIEL: "Partiel",
  PAYE: "Payé",
};

const STATUT_COLORS: Record<StatutPaiement, string> = {
  NON_PAYE: "text-[#E63946]",
  PARTIEL: "text-amber-600",
  PAYE: "text-[#2D6A4F]",
};

export default function DepotsList() {
  const navigate = useNavigate();
  const huilerieId = getHuilerieId();
  const { consultedSaison, isReadOnly, loading: seasonLoading } = useSeasonConsultation();

  const [huilerieNom, setHuilerieNom] = useState("Huilerie");
  useEffect(() => {
    if (!huilerieId) return;
    let cancelled = false;
    getHuilerieName(supabase, huilerieId)
      .then((nom) => {
        if (!cancelled && nom) setHuilerieNom(nom);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  const [depots, setDepots] = useState<DepotWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statutFilter, setStatutFilter] = useState<StatutPaiement | "">("");
  const [selectedDepot, setSelectedDepot] = useState<DepotWithClient | null>(null);

  useEffect(() => {
    if (!consultedSaison) return;
    let cancelled = false;
    getDepots(supabase, consultedSaison.id, {
      search: debouncedSearch,
      statutPaiement: statutFilter || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setDepots(data);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les dépôts. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [consultedSaison, debouncedSearch, statutFilter]);

  const { pageItems, currentPage, pageCount, goToPage } = usePagination(depots);

  if (seasonLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (!consultedSaison) {
    return <NoActiveSeasonMessage action="enregistrer un dépôt" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[#1B4332] mb-3">Dépôts — {consultedSaison.nom}</h1>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setLoading(true);
          }}
          placeholder="Rechercher par ticket ou client"
          aria-label="Rechercher un dépôt par numéro de ticket ou nom de client"
          className="w-full h-[52px] px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none mb-3"
        />
        <label htmlFor="statut-filter" className="sr-only">
          Filtrer par statut de paiement
        </label>
        <select
          id="statut-filter"
          value={statutFilter}
          onChange={(event) => {
            setStatutFilter(event.target.value as StatutPaiement | "");
            setLoading(true);
          }}
          className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
        >
          <option value="">Tous les statuts de paiement</option>
          <option value="NON_PAYE">Non payé</option>
          <option value="PARTIEL">Partiel</option>
          <option value="PAYE">Payé</option>
        </select>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        {loading && <Skeleton count={3} label="Chargement des dépôts" />}

        {!loading && error && (
          <p role="alert" className="text-center text-[#E63946] mt-8">
            {error}
          </p>
        )}

        {!loading && !error && depots.length === 0 && (
          <EmptyState
            icon={Truck}
            title={
              searchInput || statutFilter
                ? "Aucun dépôt ne correspond à ces critères."
                : "Aucun dépôt cette saison"
            }
            description={
              searchInput || statutFilter
                ? undefined
                : isReadOnly
                  ? undefined
                  : "Créez le premier avec le bouton +."
            }
          />
        )}

        {!loading && !error && depots.length > 0 && (
          <>
            <ul className="space-y-3">
              {pageItems.map((depot) => (
                <li key={depot.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDepot(depot)}
                    className="w-full text-left bg-white rounded-2xl shadow-soft p-4 hover:border-2 hover:border-[#2D6A4F] transition-colors motion-reduce:transition-none"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-1 mb-1">
                      <span className="font-mono font-bold text-[#1B4332]">{depot.numero_ticket}</span>
                      <span className="text-sm text-gray-400">
                        {new Date(depot.date_depot).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {depot.client?.nom_complet ?? "Client inconnu"}
                    </p>
                    <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 mt-2 text-sm">
                      <span className="text-gray-600">
                        {depot.poids_olives_kg.toFixed(2)} kg —{" "}
                        {depot.is_achat_olives ? "Achat direct" : "Prestation"}
                      </span>
                      {depot.is_achat_olives && (
                        <span className={`font-semibold ${STATUT_COLORS[depot.statut_paiement_achat]}`}>
                          {STATUT_LABELS[depot.statut_paiement_achat]}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination currentPage={currentPage} pageCount={pageCount} onPageChange={goToPage} />
          </>
        )}
      </main>

      {!isReadOnly && (
        <button
          type="button"
          onClick={() => navigate("/depots/nouveau")}
          aria-label="Nouveau dépôt"
          className="fixed bottom-24 md:bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 transition-transform motion-reduce:transition-none active:scale-95 flex items-center justify-center"
        >
          +
        </button>
      )}

      {selectedDepot && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setSelectedDepot(null)}
        >
          <div className="w-full max-w-sm mt-8 mb-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setSelectedDepot(null)}
                aria-label="Fermer l'aperçu du ticket"
                className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-white shadow-soft font-semibold text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>

            <TicketPreview
              ticket={buildTicketData(
                selectedDepot,
                selectedDepot.client?.nom_complet ?? "Client inconnu",
                huilerieNom,
              )}
            />

            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => window.open(`/depots/${selectedDepot.id}/ticket`, "_blank", "noopener,noreferrer")}
                className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
              >
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
