// src/hooks/useFocusTrap.ts
//
// Piège le focus clavier à l'intérieur d'un dialog modal (RGAA) : Tab et
// Shift+Tab bouclent sur les éléments focusables du dialog au lieu d'en
// sortir, Escape ferme, et le focus revient à l'élément déclencheur à la
// fermeture. Partagé par ConfirmDialog et ClientFormModal — même
// comportement d'accessibilité pour toute future modale de l'app.
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // À l'ouverture : mémorise l'élément actif (pour y revenir à la
  // fermeture) et déplace le focus dans la modale.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const firstFocusable = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Piège Tab/Shift+Tab dans la modale, Escape déclenche la fermeture.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return containerRef;
}
