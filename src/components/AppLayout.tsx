// src/components/AppLayout.tsx
//
// Layout partagé par toutes les pages connectées : sidebar + en-tête +
// zone de contenu (<Outlet/> de React Router). Monté UNE SEULE FOIS par
// la route parent dans App.tsx — les pages elles-mêmes n'ont plus besoin
// de connaître le menu ni l'en-tête, seulement leur propre contenu.
import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { getCurrentUser, getHuilerieId, logout } from "../lib/session";
import { endSession } from "../lib/auth";
import { getHuilerieName } from "../lib/huilerie";
import { SeasonConsultationProvider } from "../lib/seasonConsultationContext";
import { ToastProvider } from "./Toast";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import ReadOnlyBanner from "./ReadOnlyBanner";

export default function AppLayout() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const huilerieId = getHuilerieId();

  const [huilerieNom, setHuilerieNom] = useState("Huilerie");

  useEffect(() => {
    if (!huilerieId) return;
    let cancelled = false;

    getHuilerieName(supabase, huilerieId)
      .then((nom) => {
        if (!cancelled && nom) setHuilerieNom(nom);
      })
      .catch(() => {
        // Non bloquant : l'en-tête garde le nom par défaut.
      });

    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  // Filet de sécurité : la route parent (App.tsx) enveloppe déjà ce
  // layout dans <AppGuard requireAuth>, mais on ne suppose jamais qu'un
  // état externe (localStorage) reste valide entre deux rendus.
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    try {
      await endSession(supabase);
    } catch {
      // On déconnecte quand même localement si l'appel réseau échoue :
      // rester "connecté" alors que l'utilisateur vient de demander à
      // partir serait pire qu'une session qui expirera de toute façon.
    }
    logout();
    navigate("/", { replace: true });
  };

  return (
    <SeasonConsultationProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-[#F7F8FA]">
          <Sidebar role={currentUser.role} />
          <div className="flex-1 flex flex-col min-w-0">
            <AppHeader
              huilerieNom={huilerieNom}
              currentUser={currentUser}
              onLogout={() => void handleLogout()}
            />
            <ReadOnlyBanner />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
              <div className="max-w-7xl mx-auto w-full">
                <Outlet />
              </div>
            </main>
          </div>
          <BottomNav role={currentUser.role} />
        </div>
      </ToastProvider>
    </SeasonConsultationProvider>
  );
}
