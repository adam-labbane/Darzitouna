import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { getHuilerieId, getCurrentUser } from "../lib/session";

interface AppGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export default function AppGuard({ children, requireAuth = false }: AppGuardProps) {
  const huilerieId = getHuilerieId();
  const currentUser = getCurrentUser();

  if (!huilerieId) {
    return <Navigate to="/setup" replace />;
  }

  if (requireAuth && !currentUser) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
