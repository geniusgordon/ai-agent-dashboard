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
    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
      <div className="flex items-start gap-3">
        <CircleX className="size-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-red-300">{title}</h3>
          <p className="text-sm text-red-400/80 mt-1">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
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
    <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
      <AlertTriangle className="size-3.5" />
      {message}
    </p>
  );
}
