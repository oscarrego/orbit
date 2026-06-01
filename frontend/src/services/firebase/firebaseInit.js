import { getApp, getApps, initializeApp } from "firebase/app";
import { firebaseConfig, getFirebaseReadiness } from "../../config/firebaseConfig";

let cachedApp = null;
let firebaseInitLogged = false;

export const initializeFirebaseApp = () => {
  const readiness = getFirebaseReadiness();
  if (!readiness.ready) return { app: null, readiness };

  if (cachedApp) return { app: cachedApp, readiness };

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!firebaseInitLogged) {
    firebaseInitLogged = true;
    console.info("[FCM] Firebase initialized", {
      appName: cachedApp.name,
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
    });
  }
  return { app: cachedApp, readiness };
};

export const getFirebaseApp = () => cachedApp || initializeFirebaseApp().app;

export const isFirebaseReady = () => getFirebaseReadiness().ready;
