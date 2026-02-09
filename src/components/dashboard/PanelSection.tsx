import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PanelSectionBase = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
};

type PanelSectionProps =
  | (PanelSectionBase & { open?: undefined; onOpenChange?: undefined })
  | (PanelSectionBase & {
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function PanelSection({
  icon: Icon,
  label,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  headerExtra,
  children,
}: PanelSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange : setInternalOpen;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Icon className="size-3.5 shrink-0" />
        <span className="uppercase tracking-wide">{label}</span>
        {headerExtra}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}
