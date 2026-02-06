/**
 * Dashboard Layout Component
 *
 * Uses shadcn SidebarProvider for state management, mobile Sheet,
 * keyboard shortcut (Ctrl+B), and cookie persistence.
 */

import { Outlet } from "@tanstack/react-router";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeContext, useThemeProvider } from "../../hooks/useTheme";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const themeValue = useThemeProvider();

  return (
    <ThemeContext.Provider value={themeValue}>
      <SidebarProvider>
        <Sidebar />
        <SidebarInset>
          {/* Top bar with trigger */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-semibold text-sm tracking-tight">
              Agent Dashboard
            </span>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeContext.Provider>
  );
}
