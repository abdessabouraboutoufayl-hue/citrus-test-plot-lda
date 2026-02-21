import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline-db";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pendingCount = useLiveQuery(() => db.offlineProductions.where("synced").equals(0).count()) ?? 0;

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="bg-warning text-warning-foreground px-4 py-2 text-sm font-medium flex items-center gap-2 sticky top-0 z-50">
      <WifiOff className="h-4 w-4" />
      {!isOnline ? (
        <span>⚠️ Mode Hors ligne {pendingCount > 0 && `• ${pendingCount} saisie(s) en attente`}</span>
      ) : (
        <span>🔄 {pendingCount} saisie(s) en attente de synchronisation</span>
      )}
    </div>
  );
}
