import { notificationConfig } from "../../config/notificationConfig";
import { getFirebaseReadiness } from "../../config/firebaseConfig";
import {
  deleteFirebaseMessagingToken,
  initializeFirebaseMessaging,
  listenForForegroundMessages,
  requestFirebaseMessagingToken,
  stopForegroundMessages,
} from "../firebase/firebaseMessaging";
import { registerNotificationToken, unregisterNotificationToken } from "./notificationTokenRegistry";
import {
  getBrowserNotificationPermission,
  isNotificationSupported,
  requestBrowserNotificationPermission,
} from "../../utils/notificationSupport";

const listeners = new Set();

const readStorage = (key, fallback = "") => {
  if (typeof localStorage === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
};

const writeStorage = (key, value) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
};

const removeStorage = (key) => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
};

const createState = (overrides = {}) => ({
  enabled: readStorage(notificationConfig.storageKeys.enabled) === "true",
  permission: getBrowserNotificationPermission(),
  supported: isNotificationSupported(),
  status: readStorage(notificationConfig.storageKeys.lastStatus, "idle"),
  token: readStorage(notificationConfig.storageKeys.token, ""),
  error: "",
  ...overrides,
});

let currentState = createState();

const emit = (patch) => {
  currentState = createState({ ...currentState, ...patch });
  listeners.forEach((listener) => listener(currentState));
};

const persistEnabled = (enabled) => {
  writeStorage(notificationConfig.storageKeys.enabled, String(enabled));
};

const persistStatus = (status) => {
  writeStorage(notificationConfig.storageKeys.lastStatus, status);
};

const getForegroundNotificationDetails = (payload) => {
  const data = payload?.data || {};
  const notification = payload?.notification || {};
  const title = notification.title || data.title || (data.type === "sos_cancel" ? "SOS Cancelled" : "EMERGENCY SOS");
  const body =
    notification.body ||
    data.body ||
    (data.senderName ? `${data.senderName} has triggered an SOS alert!` : "New Orbit activity");

  return {
    title,
    options: {
      body,
      icon: notification.icon || "/logo192.png",
      badge: "/logo192.png",
      tag: data.type ? `orbit-${data.type}-${data.senderId || "unknown"}` : "orbit-fcm-message",
      requireInteraction: data.type === "sos_alert",
      data,
    },
  };
};

const displayForegroundBrowserNotification = (payload) => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("[FCM] Foreground browser notification skipped: Notification API unavailable");
    return null;
  }

  if (window.Notification.permission !== "granted") {
    console.warn("[FCM] Foreground browser notification skipped: permission is not granted", {
      permission: window.Notification.permission,
    });
    return null;
  }

  const { title, options } = getForegroundNotificationDetails(payload);
  const notification = new window.Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  console.info("[FCM] Browser notification displayed from foreground message", {
    title,
    tag: options.tag,
    type: options.data?.type,
  });
  return notification;
};

export const notificationService = {
  getState() {
    currentState = createState(currentState);
    return currentState;
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(this.getState());
    return () => listeners.delete(listener);
  },

  async restore(user) {
    const savedEnabled = readStorage(notificationConfig.storageKeys.enabled) === "true";
    const permission = getBrowserNotificationPermission();
    console.info("[FCM] Restoring notification state", {
      savedEnabled,
      permission,
      userId: user?.userId,
      username: user?.username,
    });
    if (!savedEnabled || permission !== "granted") {
      emit({ enabled: savedEnabled, permission, status: savedEnabled ? "permission-needed" : "idle" });
      return this.getState();
    }

    return this.enable({ user, silent: true });
  },

  async enable({ user, silent = false } = {}) {
    if (!isNotificationSupported()) {
      persistEnabled(false);
      persistStatus("unsupported");
      emit({ enabled: false, supported: false, status: "unsupported", permission: "unsupported" });
      return this.getState();
    }

    emit({ status: silent ? "restoring" : "requesting-permission", error: "" });
    console.info("[FCM] Notification setup started", {
      silent,
      userId: user?.userId,
      username: user?.username,
    });

    const permission = silent ? getBrowserNotificationPermission() : await requestBrowserNotificationPermission();
    writeStorage(notificationConfig.storageKeys.permission, permission);
    console.info("[FCM] Notification permission result", permission);

    if (permission !== "granted") {
      persistEnabled(false);
      persistStatus(permission === "denied" ? "denied" : "permission-needed");
      emit({ enabled: false, permission, status: permission === "denied" ? "denied" : "permission-needed" });
      return this.getState();
    }

    persistEnabled(true);

    const readiness = getFirebaseReadiness();
    if (!readiness.ready) {
      await initializeFirebaseMessaging();
      persistStatus("prepared-placeholder");
      emit({
        enabled: true,
        permission,
        status: "prepared-placeholder",
        error: readiness.reason,
      });
      return this.getState();
    }

    try {
      const tokenResult = await requestFirebaseMessagingToken();
      if (tokenResult.token) {
        writeStorage(notificationConfig.storageKeys.token, tokenResult.token);
        const registrationResponse = await registerNotificationToken({ token: tokenResult.token, user });
        console.info("[FCM] Token registration completed", registrationResponse);
      } else {
        console.warn("[FCM] Token registration skipped: no token generated", tokenResult);
      }

      await listenForForegroundMessages((payload) => {
        console.info("[FCM] Foreground message received", payload);
        displayForegroundBrowserNotification(payload);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("orbit:fcm-message", { detail: payload }));
        }
      });

      persistStatus(tokenResult.status);
      emit({
        enabled: true,
        permission,
        token: tokenResult.token || "",
        status: tokenResult.status,
        error: tokenResult.reason || "",
      });
    } catch (error) {
      persistStatus("error");
      emit({ enabled: true, permission, status: "error", error: error.message || "Notification setup failed." });
    }

    return this.getState();
  },

  async disable({ user } = {}) {
    const token = readStorage(notificationConfig.storageKeys.token);
    persistEnabled(false);
    persistStatus("disabled");
    stopForegroundMessages();

    try {
      if (token) {
        await unregisterNotificationToken({ token, user });
        await deleteFirebaseMessagingToken();
      }
    } catch (error) {
      console.warn("Unable to fully unregister notification token:", error);
    }

    removeStorage(notificationConfig.storageKeys.token);
    emit({ enabled: false, token: "", status: "disabled", error: "" });
    return this.getState();
  },
};
