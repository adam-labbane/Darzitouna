import { useNavigate } from "react-router";
import { PackagePlus, Settings, Users } from "lucide-react";
import { getCurrentUser } from "../lib/session";
import { useSeasonConsultation } from "../hooks/useSeasonConsultation";

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const prenom = currentUser?.nom.split(" ")[0] ?? "";
  const isGerant = currentUser?.role === "GERANT";
  const { isReadOnly } = useSeasonConsultation();

  const dateFormatee = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[#1B4332]">Bonjour {prenom}</h1>
      <p className="text-gray-500 capitalize mb-8">{dateFormatee}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => navigate("/depots/nouveau")}
            className="flex flex-col items-start gap-3 p-6 min-h-[140px] bg-white rounded-2xl shadow-soft border-2 border-transparent hover:border-[#2D6A4F] text-left transition-colors motion-reduce:transition-none"
          >
            <PackagePlus size={32} className="text-[#2D6A4F]" aria-hidden="true" />
            <span className="font-bold text-gray-900">Nouveau dépôt</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/clients")}
          className="flex flex-col items-start gap-3 p-6 min-h-[140px] bg-white rounded-2xl shadow-soft border-2 border-transparent hover:border-[#2D6A4F] text-left transition-colors motion-reduce:transition-none"
        >
          <Users size={32} className="text-[#2D6A4F]" aria-hidden="true" />
          <span className="font-bold text-gray-900">Rechercher un client</span>
        </button>

        {isGerant && (
          <button
            type="button"
            onClick={() => navigate("/config")}
            className="flex flex-col items-start gap-3 p-6 min-h-[140px] bg-white rounded-2xl shadow-soft border-2 border-transparent hover:border-[#2D6A4F] text-left transition-colors motion-reduce:transition-none"
          >
            <Settings size={32} className="text-[#2D6A4F]" aria-hidden="true" />
            <span className="font-bold text-gray-900">Configuration</span>
          </button>
        )}
      </div>

    </div>
  );
}
