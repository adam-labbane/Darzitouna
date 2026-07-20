// src/pages/ModuleAVenir.tsx
//
// Placeholder générique pour les modules pas encore développés (Pressage,
// Stocks, Factures, Grignons, Configuration). Un seul composant paramétré
// plutôt que 5 fichiers de stub quasi identiques : chaque module sera
// remplacé par sa vraie page le moment venu, en changeant juste l'élément
// de la route dans App.tsx.
import { Construction } from "lucide-react";

interface ModuleAVenirProps {
  titre: string;
}

export default function ModuleAVenir({ titre }: ModuleAVenirProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <Construction size={48} className="text-gray-300 mb-4" aria-hidden="true" />
      <h1 className="text-xl font-bold text-[#1B4332] mb-2">{titre}</h1>
      <p className="text-gray-500 max-w-sm">
        Ce module n'est pas encore disponible. Il arrivera dans une prochaine mise à jour.
      </p>
    </div>
  );
}
