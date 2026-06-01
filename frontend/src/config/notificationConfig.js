import { backendConfig } from "./backendConfig";

const envApiBaseUrl =
  typeof process !== "undefined" && process.env
    ? process.env.REACT_APP_NOTIFICATION_API_BASE_URL || process.env.VITE_NOTIFICATION_API_BASE_URL
    : undefined;

export const notificationConfig = {
  storageKeys: {
    enabled: "orbit.notifications.enabled",
    permission: "orbit.notifications.permission",
    token: "orbit.notifications.fcmToken",
    lastStatus: "orbit.notifications.status",
  },
  serviceWorkerPath: "/firebase-messaging-sw.js",
  apiBaseUrl: envApiBaseUrl || backendConfig.apiBaseUrl,
};
