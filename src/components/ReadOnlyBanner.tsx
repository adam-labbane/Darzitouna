import { useSeasonConsultation } from "../hooks/useSeasonConsultation";

export default function ReadOnlyBanner() {
  const { isReadOnly, consultedSaison, activeSaison, setConsultedSaisonId } = useSeasonConsultation();

  if (!isReadOnly || !consultedSaison) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-sm text-amber-800">
        <span className="font-semibold">Lecture seule</span> — vous consultez la saison{" "}
        {consultedSaison.nom}.
      </p>
      {activeSaison && (
        <button
          type="button"
          onClick={() => setConsultedSaisonId(activeSaison.id)}
          className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-brand-dark bg-white border-2 border-amber-300 hover:bg-amber-100 transition-colors motion-reduce:transition-none"
        >
          Revenir à la saison active
        </button>
      )}
    </div>
  );
}
