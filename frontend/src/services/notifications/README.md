# Orbit Notification Architecture

This folder is the high-level notification layer. React components should use
`useNotifications()` instead of importing Firebase directly.

When Firebase is ready later:

1. Paste real values into `.env` or `src/config/firebaseConfig.js`.
2. Set `REACT_APP_FIREBASE_ENABLED=true` or `VITE_FIREBASE_ENABLED=true`.
3. Add a real Firebase Web Push VAPID key.
4. Add backend token endpoints when the Render backend is ready:
   - `POST /notifications/register`
   - `POST /notifications/unregister`
5. Replace the placeholder logic in `public/firebase-messaging-sw.js` with the
   Firebase background-message handler.

Current behavior:

- Permission flow works.
- User preference persists in localStorage.
- Toggle state survives reloads.
- Firebase setup is safely skipped while placeholder config is active.
- Foreground/background registration paths are already reserved.
