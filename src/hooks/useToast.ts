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
