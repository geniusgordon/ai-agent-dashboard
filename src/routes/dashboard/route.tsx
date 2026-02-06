/**
 * Dashboard Layout Route
 */

import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../../components/dashboard";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});
