// src/components/Skeleton.tsx
//
// Bloc de chargement générique — généralise les `animate-pulse` déjà
// dupliqués page par page. Un seul `role="status"` porte l'annonce pour
// le lecteur d'écran ; les blocs eux-mêmes sont décoratifs (aria-hidden).
interface SkeletonProps {
  className?: string;
  count?: number;
  label?: string;
}

export default function Skeleton({ className = "h-20", count = 3, label = "Chargement en cours" }: SkeletonProps) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`rounded-2xl bg-gray-200 animate-pulse motion-reduce:animate-none ${className}`}
        />
      ))}
    </div>
  );
}
