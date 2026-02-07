/**
 * Branch Badge Component
 *
 * Displays the current git branch name with a branch icon.
 */

import { GitBranch } from "lucide-react";

interface BranchBadgeProps {
  branch: string;
  size?: "sm" | "md";
}

const sizeStyles = {
  sm: "text-xs px-1.5 py-0.5 gap-1",
  md: "text-sm px-2 py-0.5 gap-1.5",
};

const iconSize = {
  sm: "size-3",
  md: "size-3.5",
};

export function BranchBadge({ branch, size = "sm" }: BranchBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-purple-500/10 text-purple-400 font-mono ${sizeStyles[size]}`}
    >
      <GitBranch className={iconSize[size]} />
      <span className="truncate max-w-32">{branch}</span>
    </span>
  );
}
