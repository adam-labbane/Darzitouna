// src/components/SeasonSummaryView.tsx
//
// Rendu visuel du bilan de saison — pur composant d'affichage (données
// déjà prêtes via buildSeasonSummary(), src/lib/seasonSummary.ts). Même
// principe de séparation données/rendu que TicketPreview.tsx/
// FacturePreview.tsx : un futur générateur PDF réel consommera la même
// SeasonSummaryData sans toucher à ce composant. .print-area (src/index.css)
// est la seule chose visible à l'impression (window.print()).
import { formatLiters } from "../lib/cuveDisplay";
import type { SeasonSummaryData } from "../lib/seasonSummary";

interface SeasonSummaryViewProps {
  summary: SeasonSummaryData;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F7F8FA] rounded-xl p-4">
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-mono font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function SeasonSummaryView({ summary }: SeasonSummaryViewProps) {
  return (
    <div>
      <div
        className="print-area mx-auto w-full max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 text-gray-900"
        aria-label={`Bilan de la saison ${summary.saisonNom}`}
      >
        <div className="text-center border-b-2 border-gray-100 pb-4 mb-6">
          <p className="text-lg font-bold text-[#1B4332]">{summary.huilerieNom}</p>
          <p className="text-sm text-gray-500">Bilan de campagne</p>
          <p className="text-2xl font-bold text-[#1B4332] mt-2">{summary.saisonNom}</p>
          <p className="text-sm text-gray-500">
            {summary.dateDebut ?? "—"} au {summary.dateFin ?? "—"}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Production</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBlock label="Olives reçues" value={`${summary.totalOlivesKg.toFixed(2)} kg`} />
            <StatBlock
              label="Dépôts"
              value={`${summary.nombreDepots} (${summary.nombrePrestation} prest. / ${summary.nombreAchat} achat)`}
            />
            <StatBlock label="Huile produite" value={`${summary.totalHuileKg.toFixed(2)} kg`} />
            <StatBlock label="Rendement moyen" value={`${summary.rendementMoyenPct.toFixed(2)} %`} />
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Facturation</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBlock label="Total facturé" value={`${summary.totalFacture.toFixed(2)} DT`} />
            <StatBlock label="Total encaissé" value={`${summary.totalEncaisse.toFixed(2)} DT`} />
            <StatBlock label="Reste dû" value={`${summary.totalResteDu.toFixed(2)} DT`} />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            État des cuves à la clôture
          </p>
          {summary.cuves.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune cuve.</p>
          ) : (
            <ul className="space-y-2">
              {summary.cuves.map((cuve, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center text-sm bg-[#F7F8FA] rounded-xl p-3"
                >
                  <span className="font-semibold text-gray-900">{cuve.nomReference}</span>
                  <span className="font-mono text-gray-700">
                    {formatLiters(cuve.niveauActuel)} / {formatLiters(cuve.capaciteMax)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
          Dar Zitouna — bilan généré électroniquement.
        </p>
      </div>

      <div className="flex justify-center mt-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-14 min-w-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
        >
          Imprimer
        </button>
      </div>
    </div>
  );
}
