import { useCallback, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ToastContext, type ToastKind } from "../hooks/useToast";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-stretch px-4 w-full max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-soft text-sm font-medium text-white transition-opacity motion-reduce:transition-none ${
              toast.kind === "success" ? "bg-brand-dark" : "bg-danger"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 size={18} aria-hidden="true" className="shrink-0" />
            ) : (
              <XCircle size={18} aria-hidden="true" className="shrink-0" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
