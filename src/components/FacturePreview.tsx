// src/components/FacturePreview.tsx
//
// Rendu visuel de la facture — pur composant d'affichage (données déjà
// prêtes via buildFactureDocument(), src/lib/factureDocument.ts). Même
// principe de séparation données/rendu que TicketPreview.tsx, mais mis
// en forme comme un document officiel (pas contraint à la largeur d'un
// ticket thermique) : en-tête huilerie, numéro, date, client, détail du
// pressage facturé, montant, statut.
import { getStatutLabel, STATUT_COLOR_HEX } from "../lib/factureCalculations";
import type { FactureDocumentData } from "../lib/factureDocument";

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  HUILE: "Huile",
};

interface FacturePreviewProps {
  facture: FactureDocumentData;
}

export default function FacturePreview({ facture }: FacturePreviewProps) {
  const dateFacture = new Date(facture.dateFactureIso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      className="mx-auto w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 text-gray-900"
      aria-label={`Facture ${facture.numeroFacture}`}
    >
      <div className="flex justify-between items-start border-b-2 border-gray-100 pb-4 mb-4">
        <div>
          <p className="text-lg font-bold text-[#1B4332]">{facture.huilerieNom}</p>
          <p className="text-sm text-gray-500">Facture de service</p>
        </div>
        <div className="text-right">
          <p className="font-mono font-bold text-[#1B4332]">{facture.numeroFacture}</p>
          <p className="text-sm text-gray-500">{dateFacture}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Client</p>
          <p className="font-semibold text-gray-900">{facture.clientNom}</p>
        </div>

        {/* Le statut n'est jamais porté par la seule couleur : le
            libellé texte est toujours affiché à côté de la pastille
            (RGAA). */}
        <div className="flex items-center gap-2" role="status">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: STATUT_COLOR_HEX[facture.statut] }}
            aria-hidden="true"
          />
          <span className="font-semibold" style={{ color: STATUT_COLOR_HEX[facture.statut] }}>
            {getStatutLabel(facture.statut)}
          </span>
        </div>
      </div>

      {facture.pressage && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Détail</p>
          <div className="bg-[#F7F8FA] rounded-xl p-4 grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Ticket dépôt</span>
            <span className="font-mono text-right">{facture.pressage.numeroTicket}</span>
            <span className="text-gray-500">Poids d'olives</span>
            <span className="font-mono text-right">{facture.pressage.poidsOlivesKg.toFixed(2)} kg</span>
            <span className="text-gray-500">Huile obtenue</span>
            <span className="font-mono text-right">
              {facture.pressage.quantiteHuileKg?.toFixed(2) ?? "—"} kg
            </span>
            <span className="text-gray-500">Rendement</span>
            <span className="font-mono text-right">
              {facture.pressage.rendementFinal?.toFixed(2) ?? "—"} %
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-baseline border-t-2 border-gray-100 pt-4 mb-2">
        <span className="text-gray-600">Montant TTC</span>
        <span className="text-2xl font-mono font-bold text-[#1B4332]">
          {facture.montantTtc.toFixed(2)} DT
        </span>
      </div>
      <div className="flex justify-between items-baseline mb-6">
        <span className="text-gray-600">Reste dû</span>
        <span
          className="text-lg font-mono font-bold"
          style={{ color: facture.resteDu > 0 ? "#E63946" : "#2D6A4F" }}
        >
          {facture.resteDu.toFixed(2)} DT
        </span>
      </div>

      {facture.reglements.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Règlements</p>
          <ul className="space-y-2">
            {facture.reglements.map((reglement, index) => (
              <li
                key={index}
                className="flex justify-between items-center text-sm bg-[#F7F8FA] rounded-xl p-3"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {MODE_LABELS[reglement.mode] ?? reglement.mode}
                  </p>
                  <p className="text-gray-500">
                    {new Date(reglement.dateIso).toLocaleDateString("fr-FR")}
                    {reglement.note ? ` — ${reglement.note}` : ""}
                  </p>
                </div>
                <span className="font-mono font-semibold text-gray-900">
                  {reglement.montant.toFixed(2)} DT
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
        Dar Zitouna — document généré électroniquement, PDF téléchargeable à venir.
      </p>
    </div>
  );
}
