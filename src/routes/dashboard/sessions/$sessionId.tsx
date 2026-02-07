import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionDetailView } from "@/components/dashboard/SessionDetailView";

export const Route = createFileRoute("/dashboard/sessions/$sessionId")({
  component: SessionDetailPage,
});

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <SessionDetailView
      sessionId={sessionId}
      headerBackTo="/dashboard"
      notFoundBackTo="/dashboard"
      onAfterDelete={() => {
        navigate({ to: "/dashboard" });
      }}
    />
  );
}
