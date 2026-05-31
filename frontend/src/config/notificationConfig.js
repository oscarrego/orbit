const readEnv = (key) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

export const notificationConfig = {
  storageKeys: {
    enabled: "orbit.notifications.enabled",
    permission: "orbit.notifications.permission",
    token: "orbit.notifications.fcmToken",
    lastStatus: "orbit.notifications.status",
  },
  serviceWorkerPath: "/firebase-messaging-sw.js",
  apiBaseUrl: readEnv("REACT_APP_NOTIFICATION_API_BASE_URL") || readEnv("VITE_NOTIFICATION_API_BASE_URL") || "https://orbit-g4ah.onrender.com/api",
};
