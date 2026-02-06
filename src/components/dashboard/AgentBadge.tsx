/**
 * Agent Type Badge Component
 */

import type { LucideIcon } from "lucide-react";
import { Bot, Hexagon, Sparkles } from "lucide-react";
import type { AgentType } from "../../lib/agents/types";

const agentConfig: Record<
  AgentType,
  { label: string; color: string; icon: LucideIcon }
> = {
  gemini: {
    label: "Gemini",
    color: "bg-agent-gemini/20 text-agent-gemini border-agent-gemini/30",
    icon: Sparkles,
  },
  "claude-code": {
    label: "Claude",
    color: "bg-agent-claude/20 text-agent-claude border-agent-claude/30",
    icon: Bot,
  },
  codex: {
    label: "Codex",
    color: "bg-agent-codex/20 text-agent-codex border-agent-codex/30",
    icon: Hexagon,
  },
};

interface AgentBadgeProps {
  type: AgentType;
  size?: "sm" | "md";
}

export function AgentBadge({ type, size = "md" }: AgentBadgeProps) {
  const config = agentConfig[type];
  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${config.color} ${sizeClasses}
      `}
    >
      <config.icon className="size-3" />
      {config.label}
    </span>
  );
}
