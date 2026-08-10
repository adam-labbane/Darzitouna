import { AlertTriangle } from "lucide-react";

/**
 * Écran affiché à la place d'une page blanche quand une erreur non
 * rattrapée casse le rendu. L'incident React #527 avait laissé les
 * utilisateurs devant un écran vide, sans explication ni recours.
 */
export default function ErrorFallback() {
  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-[#EAF4EE] p-4"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <AlertTriangle size={36} aria-hidden="true" className="mx-auto text-[#E63946] mb-3" />
        <h1 className="text-lg font-bold text-[#1B4332] mb-2">Une erreur est survenue</h1>
        <p className="text-sm text-gray-600 mb-6">
          L'application a rencontré un problème inattendu. Vos données enregistrées ne sont pas
          affectées.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 min-w-[48px] w-full px-5 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
        >
          Recharger l'application
        </button>
      </div>
    </div>
  );
}
