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
import { getActiveSeason } from "../lib/depots";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";

export default function AppLayout() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const huilerieId = getHuilerieId();

  const [huilerieNom, setHuilerieNom] = useState("Huilerie");
  const [saisonNom, setSaisonNom] = useState<string | null>(null);

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

    getActiveSeason(supabase)
      .then((saison) => {
        if (!cancelled) setSaisonNom(saison?.nom ?? null);
      })
      .catch(() => {
        // Non bloquant : l'en-tête n'affiche simplement pas de saison.
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
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <Sidebar role={currentUser.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          huilerieNom={huilerieNom}
          saisonNom={saisonNom}
          currentUser={currentUser}
          onLogout={() => void handleLogout()}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
