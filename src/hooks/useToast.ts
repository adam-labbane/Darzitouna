// src/hooks/useToast.ts
//
// Contexte + hook de notifications, séparés du composant Provider
// (src/components/Toast.tsx) pour respecter
// react-refresh/only-export-components.
import { createContext, useContext } from "react";

export type ToastKind = "success" | "error";

export interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() doit être appelé sous ToastProvider");
  }
  return context;
}
