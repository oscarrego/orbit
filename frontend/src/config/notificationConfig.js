// Explicit Vite env variable references
const envApiBaseUrl = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_NOTIFICATION_API_BASE_URL : undefined;

export const notificationConfig = {
  storageKeys: {
    enabled: "orbit.notifications.enabled",
    permission: "orbit.notifications.permission",
    token: "orbit.notifications.fcmToken",
    lastStatus: "orbit.notifications.status",
  },
  serviceWorkerPath: "/firebase-messaging-sw.js",
  apiBaseUrl: envApiBaseUrl || "https://orbit-g4ah.onrender.com/api",
};
