// src/components/TankCanvas.tsx
//
// Vue d'ensemble de toutes les cuves de l'huilerie : grille responsive de
// TankGauge + légende des couleurs en bas à gauche.
import { FILL_COLOR_HEX, FILL_COLOR_LABELS, type FillColor } from "../lib/cuveDisplay";
import type { Cuve } from "../types/cuve";
import TankGauge from "./TankGauge";

interface TankCanvasProps {
  cuves: Cuve[];
}

const LEGEND_ORDER: FillColor[] = ["green", "orange", "red", "gray"];

export default function TankCanvas({ cuves }: TankCanvasProps) {
  if (cuves.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
        Aucune cuve — créez la première.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 justify-items-center">
        {cuves.map((cuve) => (
          <TankGauge key={cuve.id} cuve={cuve} />
        ))}
      </div>

      {/* Légende en bas, alignée à gauche — la couleur seule ne porte
          jamais l'information (voir aussi le % en texte sur chaque
          jauge) : elle sert de renfort visuel rapide. */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 pt-4 border-t border-gray-100">
        <p className="w-full text-xs font-semibold text-gray-500 uppercase">Légende</p>
        {LEGEND_ORDER.map((color) => (
          <div key={color} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: FILL_COLOR_HEX[color] }}
              aria-hidden="true"
            />
            <span className="text-sm text-gray-600">{FILL_COLOR_LABELS[color]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
