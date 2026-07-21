// src/pages/Pressages.tsx
//
// Module Pressage : dépôts en attente de pressage + historique des
// pressages réalisés. La logique métier (accès données, calculs
// d'affichage) est déléguée à src/lib/pressages.ts et
// src/lib/pressageCalculations.ts — cette page orchestre l'UI, même
// architecture que Stocks.tsx/DepotsList.tsx.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getActiveSeason } from "../lib/depots";
import { getCuves } from "../lib/cuves";
import { createPressage, getDepotsEnAttente, getPressages } from "../lib/pressages";
import type { DepotEnAttente, PressageWithDepot } from "../lib/pressages";
import type { Saison } from "../types/saison";
import type { Cuve, TypeHuile } from "../types/cuve";
import { getRendementColor, RENDEMENT_COLOR_HEX } from "../lib/pressageCalculations";
import PressageModal from "../components/PressageModal";
import NoActiveSeasonMessage from "../components/NoActiveSeasonMessage";

export default function Pressages() {
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

  const [depotsEnAttente, setDepotsEnAttente] = useState<DepotEnAttente[]>([]);
  const [pressages, setPressages] = useState<PressageWithDepot[]>([]);
  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Chaîne .then/.catch/.finally écrite directement dans l'effect (pas
  // déléguée à une fonction async séparée) : react-hooks/set-state-in-effect
  // signale sinon tout effect qui appelle indirectement une fonction
  // posant du state, même correctement awaitée — même contrainte déjà
  // rencontrée dans Stocks.tsx/DepotsList.tsx. Pas de setLoading(true)
  // ici non plus : l'état initial vaut déjà true pour le premier
  // chargement (season passe de null à une valeur une seule fois).
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    Promise.all([
      getDepotsEnAttente(supabase, season.id),
      getPressages(supabase, season.id),
      getCuves(supabase),
    ])
      .then(([enAttente, realises, cuvesData]) => {
        if (!cancelled) {
          setDepotsEnAttente(enAttente);
          setPressages(realises);
          setCuves(cuvesData);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les pressages. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [season]);

  const [selectedDepot, setSelectedDepot] = useState<DepotEnAttente | null>(null);

  // Rechargement après une action utilisateur (pas dans un effect) :
  // un setState synchrone ici est normal, la règle ne s'applique qu'aux
  // effects.
  const refreshData = async (saisonId: string) => {
    try {
      const [enAttente, realises, cuvesData] = await Promise.all([
        getDepotsEnAttente(supabase, saisonId),
        getPressages(supabase, saisonId),
        getCuves(supabase),
      ]);
      setDepotsEnAttente(enAttente);
      setPressages(realises);
      setCuves(cuvesData);
      setError("");
    } catch {
      setError("Impossible de charger les pressages. Vérifiez votre connexion.");
    }
  };

  const handleSubmitPressage = async (data: {
    cuve_id: string;
    quantite_huile_kg: number;
    type_huile: TypeHuile;
  }) => {
    if (!selectedDepot || !season) return;
    await createPressage(supabase, {
      depot_id: selectedDepot.id,
      cuve_id: data.cuve_id,
      quantite_huile_kg: data.quantite_huile_kg,
      type_huile: data.type_huile,
    });
    setSelectedDepot(null);
    await refreshData(season.id);
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
    return <NoActiveSeasonMessage action="presser un dépôt" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-xl font-bold text-[#1B4332]">Pressage — {season.nom}</h1>
      </header>

      <main className="p-4 space-y-6">
        {loading && (
          <div className="space-y-3" aria-label="Chargement des pressages">
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

        {!loading && !error && (
          <>
            <section>
              <h2 className="font-bold text-gray-900 mb-3">
                Dépôts en attente de pressage ({depotsEnAttente.length})
              </h2>
              {depotsEnAttente.length === 0 && (
                <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                  Aucun dépôt en attente.
                </p>
              )}
              {depotsEnAttente.length > 0 && (
                <ul className="space-y-3">
                  {depotsEnAttente.map((depot) => (
                    <li key={depot.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-[#1B4332]">
                          {depot.numero_ticket}
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(depot.date_depot).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {depot.client?.nom_complet ?? "Client inconnu"}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">
                          {depot.poids_olives_kg.toFixed(2)} kg —{" "}
                          {depot.is_achat_olives ? "Achat direct" : "Prestation"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedDepot(depot)}
                          className="min-h-[48px] px-4 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
                        >
                          Presser
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-bold text-gray-900 mb-3">
                Pressages réalisés ({pressages.length})
              </h2>
              {pressages.length === 0 && (
                <p className="text-center text-gray-500 bg-white rounded-2xl shadow-sm p-6">
                  Aucun pressage réalisé cette saison.
                </p>
              )}
              {pressages.length > 0 && (
                <ul className="space-y-3">
                  {pressages.map((pressage) => {
                    const color =
                      pressage.rendement_final !== null
                        ? getRendementColor(pressage.rendement_final)
                        : null;
                    return (
                      <li key={pressage.id} className="bg-white rounded-2xl shadow-sm p-4">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono font-bold text-[#1B4332]">
                            {pressage.depot?.numero_ticket ?? "—"}
                          </span>
                          <span className="text-sm text-gray-400">
                            {pressage.date_fin
                              ? new Date(pressage.date_fin).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {pressage.depot?.client?.nom_complet ?? "Client inconnu"}
                        </p>
                        <div className="flex justify-between items-center mt-2 text-sm">
                          <span className="font-mono text-gray-700">
                            {pressage.quantite_huile_kg?.toFixed(2) ?? "—"} kg d'huile
                          </span>
                          {pressage.rendement_final !== null && color && (
                            <span
                              className="font-semibold"
                              style={{ color: RENDEMENT_COLOR_HEX[color] }}
                            >
                              {pressage.rendement_final.toFixed(2)} %
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Montant du service :{" "}
                          <span className="font-mono">
                            {pressage.montant_service_total?.toFixed(2) ?? "0.00"} DT
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {selectedDepot && (
        <PressageModal
          depot={selectedDepot}
          cuves={cuves}
          prixKiloService={season.config_prix_kilo_service}
          onSubmit={handleSubmitPressage}
          onClose={() => setSelectedDepot(null)}
        />
      )}
    </div>
  );
}
