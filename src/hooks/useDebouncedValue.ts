// src/hooks/useDebouncedValue.ts
//
// Retarde la propagation d'une valeur qui change souvent (frappe clavier)
// pour éviter de déclencher une requête réseau à chaque caractère tapé.
// Générique et réutilisable : servira à toutes les futures barres de
// recherche (fournisseurs, dépôts, cuves...).
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
