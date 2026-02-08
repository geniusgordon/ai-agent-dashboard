/**
 * Branch Badge Component
 *
 * Displays the current git branch name with a branch icon.
 * Clicking copies the branch name to the clipboard.
 */

import { Check, Copy, GitBranch } from "lucide-react";
import { useState } from "react";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(branch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy branch name"
      className={`inline-flex items-center rounded-md bg-git/10 text-git-muted font-mono hover:bg-git/20 transition-colors cursor-pointer ${sizeStyles[size]}`}
    >
      <GitBranch className={iconSize[size]} />
      <span className="truncate max-w-24 sm:max-w-40 md:max-w-56">
        {branch}
      </span>
      {copied ? (
        <Check className={`${iconSize[size]} text-action-success-hover`} />
      ) : (
        <Copy className={`${iconSize[size]} opacity-50`} />
      )}
    </button>
  );
}
