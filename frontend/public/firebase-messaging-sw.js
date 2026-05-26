/* Orbit Firebase Messaging Service Worker placeholder.
 *
 * Later, after Firebase credentials are created:
 * 1. Paste real Firebase config into this worker or generate it at build time.
 * 2. Import Firebase messaging compat scripts or a bundled worker.
 * 3. Call firebase.messaging().onBackgroundMessage(...) here.
 *
 * This file exists now so service worker registration paths are stable.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (error) {
    payload = { notification: { title: "Orbit", body: event.data.text() } };
  }

  const title = payload.notification?.title || "Orbit";
  const options = {
    body: payload.notification?.body || "New Orbit activity",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => "focus" in client);
      if (existingClient) return existingClient.focus();
      if (self.clients.openWindow) return self.clients.openWindow("/");
      return undefined;
    })
  );
});
