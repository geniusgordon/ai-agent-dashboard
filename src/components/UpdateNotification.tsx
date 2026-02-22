import { useEffect } from "react";
import { toast } from "sonner";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

export function UpdateNotification() {
  const { updateAvailable, updateApp } = useServiceWorkerUpdate();

  useEffect(() => {
    if (updateAvailable) {
      toast("Update Available", {
        description: "A new version is available",
        action: {
          label: "Update",
          onClick: updateApp,
        },
        duration: Number.POSITIVE_INFINITY,
      });
    }
  }, [updateAvailable, updateApp]);

  return null;
}
