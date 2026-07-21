// src/pages/ClientsList.tsx
//
// Liste des clients de l'huilerie : recherche, création, archivage. Le
// clic sur un client mène à sa fiche détaillée (/clients/:id,
// ClientProfil.tsx) — l'édition et l'historique complet y vivent
// désormais, ce n'est plus le rôle de cette liste. La logique métier
// (accès données, validation) est déléguée à src/lib/clients.ts,
// src/lib/clientSchema.ts et src/lib/clientProfile.ts — cette page
// orchestre l'UI et les états de chargement/erreur.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId } from "../lib/session";
import { archiveClient, createClient, getClients } from "../lib/clients";
import { getAllClientsFinancials, type ClientFinancials } from "../lib/clientProfile";
import { computeClientTotals, type ClientTotals } from "../lib/clientProfileCalculations";
import type { Client } from "../types/client";
import type { ClientFormInput } from "../lib/clientSchema";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePagination } from "../hooks/usePagination";
import ClientFormModal from "../components/ClientFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";

export default function ClientsList() {
  const navigate = useNavigate();
  const huilerieId = getHuilerieId();
  // Décision côté React : uniquement pour ne pas AFFICHER un bouton
  // interdit. La vraie protection est le trigger protect_client_archiving
  // côté base (voir supabase/migrations/20260720100000_client_soft_delete.sql) —
  // un opérateur qui appellerait l'API directement serait bloqué là-bas,
  // pas ici.
  const isGerant = getCurrentUser()?.role === "GERANT";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [formOpen, setFormOpen] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
  const [archiveError, setArchiveError] = useState("");

  // Total facturé et reste dû de chaque client, calculés (jamais
  // client.solde_compte seul — voir clientProfileCalculations.ts).
  // Chargés une fois indépendamment de la recherche (ne dépend pas du
  // texte tapé) ; non bloquant si l'appel échoue, les montants affichés
  // retombent alors sur le seul solde_compte via
  // computeClientTotals(..., financials[id] ?? vide, ...).
  const [financials, setFinancials] = useState<Record<string, ClientFinancials>>({});

  useEffect(() => {
    let cancelled = false;
    getAllClientsFinancials(supabase)
      .then((data) => {
        if (!cancelled) setFinancials(data);
      })
      .catch(() => {
        // Non bloquant : la liste reste utilisable, le reste dû affiché
        // se limite alors au solde_compte brut pour ces clients.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Un seul calcul (computeClientTotals) fournit total facturé ET reste
  // dû à partir des mêmes données déjà chargées en batch — jamais deux
  // calculs séparés qui pourraient diverger.
  const totalsFor = (client: Client): ClientTotals =>
    computeClientTotals(
      [],
      financials[client.id]?.factures ?? [],
      financials[client.id]?.reglements ?? [],
      client.solde_compte,
    );

  // Réutilisée après une création/archivage (event handlers) — aucun
  // souci à y appeler setState synchrone puisque ce n'est jamais invoqué
  // directement depuis un effect (voir plus bas).
  const fetchClients = useCallback(async (search: string) => {
    try {
      const data = await getClients(supabase, search);
      setClients(data);
      setError("");
    } catch {
      setError("Impossible de charger les clients. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, []);

  // L'effet n'appelle PAS fetchClients() : eslint-plugin-react-hooks trace
  // le fait que cette fonction appelle setState et refuse tout appel
  // depuis un effect, même après un await. Le pattern accepté est la
  // chaîne .then()/.catch()/.finally() écrite directement ici (même
  // principe que le chargement des utilisateurs dans Login.tsx) : les
  // setState sont dans des callbacks de promesse, pas dans le corps
  // synchrone de l'effect.
  useEffect(() => {
    let cancelled = false;
    getClients(supabase, debouncedSearch)
      .then((data) => {
        if (!cancelled) {
          setClients(data);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossible de charger les clients. Vérifiez votre connexion.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    // Retour visuel immédiat au clavier, avant même la fin du debounce.
    // Geste utilisateur direct : un setState ici n'est pas dans un effect,
    // donc parfaitement normal (contrairement à l'appel depuis l'effet).
    setLoading(true);
  };

  const handleFormSubmit = async (data: ClientFormInput) => {
    if (!huilerieId) return;
    await createClient(supabase, huilerieId, data);
    setFormOpen(false);
    // Pas de setLoading(true) : la liste reste affichée telle quelle
    // pendant le rafraîchissement, sans flash de skeleton.
    await fetchClients(debouncedSearch);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiveError("");
    try {
      await archiveClient(supabase, archiveTarget.id);
      setArchiveTarget(null);
      await fetchClients(debouncedSearch);
    } catch {
      setArchiveError("Impossible d'archiver ce client. Réessayez.");
    }
  };

  const { pageItems, currentPage, pageCount, goToPage } = usePagination(clients);

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[#1B4332] mb-3">Clients</h1>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Rechercher par nom ou téléphone"
          aria-label="Rechercher un client par nom ou téléphone"
          className="w-full h-[52px] px-4 border-2 border-gray-200 rounded-xl focus:border-[#2D6A4F] focus:outline-none"
        />
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        {loading && <Skeleton count={3} label="Chargement des clients" />}

        {!loading && error && (
          <p role="alert" className="text-center text-[#E63946] mt-8">
            {error}
          </p>
        )}

        {!loading && !error && clients.length === 0 && (
          <EmptyState
            icon={Users}
            title={searchInput ? "Aucun client ne correspond à cette recherche." : "Aucun client"}
            description={searchInput ? undefined : "Créez le premier avec le bouton +."}
          />
        )}

        {!loading && !error && clients.length > 0 && (
          <>
          <ul className="space-y-3">
            {pageItems.map((client) => {
              const totals = totalsFor(client);
              return (
                <li key={client.id} className="bg-white rounded-2xl shadow-soft p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-lg font-bold">
                    {client.nom_complet.charAt(0).toUpperCase()}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="flex-1 text-left min-h-[48px] min-w-[140px]"
                  >
                    <p className="font-semibold text-gray-900">{client.nom_complet}</p>
                    <p className="text-sm text-gray-500">{client.telephone ?? "Pas de téléphone"}</p>
                  </button>

                  {/* Deux valeurs distinctes, chacune avec son libellé —
                      jamais un montant seul sans savoir ce qu'il représente. */}
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Facturé</p>
                      <p className="font-semibold text-sm text-gray-700">{totals.totalFacture.toFixed(2)} DT</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Reste dû</p>
                      <p
                        className={`font-semibold text-sm ${
                          totals.resteDu > 0 ? "text-[#E63946]" : "text-[#2D6A4F]"
                        }`}
                      >
                        {totals.resteDu.toFixed(2)} DT
                      </p>
                    </div>
                  </div>

                  {isGerant && (
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(client)}
                      aria-label={`Archiver ${client.nom_complet}`}
                      className="min-w-[48px] min-h-[48px] rounded-xl text-[#E63946] hover:bg-red-50 font-semibold transition-colors motion-reduce:transition-none"
                    >
                      Archiver
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={currentPage} pageCount={pageCount} onPageChange={goToPage} />
          </>
        )}
      </main>

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        aria-label="Nouveau client"
        className="fixed bottom-24 md:bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 transition-transform motion-reduce:transition-none active:scale-95 flex items-center justify-center"
      >
        +
      </button>

      {formOpen && <ClientFormModal onSubmit={handleFormSubmit} onClose={() => setFormOpen(false)} />}

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archiver ce client ?"
        message={
          archiveTarget
            ? `${archiveTarget.nom_complet} ne sera plus visible dans la liste, mais son historique (dépôts, factures) est conservé.`
            : ""
        }
        confirmLabel="Archiver"
        destructive
        onConfirm={() => void handleArchiveConfirm()}
        onCancel={() => setArchiveTarget(null)}
      />

      {archiveError && (
        <p role="alert" className="fixed bottom-24 left-4 right-4 text-center text-[#E63946] bg-white rounded-xl shadow-lg p-3">
          {archiveError}
        </p>
      )}
    </div>
  );
}
