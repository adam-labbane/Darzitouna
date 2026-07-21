// src/components/FactureCreationModal.tsx
//
// Génération d'une facture : recherche du client (même pattern que
// l'étape 1 du wizard DepotNouveau.tsx), puis sélection d'UN pressage
// non facturé parmi les siens (V1 simple — voir la décision
// d'architecture du module : une facture = un pressage). Contrairement
// aux modals CRUD existants (ClientFormModal, CuveFormModal), ce modal
// enchaîne deux recherches dépendantes ; il reçoit donc directement le
// client Supabase en prop plutôt que des données déjà chargées par le
// parent — extension minimale du même principe d'injection de
// dépendance déjà utilisé dans tout src/lib/.
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { getClients } from "../lib/clients";
import { getPressagesNonFactures, createFacture, type PressageNonFacture } from "../lib/factures";
import { factureSchema } from "../lib/factureSchema";
import type { Client } from "../types/client";
import type { Facture } from "../types/facture";

interface FactureCreationModalProps {
  client: SupabaseClient;
  onCreated: (facture: Facture) => void;
  onClose: () => void;
}

export default function FactureCreationModal({ client, onCreated, onClose }: FactureCreationModalProps) {
  const dialogRef = useFocusTrap(true, onClose);

  // Étape 1 — client
  const [clientSearch, setClientSearch] = useState("");
  const debouncedSearch = useDebouncedValue(clientSearch, 300);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClients(client, debouncedSearch)
      .then((data) => {
        if (!cancelled) setClientResults(data);
      })
      .catch(() => {
        if (!cancelled) setClientResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, debouncedSearch]);

  // Étape 2 — pressages non facturés du client sélectionné
  const [pressages, setPressages] = useState<PressageNonFacture[]>([]);
  const [pressagesLoading, setPressagesLoading] = useState(false);
  const [pressagesError, setPressagesError] = useState("");
  const [selectedPressageId, setSelectedPressageId] = useState("");

  // setPressagesLoading(true) part du gestionnaire handleSelectClient
  // (déclencheur de ce fetch), pas de l'effect lui-même : un setState
  // synchrone y est normal, contrairement à l'intérieur d'un effect —
  // même contrainte react-hooks/set-state-in-effect déjà rencontrée
  // dans DepotsList.tsx.
  useEffect(() => {
    if (!selectedClient) return;
    let cancelled = false;
    getPressagesNonFactures(client, selectedClient.id)
      .then((data) => {
        if (!cancelled) {
          setPressages(data);
          setPressagesError("");
        }
      })
      .catch(() => {
        if (!cancelled) setPressagesError("Impossible de charger les pressages de ce client.");
      })
      .finally(() => {
        if (!cancelled) setPressagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, selectedClient]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSelectClient = (candidate: Client) => {
    setSelectedClient(candidate);
    setSelectedPressageId("");
    setFormError("");
    setPressagesLoading(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    const result = factureSchema.safeParse({ pressage_id: selectedPressageId });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Sélectionnez un pressage.");
      return;
    }

    setSubmitting(true);
    try {
      const facture = await createFacture(client, result.data.pressage_id);
      onCreated(facture);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Impossible de générer cette facture. Réessayez.",
      );
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
        aria-labelledby="facture-creation-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="facture-creation-title" className="text-lg font-bold text-[#1B4332] mb-4">
          Nouvelle facture
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="facture-client-search" className="block text-sm font-medium text-gray-600 mb-2">
            Client
          </label>
          <input
            id="facture-client-search"
            type="search"
            value={clientSearch}
            onChange={(event) => {
              setClientSearch(event.target.value);
              setSelectedClient(null);
              setSelectedPressageId("");
            }}
            placeholder="Rechercher un client"
            className="w-full h-[52px] px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none mb-3"
          />

          {selectedClient && (
            <p className="mb-3 p-3 rounded-xl bg-green-50 border-2 border-[#2D6A4F] text-[#1B4332] font-semibold">
              Client sélectionné : {selectedClient.nom_complet}
            </p>
          )}

          {!selectedClient && clientResults.length > 0 && (
            <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {clientResults.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectClient(candidate)}
                    className="w-full text-left min-h-[56px] p-3 rounded-xl border-2 border-gray-200 hover:border-[#2D6A4F]"
                  >
                    <p className="font-semibold">{candidate.nom_complet}</p>
                    <p className="text-sm text-gray-500">{candidate.telephone ?? "Pas de téléphone"}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedClient && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Pressages non facturés
              </p>

              {pressagesLoading && <p className="text-sm text-gray-400">Chargement…</p>}
              {!pressagesLoading && pressagesError && (
                <p role="alert" className="text-sm text-[#E63946]">
                  {pressagesError}
                </p>
              )}
              {!pressagesLoading && !pressagesError && pressages.length === 0 && (
                <p className="text-sm text-gray-500">Aucun pressage non facturé pour ce client.</p>
              )}

              {!pressagesLoading && pressages.length > 0 && (
                <ul className="space-y-2 max-h-64 overflow-y-auto" role="radiogroup" aria-label="Pressage à facturer">
                  {pressages.map((pressage) => (
                    <li key={pressage.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selectedPressageId === pressage.id}
                        onClick={() => setSelectedPressageId(pressage.id)}
                        className={`w-full text-left min-h-[56px] p-3 rounded-xl border-2 flex justify-between items-center gap-3 ${
                          selectedPressageId === pressage.id
                            ? "border-[#2D6A4F] bg-green-50"
                            : "border-gray-200"
                        }`}
                      >
                        <span>
                          <span className="block font-mono font-semibold text-[#1B4332]">
                            {pressage.depot?.numero_ticket ?? "—"}
                          </span>
                          <span className="block text-sm text-gray-500">
                            {pressage.depot?.poids_olives_kg.toFixed(2) ?? "—"} kg —{" "}
                            {pressage.depot ? new Date(pressage.depot.date_depot).toLocaleDateString("fr-FR") : ""}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-gray-900">
                          {pressage.montant_service_total?.toFixed(2) ?? "0.00"} DT
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
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
            <button
              type="submit"
              disabled={submitting || !selectedPressageId}
              className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Génération…" : "Générer la facture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
