const PLACEHOLDER = "PASTE_REAL_VALUE_HERE";

// For Vite, we MUST use static references (import.meta.env.VITE_...)
// We can't use a dynamic key lookup like import.meta.env[key] because Vite statically replaces these at build time.
const getEnv = (reactKey, viteKey) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (viteKey === "VITE_FIREBASE_API_KEY") return import.meta.env.VITE_FIREBASE_API_KEY;
    if (viteKey === "VITE_FIREBASE_AUTH_DOMAIN") return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    if (viteKey === "VITE_FIREBASE_PROJECT_ID") return import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (viteKey === "VITE_FIREBASE_STORAGE_BUCKET") return import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    if (viteKey === "VITE_FIREBASE_MESSAGING_SENDER_ID") return import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
    if (viteKey === "VITE_FIREBASE_APP_ID") return import.meta.env.VITE_FIREBASE_APP_ID;
    if (viteKey === "VITE_FIREBASE_MEASUREMENT_ID") return import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
    if (viteKey === "VITE_FIREBASE_ENABLED") return import.meta.env.VITE_FIREBASE_ENABLED;
    if (viteKey === "VITE_FIREBASE_VAPID_KEY") return import.meta.env.VITE_FIREBASE_VAPID_KEY;
  }
  if (typeof process !== "undefined" && process.env) {
    if (process.env[reactKey]) return process.env[reactKey];
    if (process.env[viteKey]) return process.env[viteKey];
  }
  return undefined;
};

const readClientEnv = (reactKey, viteKey) => {
  const value = getEnv(reactKey, viteKey);
  return value && !String(value).startsWith("PASTE_REAL_") ? value : undefined;
};

const readBooleanEnv = (reactKey, viteKey) => {
  const value = getEnv(reactKey, viteKey);
  return String(value).toLowerCase() === "true";
};

export const firebaseConfig = {
  // Paste real Firebase values here later, or set the env vars in .env/Vercel.
  apiKey: readClientEnv("REACT_APP_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY") || PLACEHOLDER,
  authDomain: readClientEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN") || PLACEHOLDER,
  projectId: readClientEnv("REACT_APP_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID") || PLACEHOLDER,
  storageBucket: readClientEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET") || PLACEHOLDER,
  messagingSenderId:
    readClientEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID") || PLACEHOLDER,
  appId: readClientEnv("REACT_APP_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID") || PLACEHOLDER,
  measurementId:
    readClientEnv("REACT_APP_FIREBASE_MEASUREMENT_ID", "VITE_FIREBASE_MEASUREMENT_ID") || undefined,
};

export const firebaseRuntimeConfig = {
  enabled: readBooleanEnv("REACT_APP_FIREBASE_ENABLED", "VITE_FIREBASE_ENABLED"),
  vapidKey: readClientEnv("REACT_APP_FIREBASE_VAPID_KEY", "VITE_FIREBASE_VAPID_KEY") || "",
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
      reason: "Firebase notifications are disabled. Set FIREBASE_ENABLED=true after adding real keys.",
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
