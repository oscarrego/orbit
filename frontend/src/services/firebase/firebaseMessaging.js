import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { firebaseRuntimeConfig } from "../../config/firebaseConfig";
import { notificationConfig } from "../../config/notificationConfig";
import { getFirebaseApp, initializeFirebaseApp } from "./firebaseInit";

let messagingInstance = null;
let foregroundUnsubscribe = null;

const getServiceWorkerRegistration = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    console.warn("[FCM] Service worker registration skipped: navigator.serviceWorker unavailable");
    return null;
  }

  console.info("[FCM] Registering service worker", { path: notificationConfig.serviceWorkerPath });
  const registration = await navigator.serviceWorker.register(notificationConfig.serviceWorkerPath, { scope: "/" });
  await navigator.serviceWorker.ready;
  console.info("[FCM] Service worker registered", {
    scope: registration.scope,
    active: registration.active?.scriptURL || null,
    installing: registration.installing?.scriptURL || null,
    waiting: registration.waiting?.scriptURL || null,
  });
  return registration;
};

export const initializeFirebaseMessaging = async () => {
  console.info("[FCM] Checking Firebase Messaging browser support");
  const supported = await isSupported();
  if (!supported) {
    console.warn("[FCM] Firebase messaging unsupported in this browser");
    return { messaging: null, status: "unsupported", reason: "Firebase messaging is not supported in this browser." };
  }

  const { app, readiness } = initializeFirebaseApp();
  if (!app) {
    console.warn("[FCM] Firebase messaging init skipped", { reason: readiness.reason });
    return { messaging: null, status: "placeholder", reason: readiness.reason };
  }

  messagingInstance = messagingInstance || getMessaging(app);
  console.info("[FCM] Firebase Messaging initialized");
  return { messaging: messagingInstance, status: "ready", reason: readiness.reason };
};

export const requestFirebaseMessagingToken = async () => {
  console.info("[FCM] Requesting Firebase messaging token");
  const { messaging, status, reason } = await initializeFirebaseMessaging();
  if (!messaging) return { token: null, status, reason };

  if (!firebaseRuntimeConfig.vapidKey) {
    console.warn("[FCM] Token request blocked: missing VAPID key");
    return {
      token: null,
      status: "missing-vapid-key",
      reason: "Add REACT_APP_FIREBASE_VAPID_KEY or VITE_FIREBASE_VAPID_KEY after enabling Firebase Web Push.",
    };
  }

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  const token = await getToken(messaging, {
    vapidKey: firebaseRuntimeConfig.vapidKey,
    serviceWorkerRegistration,
  });

  if (token) {
    console.info("[FCM] FCM token generated", token);
  } else {
    console.warn("[FCM] FCM token request returned an empty token");
  }

  return { token, status: token ? "token-ready" : "token-empty", reason: token ? "FCM token prepared." : "No FCM token returned." };
};

export const listenForForegroundMessages = async (handler) => {
  console.info("[FCM] Installing foreground message listener");
  const { messaging } = await initializeFirebaseMessaging();
  if (!messaging || typeof handler !== "function") return () => {};

  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = onMessage(messaging, handler);
  console.info("[FCM] Foreground message listener ready");
  return foregroundUnsubscribe;
};

export const stopForegroundMessages = () => {
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
};

export const deleteFirebaseMessagingToken = async () => {
  const app = getFirebaseApp();
  if (!app || !messagingInstance) return false;
  return deleteToken(messagingInstance);
};
