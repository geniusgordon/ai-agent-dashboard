/**
 * Dashboard Layout Component
 */

import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { ThemeContext, useThemeProvider } from "../../hooks/useTheme";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: "◫" },
  { to: "/dashboard/sessions", label: "Sessions", icon: "◉" },
  { to: "/dashboard/approvals", label: "Approvals", icon: "◈" },
];

export function DashboardLayout() {
  const matchRoute = useMatchRoute();
  const themeValue = useThemeProvider();
  const { theme, toggleTheme } = themeValue;

  return (
    <div
      className={`min-h-screen ${theme === "light" ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-slate-100"}`}
    >
      {/* Header */}
      <header
        className={`
					sticky top-0 z-50 border-b backdrop-blur-sm
					${
            theme === "light"
              ? "border-slate-200 bg-white/80"
              : "border-slate-800 bg-slate-900/80"
          }
				`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 sm:gap-3">
              <div
                className="
									w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600
									flex items-center justify-center text-white font-bold text-xs sm:text-sm
								"
              >
                AI
              </div>
              <span className="font-semibold text-base sm:text-lg tracking-tight hidden sm:block">
                Agent Dashboard
              </span>
            </Link>

            {/* Nav + Theme Toggle */}
            <div className="flex items-center gap-2">
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
												px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
												${
                          isActive
                            ? theme === "light"
                              ? "bg-slate-200 text-slate-900"
                              : "bg-slate-800 text-white"
                            : theme === "light"
                              ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        }
											`}
                    >
                      <span className="sm:mr-2">{item.icon}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`
									p-2 rounded-lg transition-colors cursor-pointer
									${
                    theme === "light"
                      ? "text-slate-600 hover:bg-slate-200"
                      : "text-slate-400 hover:bg-slate-800"
                  }
								`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <ThemeContext.Provider value={themeValue}>
          <Outlet />
        </ThemeContext.Provider>
      </main>
    </div>
  );
}
