/**
 * Root Route - Redirect to Dashboard
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/dashboard" />,
});
