const readEnv = (key) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

export const notificationConfig = {
  storageKeys: {
    enabled: "orbit.notifications.enabled",
    permission: "orbit.notifications.permission",
    token: "orbit.notifications.fcmToken",
    lastStatus: "orbit.notifications.status",
  },
  serviceWorkerPath: "/firebase-messaging-sw.js",
  apiBaseUrl: readEnv("REACT_APP_NOTIFICATION_API_BASE_URL") || readEnv("VITE_NOTIFICATION_API_BASE_URL") || "",
};
