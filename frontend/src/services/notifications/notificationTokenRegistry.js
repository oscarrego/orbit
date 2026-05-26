import { notificationConfig } from "../../config/notificationConfig";

const getEndpoint = (path) => {
  if (!notificationConfig.apiBaseUrl) return "";
  return `${notificationConfig.apiBaseUrl.replace(/\/$/, "")}${path}`;
};

export const registerNotificationToken = async ({ token, user }) => {
  const endpoint = getEndpoint("/notifications/register");
  if (!endpoint || !token) {
    return { skipped: true, reason: "Notification backend endpoint is not configured yet." };
  }

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
  return response.json().catch(() => ({ ok: true }));
};

export const unregisterNotificationToken = async ({ token, user }) => {
  const endpoint = getEndpoint("/notifications/unregister");
  if (!endpoint || !token) {
    return { skipped: true, reason: "Notification backend endpoint is not configured yet." };
  }

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
  return response.json().catch(() => ({ ok: true }));
};
