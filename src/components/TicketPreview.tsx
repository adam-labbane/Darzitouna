import { useEffect, useState } from "react";
import type { TicketData } from "../lib/ticket";
import { buildPublicTicketUrl, generateQrDataUrl } from "../lib/qrcode";

interface TicketPreviewProps {
  ticket: TicketData;
}

export default function TicketPreview({ ticket }: TicketPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    generateQrDataUrl(buildPublicTicketUrl(ticket.tokenPublic))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticket.tokenPublic]);

  const dateFormatee = new Date(ticket.dateDepotIso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="print-ticket-area mx-auto w-full max-w-[302px] bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-sm text-gray-900"
      aria-label="Aperçu du ticket de dépôt"
    >
      <p className="text-center font-bold text-base mb-2">{ticket.huilerieNom}</p>
      <div className="border-t border-dashed border-gray-400 my-2" />

      <p>
        Ticket : <span className="font-bold">{ticket.numeroTicket}</span>
      </p>
      <p>{dateFormatee}</p>

      <div className="border-t border-dashed border-gray-400 my-2" />

      <p>Client : {ticket.clientNom}</p>
      <p>Type : {ticket.isAchat ? "Achat direct" : "Prestation de service"}</p>

      <div className="border-t border-dashed border-gray-400 my-2" />

      <p className="text-center text-lg font-bold text-[#2D6A4F]">
        {ticket.poidsNetKg.toFixed(2)} kg net
      </p>

      {ticket.isAchat && ticket.montantTotal !== undefined && (
        <p className="text-center text-lg font-bold mt-2">{ticket.montantTotal.toFixed(2)} DT</p>
      )}

      <div className="border-t border-dashed border-gray-400 my-2" />

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-1 py-2">
          <img src={qrDataUrl} alt={`Suivi du dépôt ${ticket.numeroTicket}`} width={160} height={160} />
          <p className="text-center text-xs text-gray-500">Scannez pour suivre votre dépôt</p>
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 my-2" />
      <p className="text-center text-xs text-gray-500">Preuve de dépôt — Dar Zitouna</p>
    </div>
  );
}
