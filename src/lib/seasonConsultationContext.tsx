// src/lib/seasonConsultationContext.tsx
//
// Contexte React centralisant "quelle saison est en cours de
// consultation" — monté une seule fois dans AppLayout.tsx, autour de
// l'<Outlet/>. Toute page qui a besoin de savoir sur quelle saison
// travailler (et si elle doit se comporter en lecture seule) consomme
// useSeasonConsultation() au lieu d'appeler indépendamment
// getActiveSeason() — un seul endroit à faire évoluer, jamais dupliqué.
//
// Rappel sécurité : isReadOnly ne sert qu'à masquer les actions
// d'écriture côté UI (confort d'ergonomie). La vraie garantie est côté
// base — voir supabase/migrations/20260722100000_readonly_season_enforcement.sql
// (triggers sur depot/mvt_stock_huile, vérifications dans
// create_pressage/set_facture_derived_fields).
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { getSaisons } from "./saisons";
import { isConsultationReadOnly } from "./seasonConsultation";
import { SeasonConsultationContext, type SeasonConsultationValue } from "../hooks/useSeasonConsultation";
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
        // Non bloquant : sans liste de saisons, allSaisons/consultedSaison
        // restent vides — les pages retombent sur leur message "aucune
        // saison active" habituel.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSaison = allSaisons.find((saison) => saison.is_active) ?? null;
  const consultedSaison = allSaisons.find((saison) => saison.id === consultedSaisonId) ?? null;
  const isReadOnly = isConsultationReadOnly(consultedSaison, activeSaison);

  // Appelée après une action (event handler), jamais depuis un effect —
  // même contrainte react-hooks/set-state-in-effect déjà rencontrée
  // partout ailleurs dans ce projet.
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
