/**
 * Session Card Component
 */

import { Link } from "@tanstack/react-router";
import type { AgentSession } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { StatusBadge } from "./StatusBadge";

interface SessionCardProps {
	session: AgentSession;
}

export function SessionCard({ session }: SessionCardProps) {
	const timeAgo = getTimeAgo(session.createdAt);

	return (
		<Link
			to="/dashboard/sessions/$sessionId"
			params={{ sessionId: session.id }}
			className="
        block p-4 rounded-lg border border-slate-700/50 bg-slate-800/50
        hover:bg-slate-800 hover:border-slate-600/50
        transition-all duration-200 cursor-pointer
        group
      "
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{/* Header */}
					<div className="flex items-center gap-2 mb-2">
						<AgentBadge type={session.agentType} size="sm" />
						<StatusBadge status={session.status} />
					</div>

					{/* Session ID */}
					<p className="font-mono text-sm text-slate-300 truncate mb-1">
						{session.id}
					</p>

					{/* CWD */}
					<p className="text-xs text-slate-500 truncate">{session.cwd}</p>
				</div>

				{/* Time */}
				<div className="text-right shrink-0">
					<p className="text-xs text-slate-500">{timeAgo}</p>
				</div>
			</div>

			{/* Hover indicator */}
			<div
				className="
        mt-3 pt-3 border-t border-slate-700/50
        flex items-center justify-end
        opacity-0 group-hover:opacity-100 transition-opacity
      "
			>
				<span className="text-xs text-slate-400 flex items-center gap-1">
					View logs
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</span>
			</div>
		</Link>
	);
}

function getTimeAgo(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - new Date(date).getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return "Just now";
}
