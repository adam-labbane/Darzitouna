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
  const isGerant = getCurrentUser()?.role === "GERANT";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [formOpen, setFormOpen] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
  const [archiveError, setArchiveError] = useState("");

  const [financials, setFinancials] = useState<Record<string, ClientFinancials>>({});

  useEffect(() => {
    let cancelled = false;
    getAllClientsFinancials(supabase)
      .then((data) => {
        if (!cancelled) setFinancials(data);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalsFor = (client: Client): ClientTotals =>
    computeClientTotals(
      [],
      financials[client.id]?.factures ?? [],
      financials[client.id]?.reglements ?? [],
      client.solde_compte,
    );

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
    setLoading(true);
  };

  const handleFormSubmit = async (data: ClientFormInput) => {
    if (!huilerieId) return;
    await createClient(supabase, huilerieId, data);
    setFormOpen(false);
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
