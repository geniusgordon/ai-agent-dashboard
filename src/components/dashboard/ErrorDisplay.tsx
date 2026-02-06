/**
 * Error Display Component
 */

import { AlertTriangle, CircleX } from "lucide-react";

interface ErrorDisplayProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({
  error,
  title = "Something went wrong",
  onRetry,
}: ErrorDisplayProps) {
  if (!error) return null;

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { message?: string })?.message ?? "Unknown error");

  return (
    <div className="p-4 rounded-xl border border-status-error/30 bg-status-error/10">
      <div className="flex items-start gap-3">
        <CircleX className="size-5 text-status-error shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-status-error">{title}</h3>
          <p className="text-sm text-status-error/80 mt-1">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors cursor-pointer"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error message for forms/inputs
 */
export function InlineError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="text-sm text-status-error mt-1 flex items-center gap-1">
      <AlertTriangle className="size-3.5" />
      {message}
    </p>
  );
}
