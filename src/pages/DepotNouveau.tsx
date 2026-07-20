// src/pages/DepotNouveau.tsx
//
// Wizard de création d'un dépôt, en 4 étapes : client → pesée → type de
// transaction → validation. Toute la logique métier (calculs, validation,
// accès données, génération du ticket) est déléguée à src/lib/ — cette
// page orchestre l'UI et l'état du formulaire.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId } from "../lib/session";
import { getClients, createClient } from "../lib/clients";
import { createDepot, getActiveSeason } from "../lib/depots";
import { getHuilerieName } from "../lib/huilerie";
import { computeNetWeight, computeRemainingDue, computeTotalAmount } from "../lib/depotCalculations";
import { depotSchema } from "../lib/depotSchema";
import { resolveBackAction } from "../lib/depotWizard";
import { buildTicketData, browserPrinter, type TicketData } from "../lib/ticket";
import type { Client } from "../types/client";
import type { Saison } from "../types/saison";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import ClientFormModal from "../components/ClientFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import TicketPreview from "../components/TicketPreview";

const TOTAL_STEPS = 4;

export default function DepotNouveau() {
  const navigate = useNavigate();
  const huilerieId = getHuilerieId();
  const currentUser = getCurrentUser();

  // Saison active — chargée une fois au montage. Pas de choix manuel
  // (décision d'architecture du module).
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
          // Non bloquant : le ticket affichera juste le nom par défaut.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  const [step, setStep] = useState(1);

  // Étape 1 — client
  const [clientSearch, setClientSearch] = useState("");
  const debouncedClientSearch = useDebouncedValue(clientSearch, 300);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientFormOpen, setClientFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClients(supabase, debouncedClientSearch)
      .then((data) => {
        if (!cancelled) setClientResults(data);
      })
      .catch(() => {
        if (!cancelled) setClientResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedClientSearch]);

  // Étape 2 — pesée
  const [poidsBrut, setPoidsBrut] = useState("");
  const [poidsTare, setPoidsTare] = useState("");
  const brutNum = Number(poidsBrut);
  const tareNum = Number(poidsTare);
  const poidsNetValide =
    poidsBrut !== "" && poidsTare !== "" && brutNum > 0 && tareNum >= 0 && tareNum < brutNum;
  const poidsNet = poidsNetValide ? computeNetWeight(brutNum, tareNum) : 0;
  const [refBac, setRefBac] = useState("");

  // Étape 3 — type de transaction
  const [isAchat, setIsAchat] = useState(false);
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [montantPaye, setMontantPaye] = useState("");
  const prixNum = Number(prixUnitaire);
  const montantPayeNum = Number(montantPaye);
  const montantTotal = poidsNetValide && prixNum > 0 ? computeTotalAmount(prixNum, poidsNet) : 0;
  const resteDu = computeRemainingDue(montantTotal, Number.isNaN(montantPayeNum) ? 0 : montantPayeNum);
  const achatValide =
    !isAchat ||
    (prixNum > 0 && montantPaye !== "" && montantPayeNum >= 0 && montantPayeNum <= montantTotal);

  // Étape 4 — validation + ticket
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const canGoNext =
    (step === 1 && selectedClient !== null) ||
    (step === 2 && poidsNetValide) ||
    (step === 3 && achatValide);

  // Bouton retour du wizard : à l'étape 1, "Précédent" devient "Quitter"
  // et ramène à la liste des dépôts — avec confirmation si l'opérateur a
  // déjà commencé à saisir quelque chose, pour éviter une perte
  // accidentelle (ConfirmDialog déjà utilisé pour l'archivage client).
  const hasUnsavedData =
    selectedClient !== null || poidsBrut !== "" || poidsTare !== "" || refBac !== "" || isAchat;
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const handleBack = () => {
    switch (resolveBackAction(step, hasUnsavedData)) {
      case "previous-step":
        setStep((s) => s - 1);
        break;
      case "confirm-exit":
        setExitConfirmOpen(true);
        break;
      case "exit":
        navigate("/depots");
        break;
    }
  };

  const handleClientCreated = async (data: { nom_complet: string; telephone?: string }) => {
    if (!huilerieId) return;
    const created = await createClient(supabase, huilerieId, data);
    setSelectedClient(created);
    setClientFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!season || !selectedClient || !currentUser) return;
    setSubmitError("");

    const result = depotSchema.safeParse({
      client_id: selectedClient.id,
      poids_brut_kg: brutNum,
      poids_tare_kg: tareNum,
      ref_bac: refBac.trim() === "" ? undefined : refBac.trim(),
      is_achat_olives: isAchat,
      prix_achat_unitaire: isAchat ? prixNum : undefined,
      montant_paye_achat: isAchat ? montantPayeNum : undefined,
    });

    if (!result.success) {
      setSubmitError("Le formulaire contient des erreurs. Vérifiez les étapes précédentes.");
      return;
    }

    setSubmitting(true);
    try {
      const depot = await createDepot(supabase, {
        ...result.data,
        saison_id: season.id,
        user_id: currentUser.id,
      });
      setTicket(buildTicketData(depot, selectedClient.nom_complet, huilerieNom));
    } catch {
      setSubmitError("Impossible d'enregistrer ce dépôt. Vérifiez votre connexion et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewDepot = () => {
    setStep(1);
    setSelectedClient(null);
    setClientSearch("");
    setPoidsBrut("");
    setPoidsTare("");
    setRefBac("");
    setIsAchat(false);
    setPrixUnitaire("");
    setMontantPaye("");
    setSubmitError("");
    setTicket(null);
  };

  // ---- États de garde ----

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
        <p role="alert" className="text-center text-gray-600 max-w-sm">
          Aucune saison active — le gérant doit en ouvrir une avant de pouvoir enregistrer un
          dépôt.
        </p>
      </div>
    );
  }

  // ---- Écran ticket (après validation) ----

  if (ticket) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-4 flex flex-col items-center">
        <h1 className="text-xl font-bold text-[#1B4332] mb-6">Dépôt enregistré</h1>
        <TicketPreview ticket={ticket} />
        <div className="flex gap-3 mt-6 w-full max-w-[302px]">
          <button
            type="button"
            onClick={() => void browserPrinter.print(ticket)}
            className="flex-1 h-14 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-green-800"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={handleNewDepot}
            className="flex-1 h-14 rounded-xl border-2 border-[#2D6A4F] text-[#2D6A4F] font-bold hover:bg-green-50"
          >
            Nouveau dépôt
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate("/depots")}
          className="mt-4 text-sm text-gray-500 underline min-h-[48px]"
        >
          Voir la liste des dépôts
        </button>
      </div>
    );
  }

  // ---- Wizard ----

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-8">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-xl font-bold text-[#1B4332]">Nouveau dépôt</h1>
        <p className="text-sm text-gray-500 mt-1" aria-live="polite">
          Étape {step} / {TOTAL_STEPS}
        </p>
        <div className="flex gap-1 mt-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-[#2D6A4F]" : "bg-gray-200"}`}
            />
          ))}
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* min-h stabilise la position du bloc de boutons (Précédent/
            Quitter/Suivant) d'une étape à l'autre. Sans ça, un contenu
            d'étape plus court (ex: pesée) fait remonter les boutons par
            rapport à un contenu plus long (ex: recherche client avec
            résultats) : un opérateur qui retape au même endroit après
            "Précédent" peut alors toucher un autre bouton que celui visé.
            Bug réel constaté : cf. plan de correction des bogues. */}
        <div className="min-h-[420px]">
        {step === 1 && (
          <section>
            <label htmlFor="client-search" className="block text-sm font-medium text-gray-600 mb-2">
              Rechercher un client
            </label>
            <input
              id="client-search"
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Nom ou téléphone"
              className="w-full h-[52px] px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none mb-3"
            />

            {selectedClient && (
              <p className="mb-3 p-3 rounded-xl bg-green-50 border-2 border-[#2D6A4F] text-[#1B4332] font-semibold">
                Client sélectionné : {selectedClient.nom_complet}
              </p>
            )}

            {/* max-h + overflow : sans borne, une liste de résultats longue
                pousse le bouton retour toujours plus bas, et une liste
                courte le remonte — le bouton change de position à chaque
                recherche/étape (voir le bug corrigé : un second tap au
                même endroit après être revenu à l'étape 1 atterrissait
                sur "+ Nouveau client" au lieu de "Quitter"). */}
            <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {clientResults.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    aria-pressed={selectedClient?.id === client.id}
                    className={`w-full text-left min-h-[56px] p-3 rounded-xl border-2 ${
                      selectedClient?.id === client.id
                        ? "border-[#2D6A4F] bg-green-50"
                        : "border-gray-200"
                    }`}
                  >
                    <p className="font-semibold">{client.nom_complet}</p>
                    <p className="text-sm text-gray-500">{client.telephone ?? "Pas de téléphone"}</p>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setClientFormOpen(true)}
              className="w-full h-14 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-semibold hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
            >
              + Nouveau client
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="poids-brut" className="block text-sm font-medium text-gray-600 mb-2">
                  Poids brut
                </label>
                <div className="relative">
                  <input
                    id="poids-brut"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={poidsBrut}
                    onChange={(event) => setPoidsBrut(event.target.value)}
                    className="w-full h-20 px-4 border-2 border-gray-200 rounded-xl font-mono text-3xl focus:border-[#2D6A4F] focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                    kg
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="poids-tare" className="block text-sm font-medium text-gray-600 mb-2">
                  Tare
                </label>
                <div className="relative">
                  <input
                    id="poids-tare"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={poidsTare}
                    onChange={(event) => setPoidsTare(event.target.value)}
                    className="w-full h-20 px-4 border-2 border-gray-200 rounded-xl font-mono text-3xl focus:border-[#2D6A4F] focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                    kg
                  </span>
                </div>
              </div>
            </div>

            {poidsBrut !== "" && poidsTare !== "" && !poidsNetValide && (
              <p role="alert" className="text-[#E63946] text-sm mb-4">
                La tare doit être inférieure au poids brut, et le poids brut supérieur à 0.
              </p>
            )}

            <div className="p-4 rounded-xl bg-green-50 border-2 border-[#2D6A4F] text-center mb-4">
              <p className="text-sm text-gray-600 mb-1">Poids net</p>
              <p className="text-4xl font-mono font-bold text-[#2D6A4F]">
                {poidsNetValide ? poidsNet.toFixed(2) : "—"} kg
              </p>
            </div>

            <label htmlFor="ref-bac" className="block text-sm font-medium text-gray-600 mb-2">
              Référence bac <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              id="ref-bac"
              type="text"
              value={refBac}
              onChange={(event) => setRefBac(event.target.value)}
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
            />
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setIsAchat(false)}
                aria-pressed={!isAchat}
                className={`h-24 rounded-xl border-2 font-bold ${
                  !isAchat ? "border-[#2D6A4F] bg-green-50 text-[#1B4332]" : "border-gray-200 text-gray-500"
                }`}
              >
                Prestation de service
              </button>
              <button
                type="button"
                onClick={() => setIsAchat(true)}
                aria-pressed={isAchat}
                className={`h-24 rounded-xl border-2 font-bold ${
                  isAchat ? "border-[#2D6A4F] bg-green-50 text-[#1B4332]" : "border-gray-200 text-gray-500"
                }`}
              >
                Achat direct
              </button>
            </div>

            {isAchat && (
              <div>
                <label htmlFor="prix-unitaire" className="block text-sm font-medium text-gray-600 mb-2">
                  Prix d'achat au kilo (DT)
                </label>
                <input
                  id="prix-unitaire"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={prixUnitaire}
                  onChange={(event) => setPrixUnitaire(event.target.value)}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono text-xl focus:border-[#2D6A4F] focus:outline-none mb-4"
                />

                <p className="text-sm text-gray-600 mb-4">
                  Montant total :{" "}
                  <span className="font-bold text-gray-900">{montantTotal.toFixed(2)} DT</span>
                </p>

                <label htmlFor="montant-paye" className="block text-sm font-medium text-gray-600 mb-2">
                  Montant payé (DT) <span className="text-gray-400 font-normal">(0 si différé)</span>
                </label>
                <input
                  id="montant-paye"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={montantPaye}
                  onChange={(event) => setMontantPaye(event.target.value)}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl font-mono text-xl focus:border-[#2D6A4F] focus:outline-none mb-2"
                />

                {montantPaye !== "" && !achatValide && (
                  <p role="alert" className="text-[#E63946] text-sm mb-2">
                    Le montant payé doit être entre 0 et le montant total.
                  </p>
                )}

                <p className="text-sm text-gray-600">
                  Reste dû : <span className="font-bold text-gray-900">{resteDu.toFixed(2)} DT</span>
                </p>
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 className="text-lg font-bold text-[#1B4332] mb-4">Récapitulatif</h2>
            <dl className="space-y-2 mb-6 text-gray-700">
              <div className="flex justify-between">
                <dt>Client</dt>
                <dd className="font-semibold">{selectedClient?.nom_complet}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Poids net</dt>
                <dd className="font-semibold">{poidsNet.toFixed(2)} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt>Type</dt>
                <dd className="font-semibold">{isAchat ? "Achat direct" : "Prestation de service"}</dd>
              </div>
              {isAchat && (
                <>
                  <div className="flex justify-between">
                    <dt>Montant total</dt>
                    <dd className="font-semibold">{montantTotal.toFixed(2)} DT</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Reste dû</dt>
                    <dd className="font-semibold">{resteDu.toFixed(2)} DT</dd>
                  </div>
                </>
              )}
            </dl>

            {submitError && (
              <p role="alert" className="text-[#E63946] text-sm mb-4 text-center">
                {submitError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? "Enregistrement…" : "Valider le dépôt"}
            </button>
          </section>
        )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleBack}
            className="h-14 min-w-[56px] px-6 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
          >
            {step > 1 ? "Précédent" : "Quitter"}
          </button>
          {step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext}
              className="flex-1 h-14 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-green-800 disabled:opacity-50"
            >
              Suivant
            </button>
          )}
        </div>
      </main>

      {clientFormOpen && (
        <ClientFormModal onSubmit={handleClientCreated} onClose={() => setClientFormOpen(false)} />
      )}

      <ConfirmDialog
        open={exitConfirmOpen}
        title="Quitter sans enregistrer ?"
        message="Les informations déjà saisies pour ce dépôt seront perdues."
        confirmLabel="Quitter"
        destructive
        onConfirm={() => navigate("/depots")}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </div>
  );
}
