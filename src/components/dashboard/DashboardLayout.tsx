/**
 * Dashboard Layout Component
 */

import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";

const navItems = [
	{ to: "/dashboard", label: "Overview", icon: "◫" },
	{ to: "/dashboard/sessions", label: "Sessions", icon: "◉" },
	{ to: "/dashboard/approvals", label: "Approvals", icon: "◈" },
];

export function DashboardLayout() {
	const matchRoute = useMatchRoute();

	return (
		<div className="min-h-screen bg-slate-900 text-slate-100">
			{/* Header */}
			<header
				className="
        sticky top-0 z-50
        border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm
      "
			>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						{/* Logo */}
						<Link to="/dashboard" className="flex items-center gap-3">
							<div
								className="
                w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600
                flex items-center justify-center text-white font-bold text-sm
              "
							>
								AI
							</div>
							<span className="font-semibold text-lg tracking-tight">
								Agent Dashboard
							</span>
						</Link>

						{/* Nav */}
						<nav className="flex items-center gap-1">
							{navItems.map((item) => {
								const isActive = matchRoute({
									to: item.to,
									fuzzy: item.to !== "/dashboard",
								});
								return (
									<Link
										key={item.to}
										to={item.to}
										className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
                      ${
												isActive
													? "bg-slate-800 text-white"
													: "text-slate-400 hover:text-white hover:bg-slate-800/50"
											}
                    `}
									>
										<span className="mr-2">{item.icon}</span>
										{item.label}
									</Link>
								);
							})}
						</nav>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Outlet />
			</main>
		</div>
	);
}
