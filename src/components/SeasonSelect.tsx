import { useSeasonConsultation } from "../hooks/useSeasonConsultation";

export default function SeasonSelect() {
  const { allSaisons, consultedSaison, setConsultedSaisonId, loading } = useSeasonConsultation();

  if (loading || allSaisons.length === 0) return null;

  return (
    <div>
      <label htmlFor="season-select" className="sr-only">
        Saison consultée
      </label>
      <select
        id="season-select"
        value={consultedSaison?.id ?? ""}
        onChange={(event) => setConsultedSaisonId(event.target.value)}
        className="h-10 px-3 rounded-lg border-2 border-gray-200 text-sm font-medium bg-white focus:border-brand focus:outline-none max-w-[140px] sm:max-w-[220px]"
      >
        {allSaisons.map((saison) => (
          <option key={saison.id} value={saison.id}>
            {saison.nom}
            {saison.is_active ? " (active)" : saison.date_cloture ? " (clôturée)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
