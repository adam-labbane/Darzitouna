import { Link } from "react-router";
import { getCurrentUser } from "../lib/session";

interface NoActiveSeasonMessageProps {
  action: string;
}

export default function NoActiveSeasonMessage({ action }: NoActiveSeasonMessageProps) {
  const isGerant = getCurrentUser()?.role === "GERANT";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
      <div className="text-center max-w-sm">
        <p role="alert" className="text-gray-600 mb-4">
          {isGerant
            ? "Aucune saison active — créez et activez une saison pour commencer."
            : `Aucune saison active — le gérant doit en ouvrir une avant de pouvoir ${action}.`}
        </p>
        {isGerant && (
          <Link
            to="/config"
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl font-semibold text-white bg-[#2D6A4F] hover:bg-green-800"
          >
            Aller à Configuration
          </Link>
        )}
      </div>
    </div>
  );
}
