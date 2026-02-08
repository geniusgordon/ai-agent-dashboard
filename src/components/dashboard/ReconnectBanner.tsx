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
    <div className="p-2.5 lg:p-4 rounded-lg lg:rounded-xl border border-action-warning/30 bg-action-warning/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-action-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-action-warning">
            Client Disconnected
          </h3>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
            The agent process is no longer running. Reconnect to continue this
            session.
          </p>
          <button
            type="button"
            onClick={onReconnect}
            disabled={isReconnecting}
            className="mt-2 lg:mt-3 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-sm font-medium bg-action-warning/20 text-action-warning hover:bg-action-warning/30 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
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
