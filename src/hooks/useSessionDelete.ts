/**
 * Hook for session deletion with confirmation dialog state.
 *
 * Manages the sessionToDelete state and delete mutation,
 * returning everything needed to wire up SessionCard + SessionDeleteDialog.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession } from "@/lib/agents/types";

interface UseSessionDeleteOptions {
  /** Query keys to invalidate on success (in addition to the sessions list) */
  additionalInvalidations?: { queryKey: readonly unknown[] }[];
}

export function useSessionDelete(options?: UseSessionDeleteOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [sessionToDelete, setSessionToDelete] = useState<AgentSession | null>(
    null,
  );

  const deleteMutation = useMutation(
    trpc.sessions.deleteSession.mutationOptions({
      onSuccess: () => {
        setSessionToDelete(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
        for (const inv of options?.additionalInvalidations ?? []) {
          queryClient.invalidateQueries(inv);
        }
      },
    }),
  );

  return {
    sessionToDelete,
    setSessionToDelete,
    confirmDelete: () => {
      if (sessionToDelete) {
        deleteMutation.mutate({ sessionId: sessionToDelete.id });
      }
    },
    isDeleting: deleteMutation.isPending,
    deletingSessionId: deleteMutation.isPending
      ? sessionToDelete?.id
      : undefined,
  };
}
