import { LogOut } from "lucide-react";
import SeasonSelect from "./SeasonSelect";

interface AppHeaderProps {
  huilerieNom: string;
  currentUser: { nom: string; role: string };
  onLogout: () => void;
}

export default function AppHeader({ huilerieNom, currentUser, onLogout }: AppHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <p className="font-bold text-[#1B4332] truncate min-w-0">{huilerieNom}</p>
        <div className="shrink-0">
          <SeasonSelect />
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 shrink-0" role="status">
        <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F]" aria-hidden="true" />
        <span className="text-sm text-gray-600">Connecté</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden lg:block">
          <p className="text-sm font-semibold text-gray-900">{currentUser.nom}</p>
          <p className="text-xs text-gray-500">{currentUser.role}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Se déconnecter"
          className="min-h-[48px] min-w-[48px] px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-red-50 hover:text-[#E63946] hover:border-red-200 flex items-center gap-2"
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="hidden lg:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
