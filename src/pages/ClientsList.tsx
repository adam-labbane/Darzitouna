// src/pages/ClientsList.tsx
//
// Liste des clients de l'huilerie : recherche, création, édition,
// archivage. La logique métier (accès données, validation) est déléguée
// à src/lib/clients.ts et src/lib/clientSchema.ts — cette page orchestre
// l'UI et les états de chargement/erreur.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId } from "../lib/session";
import { archiveClient, createClient, getClients, updateClient } from "../lib/clients";
import type { Client } from "../types/client";
import type { ClientFormInput } from "../lib/clientSchema";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import ClientFormModal from "../components/ClientFormModal";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ClientsList() {
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
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
  const [archiveError, setArchiveError] = useState("");

  // Réutilisée après une création/édition/archivage (event handlers) —
  // aucun souci à y appeler setState synchrone puisque ce n'est jamais
  // invoqué directement depuis un effect (voir plus bas).
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

  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: ClientFormInput) => {
    if (editingClient) {
      await updateClient(supabase, editingClient.id, data);
    } else {
      if (!huilerieId) return;
      await createClient(supabase, huilerieId, data);
    }
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

      <main className="p-4">
        {loading && (
          <div className="space-y-3" aria-label="Chargement des clients">
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

        {!loading && !error && clients.length === 0 && (
          <p className="text-center text-gray-500 mt-8">
            {searchInput ? "Aucun client ne correspond à cette recherche." : "Aucun client — créez le premier."}
          </p>
        )}

        {!loading && !error && clients.length > 0 && (
          <ul className="space-y-3">
            {clients.map((client) => (
              <li
                key={client.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 shrink-0 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-lg font-bold">
                  {client.nom_complet.charAt(0).toUpperCase()}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(client)}
                  className="flex-1 text-left min-h-[48px]"
                >
                  <p className="font-semibold text-gray-900">{client.nom_complet}</p>
                  <p className="text-sm text-gray-500">{client.telephone ?? "Pas de téléphone"}</p>
                </button>

                <span
                  className={`font-semibold text-sm ${
                    client.solde_compte < 0 ? "text-[#E63946]" : "text-[#2D6A4F]"
                  }`}
                >
                  {client.solde_compte.toFixed(2)} DT
                </span>

                {isGerant && (
                  <button
                    type="button"
                    onClick={() => setArchiveTarget(client)}
                    aria-label={`Archiver ${client.nom_complet}`}
                    className="min-w-[48px] min-h-[48px] rounded-xl text-[#E63946] hover:bg-red-50 font-semibold"
                  >
                    Archiver
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <button
        type="button"
        onClick={handleOpenCreate}
        aria-label="Nouveau client"
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-[#2D6A4F] text-white text-3xl font-bold shadow-xl hover:bg-green-800 flex items-center justify-center"
      >
        +
      </button>

      {formOpen && (
        <ClientFormModal
          initialValues={
            editingClient
              ? { nom_complet: editingClient.nom_complet, telephone: editingClient.telephone }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

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
