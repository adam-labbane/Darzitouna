import { useOnlineStatus } from "../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div role="status" aria-live="polite" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
      <p className="text-sm text-amber-800">
        <span className="font-semibold">Mode hors ligne</span> — consultation des dernières données connues. Les
        modifications sont indisponibles.
      </p>
    </div>
  );
}
