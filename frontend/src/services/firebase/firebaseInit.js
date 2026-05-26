import { getApp, getApps, initializeApp } from "firebase/app";
import { firebaseConfig, getFirebaseReadiness } from "../../config/firebaseConfig";

let cachedApp = null;

export const initializeFirebaseApp = () => {
  const readiness = getFirebaseReadiness();
  if (!readiness.ready) return { app: null, readiness };

  if (cachedApp) return { app: cachedApp, readiness };

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app: cachedApp, readiness };
};

export const getFirebaseApp = () => cachedApp || initializeFirebaseApp().app;

export const isFirebaseReady = () => getFirebaseReadiness().ready;
