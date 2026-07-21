import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { getHuilerieId } from "../lib/session";
import { getDepotById } from "../lib/depots";
import { getHuilerieName } from "../lib/huilerie";
import { buildTicketData, browserPrinter, type TicketData } from "../lib/ticket";
import TicketPreview from "../components/TicketPreview";

export default function DepotTicket() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const huilerieId = getHuilerieId();

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      getDepotById(supabase, id),
      huilerieId ? getHuilerieName(supabase, huilerieId) : Promise.resolve(null),
    ])
      .then(([depot, huilerieNom]) => {
        if (cancelled) return;
        if (!depot) {
          setError("Ticket introuvable.");
          return;
        }
        setTicket(buildTicketData(depot, depot.client?.nom_complet ?? "Client inconnu", huilerieNom ?? "Huilerie"));
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger ce ticket. Vérifiez votre connexion.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, huilerieId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FA] p-4 gap-4">
        <p role="alert" className="text-center text-[#E63946]">
          {error || "Ticket introuvable."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/depots")}
          className="h-12 min-w-[48px] px-5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
        >
          ← Retour aux dépôts
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] p-4 flex flex-col items-center">
      <TicketPreview ticket={ticket} />
      <div className="flex gap-3 mt-6 w-full max-w-[302px]">
        <button
          type="button"
          onClick={() => void browserPrinter.print(ticket)}
          className="flex-1 h-14 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-green-800"
        >
          Imprimer / Télécharger en PDF
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate("/depots")}
        className="mt-4 text-sm text-gray-500 underline min-h-[48px]"
      >
        Retour aux dépôts
      </button>
    </div>
  );
}
