// src/pages/DepotsList.tsx
//
// Liste des dépôts de la saison active : recherche (ticket/client), filtre
// par statut de paiement, FAB pour créer un nouveau dépôt. Même
// architecture que ClientsList.tsx (lib/depots.ts porte la logique).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { getDepots, getActiveSeason } from "../lib/depots";
import type { DepotWithClient, StatutPaiement } from "../types/depot";
import type { Saison } from "../types/saison";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import NoActiveSeasonMessage from "../components/NoActiveSeasonMessage";

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

  const [season, setSeason] = useState<Saison | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [seasonError, setSeasonError] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, []);

  const [depots, setDepots] = useState<DepotWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statutFilter, setStatutFilter] = useState<StatutPaiement | "">("");

  // Pas de setLoading(true) ici : l'état initial vaut déjà true pour le
  // premier chargement, et les changements de recherche/filtre le
  // déclenchent depuis leurs propres gestionnaires d'événement plus bas
  // (un setState synchrone y est normal, contrairement à l'intérieur d'un
  // effect — cf. la même correction déjà appliquée dans ClientsList.tsx).
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    getDepots(supabase, season.id, {
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
  }, [season, debouncedSearch, statutFilter]);

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
    return <NoActiveSeasonMessage action="enregistrer un dépôt" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[#1B4332] mb-3">Dépôts — {season.nom}</h1>
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

      <main className="p-4">
        {loading && (
          <div className="space-y-3" aria-label="Chargement des dépôts">
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

        {!loading && !error && depots.length === 0 && (
          <p className="text-center text-gray-500 mt-8">
            {searchInput || statutFilter
              ? "Aucun dépôt ne correspond à ces critères."
              : "Aucun dépôt cette saison — créez le premier."}
          </p>
        )}

        {!loading && !error && depots.length > 0 && (
          <ul className="space-y-3">
            {depots.map((depot) => (
              <li key={depot.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono font-bold text-[#1B4332]">{depot.numero_ticket}</span>
                  <span className="text-sm text-gray-400">
                    {new Date(depot.date_depot).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <p className="font-semibold text-gray-900">
                  {depot.client?.nom_complet ?? "Client inconnu"}
                </p>
                <div className="flex justify-between items-center mt-2 text-sm">
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
              </li>
            ))}
          </ul>
        )}
      </main>

      <button
        type="button"
        onClick={() => navigate("/depots/nouveau")}
        aria-label="Nouveau dépôt"
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}
