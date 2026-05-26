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
  if (current !== "default") return current;

  try {
    return await window.Notification.requestPermission();
  } catch (error) {
    console.warn("Unable to request notification permission:", error);
    return "denied";
  }
};
