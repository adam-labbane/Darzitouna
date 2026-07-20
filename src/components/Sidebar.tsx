// src/components/Sidebar.tsx
//
// Menu latéral. Affiche getVisibleMenuItems(role) (src/lib/navigation.ts) —
// aucune logique de rôle ici, uniquement de l'affichage. Réductible en
// icônes seules (bouton en bas) ; les libellés restent dans le DOM
// (sr-only) même réduit, pour rester utilisables au lecteur d'écran.
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getVisibleMenuItems } from "../lib/navigation";

interface SidebarProps {
  role: string | undefined;
}

// Une entrée est "active" sur sa propre page ET ses sous-pages
// (ex: /depots/nouveau doit garder "Dépôts" en surbrillance).
function isItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function Sidebar({ role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const items = getVisibleMenuItems(role);

  return (
    <nav
      aria-label="Navigation principale"
      className={`bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-150 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {items.map((item) => {
            const active = isItemActive(location.pathname, item.path);
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl font-medium border-l-4 transition-colors ${
                    active
                      ? "bg-green-50 text-[#2D6A4F] border-[#2D6A4F]"
                      : "text-gray-600 border-transparent hover:bg-gray-50"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon size={22} aria-hidden="true" className="shrink-0" />
                  <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
        className="flex items-center justify-center min-h-[48px] border-t border-gray-100 text-gray-500 hover:bg-gray-50"
      >
        {collapsed ? <ChevronRight size={20} aria-hidden="true" /> : <ChevronLeft size={20} aria-hidden="true" />}
        {!collapsed && <span className="ml-2 text-sm">Réduire</span>}
      </button>
    </nav>
  );
}
