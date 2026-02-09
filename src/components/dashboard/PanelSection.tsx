import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function PanelSection({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Icon className="size-3.5 shrink-0" />
        <span className="uppercase tracking-wide">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}
