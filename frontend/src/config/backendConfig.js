const DEFAULT_REMOTE_BACKEND_URL = "https://orbit-g4ah.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5000";

const readEnv = (key) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

const cleanUrl = (value) => String(value || "").replace(/\/$/, "");

const isLocalBrowser = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

const envBackendUrl =
  readEnv("REACT_APP_BACKEND_URL") ||
  readEnv("VITE_BACKEND_URL") ||
  readEnv("REACT_APP_SOCKET_URL") ||
  readEnv("VITE_SOCKET_URL");

const backendBaseUrl = cleanUrl(envBackendUrl || (isLocalBrowser() ? LOCAL_BACKEND_URL : DEFAULT_REMOTE_BACKEND_URL));

export const backendConfig = {
  baseUrl: backendBaseUrl,
  apiBaseUrl: `${backendBaseUrl}/api`,
};
