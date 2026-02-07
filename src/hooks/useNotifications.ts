/**
 * Hook for desktop notifications
 */

import { useCallback, useEffect, useState } from "react";

export function useNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied" as NotificationPermission;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return null;
    }

    if (Notification.permission !== "granted") {
      return null;
    }

    // Don't notify if tab is focused
    if (document.visibilityState === "visible") {
      return null;
    }

    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    // Focus window on click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }, []);

  return {
    permission,
    requestPermission,
    notify,
    isSupported: typeof window !== "undefined" && "Notification" in window,
  };
}
