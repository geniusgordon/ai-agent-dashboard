import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

export interface ReconnectBannerProps {
  onReconnect: () => void;
  isReconnecting: boolean;
}

export function ReconnectBanner({
  onReconnect,
  isReconnecting,
}: ReconnectBannerProps) {
  return (
    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-500">Client Disconnected</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The agent process is no longer running. Reconnect to continue this
            session.
          </p>
          <button
            type="button"
            onClick={onReconnect}
            disabled={isReconnecting}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isReconnecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Reconnect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
