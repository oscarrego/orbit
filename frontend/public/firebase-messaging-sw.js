/* Orbit Firebase Messaging Service Worker */

importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBtRVnU4H1JK0Mz1MbN1oxe830DkgLZxHw",
  authDomain: "orbit-d12e3.firebaseapp.com",
  projectId: "orbit-d12e3",
  storageBucket: "orbit-d12e3.firebasestorage.app",
  messagingSenderId: "679786936645",
  appId: "1:679786936645:web:789306631cc2baa9ef262c",
  measurementId: "G-DJ4QZG7D8B",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

console.log("[FCM-SW] Firebase Messaging service worker initialized", {
  projectId: firebaseConfig.projectId,
  messagingSenderId: firebaseConfig.messagingSenderId,
});

self.addEventListener("install", () => {
  console.log("[FCM-SW] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[FCM-SW] Activated");
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM-SW] Background message received", payload);

  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || (data.type === "sos_cancel" ? "SOS Cancelled" : "EMERGENCY SOS");
  const options = {
    body:
      notification.body ||
      data.body ||
      (data.senderName ? `${data.senderName} has triggered an SOS alert!` : "New Orbit activity"),
    icon: notification.icon || "/logo192.png",
    badge: "/logo192.png",
    tag: data.type ? `orbit-${data.type}-${data.senderId || "unknown"}` : "orbit-fcm-message",
    requireInteraction: data.type === "sos_alert",
    data,
  };

  console.log("[FCM-SW] Displaying browser notification", {
    title,
    tag: options.tag,
    type: data.type,
  });

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  console.log("[FCM-SW] Notification click", event.notification?.data || {});
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
