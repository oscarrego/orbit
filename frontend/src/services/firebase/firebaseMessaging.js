import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { firebaseRuntimeConfig } from "../../config/firebaseConfig";
import { notificationConfig } from "../../config/notificationConfig";
import { getFirebaseApp, initializeFirebaseApp } from "./firebaseInit";

let messagingInstance = null;
let foregroundUnsubscribe = null;

const getServiceWorkerRegistration = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration(notificationConfig.serviceWorkerPath);
  if (existing) return existing;

  return navigator.serviceWorker.register(notificationConfig.serviceWorkerPath);
};

export const initializeFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) {
    return { messaging: null, status: "unsupported", reason: "Firebase messaging is not supported in this browser." };
  }

  const { app, readiness } = initializeFirebaseApp();
  if (!app) {
    return { messaging: null, status: "placeholder", reason: readiness.reason };
  }

  messagingInstance = messagingInstance || getMessaging(app);
  return { messaging: messagingInstance, status: "ready", reason: readiness.reason };
};

export const requestFirebaseMessagingToken = async () => {
  const { messaging, status, reason } = await initializeFirebaseMessaging();
  if (!messaging) return { token: null, status, reason };

  if (!firebaseRuntimeConfig.vapidKey) {
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

  return { token, status: token ? "token-ready" : "token-empty", reason: token ? "FCM token prepared." : "No FCM token returned." };
};

export const listenForForegroundMessages = async (handler) => {
  const { messaging } = await initializeFirebaseMessaging();
  if (!messaging || typeof handler !== "function") return () => {};

  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = onMessage(messaging, handler);
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
