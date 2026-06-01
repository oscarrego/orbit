const DEBUG_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBtRVnU4H1JK0Mz1MbN1oxe830DkgLZxHw",
  authDomain: "orbit-d12e3.firebaseapp.com",
  projectId: "orbit-d12e3",
  storageBucket: "orbit-d12e3.firebasestorage.app",
  messagingSenderId: "679786936645",
  appId: "1:679786936645:web:789306631cc2baa9ef262c",
  measurementId: "G-DJ4QZG7D8B",
};

const DEBUG_VAPID_KEY = "BAaXZHcKe1U5kHWO73oXPeF3OiDrIjbJiKGjO6IO28Aj_MYLcMU7b-HpB3Yghr3ij13KxPb2zNlHEMSfH30-9I8";
const PLACEHOLDER = "PASTE_REAL_VALUE_HERE";

// Helper to filter out placeholders and undefined
const validStr = (val) => {
  if (!val) return undefined;
  if (String(val).startsWith("PASTE_REAL_")) return undefined;
  return val;
};

const readEnv = (key) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

const envApiKey = readEnv("REACT_APP_FIREBASE_API_KEY") || readEnv("VITE_FIREBASE_API_KEY");
const envAuthDomain = readEnv("REACT_APP_FIREBASE_AUTH_DOMAIN") || readEnv("VITE_FIREBASE_AUTH_DOMAIN");
const envProjectId = readEnv("REACT_APP_FIREBASE_PROJECT_ID") || readEnv("VITE_FIREBASE_PROJECT_ID");
const envStorageBucket = readEnv("REACT_APP_FIREBASE_STORAGE_BUCKET") || readEnv("VITE_FIREBASE_STORAGE_BUCKET");
const envMessagingSenderId = readEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID") || readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
const envAppId = readEnv("REACT_APP_FIREBASE_APP_ID") || readEnv("VITE_FIREBASE_APP_ID");
const envMeasurementId = readEnv("REACT_APP_FIREBASE_MEASUREMENT_ID") || readEnv("VITE_FIREBASE_MEASUREMENT_ID");
const envEnabled = readEnv("REACT_APP_FIREBASE_ENABLED") || readEnv("VITE_FIREBASE_ENABLED");
const envVapidKey = readEnv("REACT_APP_FIREBASE_VAPID_KEY") || readEnv("VITE_FIREBASE_VAPID_KEY");

export const firebaseConfig = {
  apiKey: validStr(envApiKey) || DEBUG_FIREBASE_CONFIG.apiKey,
  authDomain: validStr(envAuthDomain) || DEBUG_FIREBASE_CONFIG.authDomain,
  projectId: validStr(envProjectId) || DEBUG_FIREBASE_CONFIG.projectId,
  storageBucket: validStr(envStorageBucket) || DEBUG_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: validStr(envMessagingSenderId) || DEBUG_FIREBASE_CONFIG.messagingSenderId,
  appId: validStr(envAppId) || DEBUG_FIREBASE_CONFIG.appId,
  measurementId: validStr(envMeasurementId) || DEBUG_FIREBASE_CONFIG.measurementId,
};

export const firebaseRuntimeConfig = {
  enabled: String(validStr(envEnabled) || "true").toLowerCase() !== "false",
  vapidKey: validStr(envVapidKey) || DEBUG_VAPID_KEY,
};

export const hasFirebaseConfig = () =>
  Boolean(
    firebaseConfig.apiKey !== PLACEHOLDER &&
      firebaseConfig.authDomain !== PLACEHOLDER &&
      firebaseConfig.projectId !== PLACEHOLDER &&
      firebaseConfig.messagingSenderId !== PLACEHOLDER &&
      firebaseConfig.appId !== PLACEHOLDER
  );

export const getFirebaseReadiness = () => {
  console.info("[FCM] Firebase config check", {
    enabled: firebaseRuntimeConfig.enabled,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    hasFirebaseConfig: hasFirebaseConfig(),
    hasVapidKey: Boolean(firebaseRuntimeConfig.vapidKey),
  });

  if (!firebaseRuntimeConfig.enabled) {
    const result = {
      ready: false,
      reason: "Firebase notifications are disabled by env config.",
    };
    console.warn("[FCM] Firebase readiness", result);
    return result;
  }

  if (!hasFirebaseConfig()) {
    const result = {
      ready: false,
      reason: "Firebase config is still using placeholders. Paste real Firebase values in config or env.",
    };
    console.warn("[FCM] Firebase readiness", result);
    return result;
  }

  const result = { ready: true, reason: "Firebase config is ready." };
  console.info("[FCM] Firebase readiness", result);
  return result;
};
