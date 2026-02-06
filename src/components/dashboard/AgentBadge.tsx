/**
 * Agent Type Badge Component
 */

import type { AgentType } from "../../lib/agents/types";

const agentConfig: Record<
  AgentType,
  { label: string; color: string; icon: string }
> = {
  gemini: {
    label: "Gemini",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: "✦", // Will replace with SVG
  },
  "claude-code": {
    label: "Claude",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: "◈",
  },
  codex: {
    label: "Codex",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: "⬡",
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
      <span className="text-xs">{config.icon}</span>
      {config.label}
    </span>
  );
}
