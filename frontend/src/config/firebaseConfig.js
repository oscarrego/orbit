const PLACEHOLDER = "PASTE_REAL_VALUE_HERE";

// Helper to filter out placeholders and undefined
const validStr = (val) => {
  if (!val) return undefined;
  if (String(val).startsWith("PASTE_REAL_")) return undefined;
  return val;
};

// Explicit Vite env variable references (Vite requires these to be statically analyzable)
const envApiKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_API_KEY : undefined;
const envAuthDomain = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : undefined;
const envProjectId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_PROJECT_ID : undefined;
const envStorageBucket = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : undefined;
const envMessagingSenderId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined;
const envAppId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_APP_ID : undefined;
const envMeasurementId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_MEASUREMENT_ID : undefined;
const envEnabled = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_ENABLED : undefined;
const envVapidKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_FIREBASE_VAPID_KEY : undefined;

export const firebaseConfig = {
  // Paste real Firebase values here later, or set the env vars in .env/Vercel.
  apiKey: validStr(envApiKey) || PLACEHOLDER,
  authDomain: validStr(envAuthDomain) || PLACEHOLDER,
  projectId: validStr(envProjectId) || PLACEHOLDER,
  storageBucket: validStr(envStorageBucket) || PLACEHOLDER,
  messagingSenderId: validStr(envMessagingSenderId) || PLACEHOLDER,
  appId: validStr(envAppId) || PLACEHOLDER,
  measurementId: validStr(envMeasurementId) || undefined,
};

export const firebaseRuntimeConfig = {
  enabled: String(envEnabled).toLowerCase() === "true",
  vapidKey: validStr(envVapidKey) || "",
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
  console.log("firebaseRuntimeConfig", firebaseRuntimeConfig);
  console.log("firebaseConfig", firebaseConfig);
  console.log("hasFirebaseConfig", hasFirebaseConfig());

  if (!firebaseRuntimeConfig.enabled) {
    const result = {
      ready: false,
      reason: "Firebase notifications are disabled. Set VITE_FIREBASE_ENABLED=true after adding real keys.",
    };
    console.log("readiness", result);
    return result;
  }

  if (!hasFirebaseConfig()) {
    const result = {
      ready: false,
      reason: "Firebase config is still using placeholders. Paste real Firebase values in config or env.",
    };
    console.log("readiness", result);
    return result;
  }

  const result = { ready: true, reason: "Firebase config is ready." };
  console.log("readiness", result);
  return result;
};
