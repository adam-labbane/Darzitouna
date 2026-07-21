import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { PackageSearch } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getTicketPublic, type TicketPublic } from "../lib/ticketPublic";
import { computePaymentStatus } from "../lib/depotCalculations";
import { getStatutColor, getStatutLabel } from "../lib/factureCalculations";
import { getRendementColor, RENDEMENT_COLOR_HEX } from "../lib/pressageCalculations";
import { TYPE_HUILE_LABELS } from "../lib/cuveDisplay";
import {
  formatMontantDT,
  getPressageStatusClasses,
  getPressageStatusLabel,
  isValidTokenParam,
} from "../lib/ticketPublicDisplay";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function TicketPublicPage() {
  const { token } = useParams<{ token: string }>();
  const tokenValid = isValidTokenParam(token);
  const [ticket, setTicket] = useState<TicketPublic | null>(null);
  const [loading, setLoading] = useState(tokenValid);
  const [networkError, setNetworkError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tokenValid || !token) return;
    let cancelled = false;
    getTicketPublic(supabase, token)
      .then((data) => {
        if (cancelled) return;
        if (data) setTicket(data);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNetworkError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tokenValid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-4 flex justify-center">
        <div className="w-full max-w-sm mt-6">
          <Skeleton count={1} className="h-72" label="Chargement du ticket" />
        </div>
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-4 flex items-center justify-center">
        <p role="alert" className="text-center text-[#E63946] max-w-sm">
          Connexion impossible. Vérifiez votre connexion internet et réessayez.
        </p>
      </div>
    );
  }

  if (!tokenValid || notFound || !ticket) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-4 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <EmptyState icon={PackageSearch} title="Ticket introuvable" />
        </div>
      </div>
    );
  }

  const dateFormatee = new Date(ticket.date_depot).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const statutPaiement =
    ticket.montant_total !== null && ticket.montant_paye !== null
      ? computePaymentStatus(ticket.montant_total, ticket.montant_paye)
      : null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] p-4 flex justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-soft p-6 mt-6 h-fit">
        <p className="text-sm text-gray-500 text-center mb-1">{ticket.huilerie_nom}</p>
        <h1 className="text-xl font-bold text-[#1B4332] text-center mb-4">Ticket {ticket.numero_ticket}</h1>

        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-center font-semibold mb-4 ${getPressageStatusClasses(ticket.est_presse)}`}
        >
          {getPressageStatusLabel(ticket.est_presse)}
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Date de dépôt</dt>
            <dd className="font-semibold text-gray-900">{dateFormatee}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Poids d'olives</dt>
            <dd className="font-semibold text-gray-900">{ticket.poids_olives_kg.toFixed(2)} kg</dd>
          </div>

          {ticket.est_presse && (
            <>
              <div className="flex justify-between">
                <dt className="text-gray-500">Huile obtenue</dt>
                <dd className="font-semibold text-gray-900">
                  {ticket.quantite_huile_kg !== null ? `${ticket.quantite_huile_kg.toFixed(2)} kg` : "—"}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-gray-500">Rendement</dt>
                <dd
                  className="font-semibold"
                  style={
                    ticket.rendement_final !== null
                      ? { color: RENDEMENT_COLOR_HEX[getRendementColor(ticket.rendement_final)] }
                      : undefined
                  }
                >
                  {ticket.rendement_final !== null ? `${ticket.rendement_final.toFixed(2)} %` : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Type d'huile</dt>
                <dd className="font-semibold text-gray-900">
                  {ticket.type_huile ? TYPE_HUILE_LABELS[ticket.type_huile] : "—"}
                </dd>
              </div>
            </>
          )}
        </dl>

        {ticket.montant_total !== null && (
          <>
            <p className="text-xs uppercase tracking-widest text-gray-400 mt-5 mb-2">Paiement</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Montant total</dt>
                <dd className="font-mono font-semibold text-gray-900">{formatMontantDT(ticket.montant_total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Déjà payé</dt>
                <dd className="font-mono font-semibold text-gray-900">{formatMontantDT(ticket.montant_paye ?? 0)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-gray-600 font-semibold">Reste à payer</dt>
                <dd
                  className="font-mono text-lg font-bold"
                  style={statutPaiement ? { color: getStatutColor(statutPaiement) } : undefined}
                >
                  {formatMontantDT(ticket.reste_du ?? 0)}
                </dd>
              </div>
            </dl>
            {statutPaiement && (
              <p className="text-xs text-right font-semibold mt-1" style={{ color: getStatutColor(statutPaiement) }}>
                {getStatutLabel(statutPaiement)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
