import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionDetailView } from "@/components/dashboard/SessionDetailView";

export const Route = createFileRoute(
  "/dashboard/p/$projectId/sessions/$sessionId",
)({
  component: ProjectSessionDetailPage,
});

function ProjectSessionDetailPage() {
  const { projectId, sessionId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <SessionDetailView
      sessionId={sessionId}
      projectId={projectId}
      headerBackTo="/dashboard/p/$projectId/sessions"
      headerBackParams={{ projectId }}
      notFoundBackTo="/dashboard/p/$projectId/sessions"
      notFoundBackParams={{ projectId }}
      onAfterDelete={() => {
        navigate({
          to: "/dashboard/p/$projectId/sessions",
          params: { projectId },
        });
      }}
    />
  );
}
