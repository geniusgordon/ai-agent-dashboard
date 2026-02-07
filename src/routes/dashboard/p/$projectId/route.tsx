/**
 * Project Layout Route
 *
 * Wraps all project-scoped pages. Fetches the project by ID and provides
 * it to child routes via the useCurrentProject hook (which reads from
 * route params). Renders an Outlet for nested routes.
 */

import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/p/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}
