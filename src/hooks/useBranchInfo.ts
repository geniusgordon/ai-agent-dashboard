/**
 * Branch Info Hook
 *
 * Queries the current git branch for a given working directory.
 * Uses conservative polling since branch changes are infrequent.
 */

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/trpc/react";

export function useBranchInfo(cwd: string | undefined) {
  const trpc = useTRPC();

  return useQuery(
    trpc.sessions.getBranchInfo.queryOptions(
      { cwd: cwd ?? "" },
      {
        enabled: !!cwd,
        staleTime: 30_000,
        refetchInterval: 60_000,
      },
    ),
  );
}
