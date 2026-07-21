// src/hooks/useSeasonConsultation.ts
//
// Contexte + hook de consultation de saison, séparés du composant
// Provider (src/lib/seasonConsultationContext.tsx) pour respecter
// react-refresh/only-export-components (un fichier de composant ne doit
// exporter que des composants).
import { createContext, useContext } from "react";
import type { Saison } from "../types/saison";

export interface SeasonConsultationValue {
  allSaisons: Saison[];
  activeSaison: Saison | null;
  consultedSaison: Saison | null;
  isReadOnly: boolean;
  loading: boolean;
  setConsultedSaisonId: (id: string) => void;
  refreshSaisons: () => Promise<void>;
}

export const SeasonConsultationContext = createContext<SeasonConsultationValue | null>(null);

export function useSeasonConsultation(): SeasonConsultationValue {
  const context = useContext(SeasonConsultationContext);
  if (!context) {
    throw new Error("useSeasonConsultation() doit être appelé sous SeasonConsultationProvider");
  }
  return context;
}
