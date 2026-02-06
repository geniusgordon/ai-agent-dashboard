/**
 * Dashboard Sidebar Navigation
 *
 * Built on shadcn Sidebar primitives — handles mobile Sheet overlay,
 * collapsible icon mode, cookie persistence, and Ctrl+B shortcut.
 */

import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  Sidebar as SidebarRoot,
} from "@/components/ui/sidebar";
import { useTheme } from "../../hooks/useTheme";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    to: "/dashboard/sessions",
    label: "Sessions",
    icon: MessageSquare,
    exact: false,
  },
  {
    to: "/dashboard/approvals",
    label: "Approvals",
    icon: ShieldCheck,
    exact: false,
  },
] as const;

export function Sidebar() {
  const matchRoute = useMatchRoute();
  const { theme, toggleTheme } = useTheme();

  return (
    <SidebarRoot collapsible="icon">
      {/* Header / Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="size-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  AI
                </div>
                <span className="font-semibold text-base tracking-tight truncate">
                  Agent Dashboard
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = !!matchRoute({
                  to: item.to,
                  fuzzy: !item.exact,
                });

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — theme toggle */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "dark" ? "Light Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}
