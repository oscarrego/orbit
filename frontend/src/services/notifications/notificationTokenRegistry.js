import { notificationConfig } from "../../config/notificationConfig";

const getEndpoint = (path) => {
  if (!notificationConfig.apiBaseUrl) return "";
  return `${notificationConfig.apiBaseUrl.replace(/\/$/, "")}${path}`;
};

export const registerNotificationToken = async ({ token, user }) => {
  const endpoint = getEndpoint("/notifications/register");
  if (!endpoint || !token) {
    console.warn("[FCM] Token registration skipped", { endpoint, hasToken: Boolean(token) });
    return { skipped: true, reason: "Notification backend endpoint is not configured yet." };
  }

  console.info("[FCM] Registering token with backend", {
    endpoint,
    userId: user?.userId,
    username: user?.username,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      userId: user?.userId,
      username: user?.username,
      platform: "web",
    }),
  });

  if (!response.ok) throw new Error("Failed to register notification token.");
  const body = await response.json().catch(() => ({ ok: true }));
  console.info("[FCM] Token registration response", body);
  return body;
};

export const unregisterNotificationToken = async ({ token, user }) => {
  const endpoint = getEndpoint("/notifications/unregister");
  if (!endpoint || !token) {
    console.warn("[FCM] Token unregister skipped", { endpoint, hasToken: Boolean(token) });
    return { skipped: true, reason: "Notification backend endpoint is not configured yet." };
  }

  console.info("[FCM] Unregistering token with backend", {
    endpoint,
    userId: user?.userId,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      userId: user?.userId,
      platform: "web",
    }),
  });

  if (!response.ok) throw new Error("Failed to unregister notification token.");
  const body = await response.json().catch(() => ({ ok: true }));
  console.info("[FCM] Token unregister response", body);
  return body;
};
