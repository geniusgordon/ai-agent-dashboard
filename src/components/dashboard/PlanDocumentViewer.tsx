import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/integrations/trpc/react";

export interface PlanDocumentViewerProps {
  filePath: string;
}

export function PlanDocumentViewer({ filePath }: PlanDocumentViewerProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...trpc.sessions.readPlanFile.queryOptions({ filePath }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const hasContent = data?.content != null;
  const fileName = filePath.split("/").pop() ?? "plan.md";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 text-xs"
        disabled={isLoading || !!error || !hasContent}
        onClick={() => setOpen(true)}
      >
        <FileText className="size-3.5 shrink-0 text-event-plan" />
        {isLoading ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Loading plan...
          </>
        ) : error ? (
          "Failed to load plan"
        ) : !hasContent ? (
          "Plan file not found"
        ) : (
          <span className="truncate">View Plan</span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-event-plan" />
              Plan Document
            </DialogTitle>
            <p className="text-[11px] font-mono text-muted-foreground/60 truncate select-all">
              {fileName}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
            <MarkdownContent>{data?.content}</MarkdownContent>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
