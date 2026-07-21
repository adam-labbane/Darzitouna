// src/components/BottomNav.tsx
//
// Navigation mobile (< md), remplace Sidebar.tsx sous 768px. Réutilise
// getVisibleMenuItems(role) tel quel (aucune deuxième liste de priorités
// à maintenir) : les 4 premiers éléments en barre basse atteignable au
// pouce, le reste dans une feuille "Plus" (focus trap réutilisant
// useFocusTrap, comme les autres modales de l'app).
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { getVisibleMenuItems } from "../lib/navigation";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface BottomNavProps {
  role: string | undefined;
}

const VISIBLE_COUNT = 4;

function isItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function BottomNav({ role }: BottomNavProps) {
  const location = useLocation();
  const items = getVisibleMenuItems(role);
  const primaryItems = items.slice(0, VISIBLE_COUNT);
  const moreItems = items.slice(VISIBLE_COUNT);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useFocusTrap(sheetOpen, () => setSheetOpen(false));
  const moreActive = moreItems.some((item) => isItemActive(location.pathname, item.path));

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primaryItems.map((item) => {
          const active = isItemActive(location.pathname, item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1 text-xs font-medium ${
                active ? "text-brand" : "text-gray-500"
              }`}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1 text-xs font-medium ${
              moreActive ? "text-brand" : "text-gray-500"
            }`}
          >
            <Menu size={22} aria-hidden="true" />
            <span>Plus</span>
          </button>
        )}
      </nav>

      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 flex items-end bg-black/40"
          onClick={() => setSheetOpen(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Plus de menus"
            className="w-full bg-white rounded-t-2xl p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-brand-dark">Plus</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Fermer"
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl hover:bg-gray-50"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ul className="space-y-1">
              {moreItems.map((item) => {
                const active = isItemActive(location.pathname, item.path);
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSheetOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl font-medium ${
                        active ? "bg-brand-tint text-brand-dark" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={20} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
