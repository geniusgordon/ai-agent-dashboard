import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder for SessionLog while session data is loading.
 * Mimics the chat log layout with varied-width bars representing messages.
 */
export function SessionLogSkeleton() {
  return (
    <div className="flex-1 relative min-h-0">
      <div className="absolute inset-0 overflow-hidden font-mono text-sm">
        <div className="px-3 py-2 space-y-3">
          {/* Simulate a conversation: alternating assistant and user entries */}
          {SKELETON_ROWS.map((row, i) => (
            <div
              key={i}
              className={row.align === "right" ? "flex justify-end" : ""}
            >
              <div
                className={
                  row.align === "right" ? "max-w-[70%]" : "max-w-[85%]"
                }
              >
                {row.align === "left" && (
                  <Skeleton className="h-3 w-16 mb-1.5 rounded-sm" />
                )}
                <div className="space-y-1.5">
                  {row.lines.map((w, j) => (
                    <Skeleton key={j} className={`h-3.5 rounded-sm ${w}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Each row represents a skeleton chat entry.
 * "left" = assistant messages (wider, with a role label skeleton).
 * "right" = user messages (narrower, right-aligned).
 */
const SKELETON_ROWS: { align: "left" | "right"; lines: string[] }[] = [
  { align: "right", lines: ["w-48"] },
  { align: "left", lines: ["w-full", "w-4/5", "w-3/5"] },
  { align: "left", lines: ["w-2/3"] },
  { align: "right", lines: ["w-36"] },
  { align: "left", lines: ["w-full", "w-5/6", "w-full", "w-2/5"] },
  { align: "right", lines: ["w-56"] },
  { align: "left", lines: ["w-4/5", "w-3/4"] },
];
