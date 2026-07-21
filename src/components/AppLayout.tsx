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
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [huilerieId]);

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await endSession(supabase).catch(() => {});
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
