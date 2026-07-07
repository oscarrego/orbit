# Business Requirements Document (BRD) — Orbit

## 1. Project Overview & Business Value
Orbit is designed to address the critical need for real-time safety, coordination, and communication in local environments. By combining high-fidelity 3D map visualizations with instantaneous communication (chat) and an emergency distress broadcast system (SOS), Orbit provides a reliable platform for groups (such as families, event coordinators, or emergency response teams) to coordinate activities, track locations, and respond to crises instantly.

---

## 2. Key Features & Functional Requirements

- **Real-Time Geolocation Stream:** Continuously capture user coordinates (latitude, longitude) and orientation (heading) and broadcast them dynamically to all active members of the room.
- **High-Fidelity 3D/2D Map Control:** Display user positions with custom pins on an interactive MapLibre map featuring 3D building styling and lighting controls.
- **Room-Based Isolation:** Enable users to isolate communication and sharing to private groups using short alphanumeric room codes.
- **Asynchronous & Synchronous Chat:** Facilitate instant messaging within rooms with delivery status and seen receipts.
- **One-Touch SOS Warning System:** Allow a user to activate a distress state that displays prominent warnings on room members' maps and forces push notifications to offline or backgrounded members.
- **Invisible Mode / Privacy Toggle:** Let users opt-out of location sharing at any point without disconnecting from room-based messaging.

---

## 3. Tech Stack

- **Frontend:** React 19, MapLibre GL, React Three Fiber, Socket.IO Client, Firebase Web SDK, Framer Motion, Lenis Scroll.
- **Backend:** Flask (Python 3), Eventlet, Flask-SocketIO, Firebase Admin SDK.
- **Database:** MongoDB.
- **Mobile Integration:** Capacitor (for native Android builds).

---

## 4. Deployment Section

### Hosting Environment & Platforms
- **Web Application & API Server:** Hosted on **Render** (as a Web Service running a Python WSGI environment with Gunicorn/Eventlet).
- **Database Service:** Hosted on **MongoDB Atlas** (a fully managed cloud database provider).
- **Push Notification Gateway:** Hosted/Configured via the **Firebase Console (Firebase Cloud Messaging - FCM)**.

### Deployment Approach
The application utilizes a **Continuous Deployment (CD)** model connected to a version control system (GitHub):
1. Any code changes merged into the main production branch (`main`) trigger an automated build pipeline on Render.
2. The frontend assets are pre-built during local development (or can be configured in a multi-stage build) and served statically by the Flask server to ensure unified hosting.
3. The backend runs the Python WSGI application using the defined `Procfile`.

### Required Services
To deploy or run this application, the following active services are required:
1. **Render Web Service Instance:**
   - Plan type: Individual/Free or higher.
   - Env/Runtime: Python 3.
2. **MongoDB Atlas Cluster:**
   - Free Tier (M0) or higher.
   - Configured database name: `orbit`.
3. **Firebase Project:**
   - Firebase Cloud Messaging enabled.
   - Web App configuration created to retrieve Web Push credentials (VAPID key).
   - Service account private key generated and downloaded in JSON format.

### Steps to Deploy the Application

#### Step 1: Database Setup
1. Create a free cluster on MongoDB Atlas.
2. Under "Network Access", allow access from `0.0.0.0/0` (or add Render's outbound IPs if using a paid tier with static IPs).
3. Under "Database Access", create a database user and copy the connection string (`MONGO_URI`).

#### Step 2: Firebase Configuration
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project named `Orbit`.
3. Add a Web App to the project and copy the configuration details (`apiKey`, `authDomain`, `projectId`, etc.).
4. Go to **Project Settings > Service Accounts**. Generate a new private key and copy the contents of the downloaded JSON file (this will be used for `FIREBASE_SERVICE_ACCOUNT`).
5. Go to **Project Settings > Cloud Messaging**. Under **Web configuration**, generate a Web Push certificate key pair and copy the VAPID key.

#### Step 3: Local Frontend Build Preparation
To ensure the Flask server can serve the React frontend, compile the production assets locally before deploying, or set up a build workflow:
1. Go to the `frontend` directory.
2. Create a `.env` file containing the Firebase Web credentials and toggle `REACT_APP_FIREBASE_ENABLED` to `true`.
3. Run the compile script:
   ```bash
   npm run build
   ```
4. Confirm that the compiled files are generated in `frontend/build`. Ensure this directory is committed or available to your backend deployment.

#### Step 4: Render Web Service Creation
1. Log in to Render and select **New > Web Service**.
2. Connect your GitHub repository containing the Orbit project.
3. Set the following configuration options:
   - **Root Directory:** `backend` (or leave empty if deploying the entire repository, and configure build commands relative to the root).
   - **Runtime:** `Python`
   - **Build Command:** `pip install -r requirements.txt` (Render automatically copies the static frontend files if they are in the directory structure).
   - **Start Command:** `gunicorn -k eventlet.workers.EventletWorker -w 1 wsgi:app`
4. Go to the **Environment** tab on Render and add the following variables:
   - `MONGO_URI`: *Your MongoDB connection string*
   - `FIREBASE_SERVICE_ACCOUNT`: *The complete, single-line JSON string representing your Firebase Service Account JSON credentials file.*
   - `MONGO_SERVER_SELECTION_TIMEOUT_MS`: `5000`
5. Click **Deploy Web Service**.

### Steps to Update the Application
1. **Frontend Updates:**
   - If updates are made to the frontend, re-run `npm run build` inside the `frontend` folder to compile the assets.
   - Commit the updated build folder (`frontend/build/`) and push the changes to GitHub.
2. **Backend Updates:**
   - Implement backend modifications in `backend/app.py`.
   - Update `backend/requirements.txt` if any new dependencies are added.
   - Commit and push to GitHub.
3. Render will detect the new commit on the `main` branch, build the environment, and restart the service automatically with zero downtime.
