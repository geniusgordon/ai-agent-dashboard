/**
 * Project Layout Route
 *
 * Wraps all project-scoped pages. Fetches the project by ID and provides
 * it to child routes via the useCurrentProject hook (which reads from
 * route params). Renders an Outlet for nested routes.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/p/$projectId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      context.trpc.projects.get.queryOptions({ id: params.projectId }),
    ),
  head: ({ loaderData }) => ({
    meta: loaderData?.name
      ? [{ title: `${loaderData.name} — AI Agent Dashboard` }]
      : [],
  }),
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}
