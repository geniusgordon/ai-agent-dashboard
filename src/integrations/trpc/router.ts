import {
  approvalsRouter,
  projectsRouter,
  sessionsRouter,
  worktreesRouter,
} from "@/server/routers";
import { createTRPCRouter } from "./init";

export const trpcRouter = createTRPCRouter({
  sessions: sessionsRouter,
  approvals: approvalsRouter,
  projects: projectsRouter,
  worktrees: worktreesRouter,
});
export type TRPCRouter = typeof trpcRouter;
