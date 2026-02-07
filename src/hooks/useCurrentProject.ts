/**
 * Current Project Hook
 *
 * Reads the projectId from route params (available on any route under
 * /dashboard/p/$projectId) and fetches the full project data via tRPC.
 *
 * Returns the project, loading state, and the raw projectId param.
 */

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";

export function useCurrentProject() {
  const { projectId } = useParams({ from: "/dashboard/p/$projectId" });
  const trpc = useTRPC();

  const projectQuery = useQuery(
    trpc.projects.get.queryOptions({ id: projectId }),
  );

  return {
    projectId,
    project: projectQuery.data ?? null,
    isLoading: projectQuery.isLoading,
    error: projectQuery.error,
  };
}
