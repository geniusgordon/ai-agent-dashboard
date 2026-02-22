import { useCallback, useEffect, useState } from "react";
import type { Workbox } from "workbox-window";

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);

  const updateApp = useCallback(() => {
    if (wb) {
      wb.addEventListener("controlling", () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();
    }
  }, [wb]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      import("workbox-window").then(({ Workbox }) => {
        const workbox = new Workbox("/sw.js");

        workbox.addEventListener("waiting", () => {
          setUpdateAvailable(true);
        });

        workbox.register();
        setWb(workbox);
      });
    }
  }, []);

  return { updateAvailable, updateApp };
}
