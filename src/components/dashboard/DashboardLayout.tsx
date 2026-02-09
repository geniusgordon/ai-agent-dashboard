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
import { Toaster } from "@/components/ui/sonner";
import {
  HeaderSlotContext,
  useHeaderSlotProvider,
} from "@/hooks/useHeaderSlot";
import { ThemeContext, useThemeProvider } from "../../hooks/useTheme";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const themeValue = useThemeProvider();
  const headerSlotValue = useHeaderSlotProvider();

  return (
    <ThemeContext.Provider value={themeValue}>
      <HeaderSlotContext.Provider value={headerSlotValue}>
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>
            {/* Top bar with trigger - sticky on mobile */}
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              {/* Portal target — child routes render header content here via createPortal */}
              <div
                ref={headerSlotValue.setContainer}
                className={
                  headerSlotValue.slotActive ? "flex-1 min-w-0" : undefined
                }
              />
              {!headerSlotValue.slotActive && (
                <span className="font-semibold text-sm tracking-tight">
                  Agent Dashboard
                </span>
              )}
            </header>

            <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </HeaderSlotContext.Provider>
      <Toaster />
    </ThemeContext.Provider>
  );
}
