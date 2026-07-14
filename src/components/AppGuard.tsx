// src/components/AppGuard.tsx
import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { getHuilerieId, getCurrentUser } from "../lib/session";

interface AppGuardProps {
  children: ReactNode;        // La page à afficher si tout est OK
  requireAuth?: boolean;      // true = il faut être connecté pour voir cette page
}

export default function AppGuard({ children, requireAuth = false }: AppGuardProps) {
  const huilerieId = getHuilerieId();
  const currentUser = getCurrentUser();

  // 1. Si la tablette n'est pas configurée → on force le Setup
  if (!huilerieId) {
    return <Navigate to="/setup" replace />;
  }

  // 2. Si la page exige d'être connecté mais qu'on ne l'est pas → on force le Login
  if (requireAuth && !currentUser) {
    return <Navigate to="/" replace />;
  }

  // 3. Tout est OK → on affiche la page demandée
  return <>{children}</>;
}