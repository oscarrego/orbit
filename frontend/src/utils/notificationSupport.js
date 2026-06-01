export const getBrowserNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
};

export const isNotificationSupported = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  typeof PushManager !== "undefined";

export const canAskNotificationPermission = () => getBrowserNotificationPermission() === "default";

export const requestBrowserNotificationPermission = async () => {
  if (!isNotificationSupported()) return "unsupported";

  const current = getBrowserNotificationPermission();
  console.info("[FCM] Current notification permission", current);
  if (current !== "default") return current;

  try {
    const permission = await window.Notification.requestPermission();
    console.info("[FCM] Notification permission result", permission);
    return permission;
  } catch (error) {
    console.warn("Unable to request notification permission:", error);
    return "denied";
  }
};
