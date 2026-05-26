const PLACEHOLDER = "PASTE_REAL_VALUE_HERE";

const readEnv = (key) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

const readClientEnv = (...keys) =>
  keys.map(readEnv).find((value) => value && !String(value).startsWith("PASTE_REAL_"));

const readBooleanEnv = (...keys) =>
  keys.some((key) => String(readEnv(key)).toLowerCase() === "true");

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
  if (!firebaseRuntimeConfig.enabled) {
    return {
      ready: false,
      reason: "Firebase notifications are disabled. Set FIREBASE_ENABLED=true after adding real keys.",
    };
  }

  if (!hasFirebaseConfig()) {
    return {
      ready: false,
      reason: "Firebase config is still using placeholders. Paste real Firebase values in config or env.",
    };
  }

  return { ready: true, reason: "Firebase config is ready." };
};
