import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { getSaisons } from "./saisons";
import { isConsultationReadOnly } from "./seasonConsultation";
import { SeasonConsultationContext, type SeasonConsultationValue } from "../hooks/useSeasonConsultation";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { Saison } from "../types/saison";

export function SeasonConsultationProvider({ children }: { children: ReactNode }) {
  const [allSaisons, setAllSaisons] = useState<Saison[]>([]);
  const [consultedSaisonId, setConsultedSaisonIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSaisons(supabase)
      .then((data) => {
        if (!cancelled) {
          setAllSaisons(data);
          setConsultedSaisonIdState(data.find((saison) => saison.is_active)?.id ?? null);
        }
      })
      .catch(() => {
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOnline = useOnlineStatus();
  const activeSaison = allSaisons.find((saison) => saison.is_active) ?? null;
  const consultedSaison = allSaisons.find((saison) => saison.id === consultedSaisonId) ?? null;
  const isReadOnly = isConsultationReadOnly(consultedSaison, activeSaison, isOnline);

  const refreshSaisons = async () => {
    const data = await getSaisons(supabase);
    setAllSaisons(data);
    setConsultedSaisonIdState((current) => {
      if (current && data.some((saison) => saison.id === current)) return current;
      return data.find((saison) => saison.is_active)?.id ?? null;
    });
  };

  const value: SeasonConsultationValue = {
    allSaisons,
    activeSaison,
    consultedSaison,
    isReadOnly,
    loading,
    setConsultedSaisonId: setConsultedSaisonIdState,
    refreshSaisons,
  };

  return <SeasonConsultationContext.Provider value={value}>{children}</SeasonConsultationContext.Provider>;
}
