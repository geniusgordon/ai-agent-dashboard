import { approvalsRouter, sessionsRouter } from "@/server/routers";
import { createTRPCRouter } from "./init";

export const trpcRouter = createTRPCRouter({
  sessions: sessionsRouter,
  approvals: approvalsRouter,
});
export type TRPCRouter = typeof trpcRouter;
