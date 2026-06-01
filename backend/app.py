import eventlet
eventlet.monkey_patch()

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time
from bson.objectid import ObjectId

from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, messaging



# --------------------------------------------------
# DATABASE
# --------------------------------------------------
MONGO_URI = os.environ.get("MONGO_URI")
MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))
if not MONGO_URI:
    print("[MongoDB] MONGO_URI is not set; falling back to localhost:27017 for local debugging.")
client    = MongoClient(MONGO_URI or "mongodb://localhost:27017", serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_TIMEOUT_MS)
db        = client["orbit"]

messages_collection = db["messages"]
rooms_collection    = db["rooms"]
room_members_collection = db["room_members"]

# --------------------------------------------------
# INDEX SETUP
#
# Root-cause fix: stale indexes from previous code
# versions (e.g. unique index on 'creator', 'name',
# or any field that is not 'roomName') cause every
# insert_one to throw DuplicateKeyError even when the
# roomName itself is brand-new.
#
# Solution: print every index, wipe ALL non-_id ones,
# then rebuild exactly one — roomName (sparse+unique).
# sparse=True means documents without a 'roomName'
# field are excluded from the index entirely, which
# prevents null-collision errors.
# --------------------------------------------------

# ── messages TTL ──────────────────────────────────
try:
    messages_collection.create_index(
        "createdAt", expireAfterSeconds=86400, background=True
    )
    print("messages TTL index OK")
except Exception as e:
    print(f" messages index: {e}")

# ── rooms — full index reset ──────────────────────
print("\n Current indexes on 'rooms' collection:")
try:
    idx_info = rooms_collection.index_information()
    for idx_name, idx_data in idx_info.items():
        print(f"  • {idx_name}: {idx_data}")
except Exception as e:
    print(f"    Could not read indexes: {e}")
    idx_info = {}

# Drop every custom index (keep _id_)
for idx_name in list(idx_info.keys()):
    if idx_name == "_id_":
        continue
    try:
        rooms_collection.drop_index(idx_name)
        print(f"    Dropped stale index: {idx_name}")
    except Exception as e:
        print(f"    Could not drop '{idx_name}': {e}")

# Rebuild the ONE index we actually want
try:
    rooms_collection.create_index(
        [("roomName", ASCENDING)],
        unique=True,
        sparse=True,          # ignores docs without roomName — no null collisions
        name="roomName_unique",
        background=True,
    )
    print("rooms unique+sparse index on 'roomName' ready\n")
except Exception as e:
    print(f"Could not create rooms index: {e}\n")

# --------------------------------------------------
# FIREBASE ADMIN & FCM
# --------------------------------------------------
DEBUG_FIREBASE_SERVICE_ACCOUNT = {
    "type": "service_account",
    "project_id": "orbit-d12e3",
    "private_key_id": "dfc8f53fb0cd35ebb499fed0e0bf29bf24d65138",
    "private_key": """-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCpYbx88gRpmLA3
XAl0Xu4hc6ihy96nE3Jf7jZAXE/LtwO4dxL2cmYVl9r6NqTQHrhgTkknpnxX+kv/
5ZOqim7r8QiiMbuPG/BL48i8oL5AFfVwqAogx8aYbORnCuLhrXLkn0Sdd4HAgi51
/knZxvYKmaGRD/egB5EChCeuTaHOqN79AvhzwrM5O0R6Y5GhrTZczpzUmNTXHNhY
FM6hgMiS6uPKPmlcHONSWJ8a6DEofX/tLCaxGQFmsx5QkN8x4qvqD0IlvEO06MkK
qy347Uc/VXEq9fTKYYUJp4pFgAVZY3OBRy+/AmtjMKSMBmZGNano6U7LJF476zNE
APUAYDcRAgMBAAECggEAHk0JtyBkga969qxUVKkW2I0kQa2C60ijUV3//ouFCuB2
ne1PSx8z+/Dqj5Bu83xLZ48ZryotXF++cMzVGdEh/rtj3AAhmXxaBHl/U5896aEE
A19MUIjskiAIzBY6eDzbLOMBF1plr9aaESmodHkPUt4g9R5yIgK4gka6AoiIxbtN
TDLw4Vd1NeSI8Dna17HCaqZF6uEBxPMZ7NKcJYwiIq38UJuKTKLds9RKDnr7pPaS
//+VJ9cmgyIfRaofSsnIl76s0pSpsJ9zQNaUWiU6hSq0YNh82k8Twvhm19rcvSJx
xKtMO6RdBeNFB2NNgNuqA1alpc2QeseLV5yN5Tp5sQKBgQDhXo5IpFqol93MGLvD
ESGuxRnXAZUK3RheBb02QaiJO1i0DR4v0Bo1PVFih0pWAS97vKNJh+KVKDD+Lpvt
WwfBWSRW+3jV2PqBWpEcWjXOO8k2SjJjxx3YYtqB9Xl5aDt0GrPURezYvc4QzDNq
EyxN3qMJtjaHNq2bV/O1I8ZGRwKBgQDAZym5PKoEOZCA7KSu01lDBSGAXLCJpml4
UH8NfzHHtYxxoCGlaSKu++rlhffyY0KppZqoEcxWiI+GEM6q/CB0RXhQMU5A7+hB
kVE+PGwU9GksCiUtjmbqW5iADZu2071gdQ0Xt/Ung+02f0ViTIPWhAPeRSi+/m1p
IAXK3yBL5wKBgQC3aLNUrOTW5djsW4iaxJtr1x4jWzdHQw2snvEQcbjODg0vYqmZ
cbuSbleIXuABRC+3fJpKohqlFrNgeOAO95FFKd2oKDl7l3yuvtzvfP7i2sbytslx
aD+CtVhsgTCdvFT+NSj6bPnGnhlQlE6XWgkpSjHXGoIf4kDA9n/wf6/BywKBgB5v
c0MxHHfknz41sOtS1Xjrk9wZTXfI0kBNA3wgFcDQsDG9MfVXhzwE76h1I769AuuR
HcDeZ+N8YK/FctvLXFroLlsJIabWDHhqw15D8pjx/L0RscXeE9uYt6vx+yLVpcxf
V73bxLUGgnyvb0tYbTZ+1ZnQeNyVpLsPbLslxpcbAoGBALzewoQ5Bulbl9+n/1Oy
HQDPWobftLUomRKzaUP9/pMHfvJ4uvEikz4321zvnhjf3grdZenvtRpbc2EE4NvE
O/qCMhusBx/0LIVkVWQBIv+ClErGrDp1uAyVztXIzHTtIxmlLhJ0DVBhaGMgmUmz
y+T3ZUfjISL6S2PwrNwb+Pbq
-----END PRIVATE KEY-----
""",
    "client_email": "firebase-adminsdk-fbsvc@orbit-d12e3.iam.gserviceaccount.com",
    "client_id": "109935303093014509834",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40orbit-d12e3.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com",
}

firebase_cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
firebase_initialized = False
firebase_admin_metadata = {}
try:
    firebase_cred_source = "FIREBASE_SERVICE_ACCOUNT env var" if firebase_cred_json else "hardcoded debug service account"
    cred_dict = json.loads(firebase_cred_json) if firebase_cred_json else DEBUG_FIREBASE_SERVICE_ACCOUNT
    cred = credentials.Certificate(cred_dict)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    firebase_initialized = True
    firebase_admin_metadata = {
        "source": firebase_cred_source,
        "project_id": cred_dict.get("project_id"),
        "client_email": cred_dict.get("client_email"),
    }
    print("[FCM] Firebase Admin initialized", firebase_admin_metadata)
except Exception as e:
    print(f"[FCM] Failed to initialize Firebase Admin SDK: {e}")

fcm_tokens_collection = db["fcm_tokens"]
try:
    fcm_tokens_collection.create_index("token", unique=True, background=True)
    fcm_tokens_collection.create_index("userId", background=True)
    print("[FCM] fcm_tokens unique token index ready")
except Exception as e:
    print(f"[FCM] fcm_tokens index: {e}")

try:
    room_members_collection.create_index("userId", unique=True, background=True)
    room_members_collection.create_index("room", background=True)
    print("[Rooms] room_members indexes ready")
except Exception as e:
    print(f"[Rooms] room_members index: {e}")


def mask_token(token):
    if not token:
        return ""
    token = str(token)
    if len(token) <= 20:
        return token
    return f"{token[:12]}...{token[-8:]}"


def load_fcm_tokens():
    try:
        docs = list(
            fcm_tokens_collection.find(
                {},
                {"_id": 0, "token": 1, "userId": 1, "username": 1, "platform": 1},
            )
        )
    except Exception as e:
        print(f"[FCM] Failed to load tokens from MongoDB: {e}")
        raise

    token_docs = [doc for doc in docs if doc.get("token")]
    print("[FCM] Token count loaded", {
        "total_docs": len(docs),
        "usable_tokens": len(token_docs),
        "users": [
            {
                "userId": doc.get("userId"),
                "username": doc.get("username"),
                "platform": doc.get("platform"),
                "token": mask_token(doc.get("token")),
            }
            for doc in token_docs
        ],
    })
    return token_docs


def load_fcm_tokens_for_room(room):
    try:
        member_docs = list(
            room_members_collection.find(
                {"room": room},
                {"_id": 0, "userId": 1, "username": 1, "updatedAt": 1},
            )
        )
    except Exception as e:
        print(f"[FCM] Failed to load room members from MongoDB: {e}")
        raise

    user_ids = sorted({str(doc.get("userId")) for doc in member_docs if doc.get("userId")})
    if not user_ids:
        print("[FCM] No persisted room members for SOS room", {"room": room})
        return []

    try:
        docs = list(
            fcm_tokens_collection.find(
                {"userId": {"$in": user_ids}},
                {"_id": 0, "token": 1, "userId": 1, "username": 1, "platform": 1},
            )
        )
    except Exception as e:
        print(f"[FCM] Failed to load room-scoped tokens from MongoDB: {e}")
        raise

    token_docs = [doc for doc in docs if doc.get("token")]
    print("[FCM] Room token count loaded", {
        "room": room,
        "member_count": len(user_ids),
        "usable_tokens": len(token_docs),
        "users": [
            {
                "userId": doc.get("userId"),
                "username": doc.get("username"),
                "platform": doc.get("platform"),
                "token": mask_token(doc.get("token")),
            }
            for doc in token_docs
        ],
    })
    return token_docs


def build_fcm_message(event_type, data, tokens):
    sender_name = data.get("name", "Someone")
    sender_id = str(data.get("id", ""))
    is_cancel = event_type == "sos_cancel"
    title = "SOS Cancelled" if is_cancel else "EMERGENCY SOS"
    body = (
        f"{sender_name} has cancelled the SOS alert."
        if is_cancel
        else f"{sender_name} has triggered an SOS alert!"
    )

    payload_data = {
        "type": event_type,
        "senderId": sender_id,
        "senderName": str(sender_name),
        "title": title,
        "body": body,
        "lat": str(data.get("lat", "")),
        "lng": str(data.get("lng", "")),
        "room": str(data.get("room", "")),
    }

    print("[FCM] Notification payload created", {
        "title": title,
        "body": body,
        "data": payload_data,
        "token_count": len(tokens),
    })

    return messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        webpush=messaging.WebpushConfig(
            notification=build_webpush_notification(title, body, event_type, sender_id),
        ),
        data=payload_data,
        tokens=tokens,
    )


def build_webpush_notification(title, body, event_type, sender_id):
    return messaging.WebpushNotification(
        title=title,
        body=body,
        icon="/logo192.png",
        badge="/logo192.png",
        tag=f"orbit-{event_type}-{sender_id or 'unknown'}",
        require_interaction=event_type == "sos_alert",
    )


def send_fcm_multicast(message, token_docs):
    tokens = [doc["token"] for doc in token_docs]
    if not firebase_initialized:
        print("[FCM] Send skipped: Firebase Admin is not initialized")
        return None
    if not tokens:
        print("[FCM] Send skipped: no FCM tokens stored")
        return None

    print("[FCM] Sending multicast push", {
        "token_count": len(tokens),
        "tokens": [mask_token(token) for token in tokens],
    })

    if hasattr(messaging, "send_each_for_multicast"):
        response = messaging.send_each_for_multicast(message)
    else:
        response = messaging.send_multicast(message)

    failed_tokens = []
    for idx, send_response in enumerate(getattr(response, "responses", []) or []):
        if not send_response.success:
            failed_tokens.append(
                {
                    "token": mask_token(tokens[idx]),
                    "error": str(send_response.exception),
                }
            )

    print("[FCM] FCM send response", response)
    print("[FCM] Success count", response.success_count)
    print("[FCM] Failure count", response.failure_count)
    print("[FCM] Failed tokens", failed_tokens)
    return response


def send_sos_fcm(event_type, data, room):
    token_docs = load_fcm_tokens_for_room(room)
    token_list = [doc["token"] for doc in token_docs]
    if not token_list:
        print("[FCM] SOS push skipped before payload build: no registered browser tokens for room", {"room": room})
        return None

    message = build_fcm_message(event_type, data, token_list)
    return send_fcm_multicast(message, token_docs)

# --------------------------------------------------
# FLASK + SOCKETIO
# --------------------------------------------------
app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True,
)




# --------------------------------------------------
# In-memory session state  (ephemeral — NOT for auth)
# --------------------------------------------------
users          = {}
socket_to_user = {}
socket_to_room = {}
invisible_users = set()          # user IDs currently in invisible mode

DEFAULT_ROOM = "Global"


def normalize_room_name(room):
    room = (room or DEFAULT_ROOM).strip()
    return room or DEFAULT_ROOM


def persist_room_membership(user_id, room, username=None):
    if not user_id:
        return

    doc = {
        "userId": str(user_id),
        "room": normalize_room_name(room),
        "updatedAt": datetime.utcnow(),
    }
    if username:
        doc["username"] = username

    try:
        room_members_collection.update_one(
            {"userId": str(user_id)},
            {"$set": doc},
            upsert=True,
        )
    except Exception as e:
        print(f"[Rooms] Failed to persist room membership for {user_id}: {e}")


def get_user_room(user_id=None, sid=None, fallback=DEFAULT_ROOM):
    if sid and socket_to_room.get(sid):
        return socket_to_room[sid]
    if user_id and users.get(user_id, {}).get("room"):
        return users[user_id]["room"]
    return normalize_room_name(fallback)


def get_event_room(data, sid=None, user_id=None):
    fallback = normalize_room_name((data or {}).get("room"))
    return get_user_room(user_id=user_id, sid=sid, fallback=fallback)


def visible_users_for_room(room):
    room = normalize_room_name(room)
    return [
        user
        for user in users.values()
        if user.get("room") == room and user.get("id") not in invisible_users
    ]


def emit_room_users(room):
    room = normalize_room_name(room)
    visible = visible_users_for_room(room)
    print("[Presence] Emitting room users", {
        "room": room,
        "count": len(visible),
        "users": [user.get("id") for user in visible],
    })
    socketio.emit("update_users", visible, room=room)


def switch_socket_room(sid, room, user_id=None, username=None):
    room = normalize_room_name(room)
    old_room = socket_to_room.get(sid)

    if old_room and old_room != room:
        leave_room(old_room)

    join_room(room)
    socket_to_room[sid] = room

    if user_id:
        user_id = str(user_id)
        socket_to_user[sid] = user_id
        if user_id in users:
            users[user_id]["room"] = room
            if username:
                users[user_id]["name"] = username
        persist_room_membership(user_id, room, username)

    if old_room and old_room != room:
        emit_room_users(old_room)

    return old_room, room

# --------------------------------------------------
# ROOM HELPERS
# --------------------------------------------------
def get_room(room_name):
    """
    Query rooms_collection for a document with roomName == room_name.
    Returns the dict or None.
    """
    doc = rooms_collection.find_one({"roomName": room_name})
    if doc:
        print(f"get_room('{room_name}') → FOUND  _id={doc['_id']}")
    else:
        print(f"get_room('{room_name}') → NOT FOUND")
    return doc


def db_create_room(room_name, passcode, creator_sid):
    """
    Insert a new private room document into MongoDB.
    Returns (doc, None) on success, (None, error_str) on failure.
    """
    doc = {
        "roomName":  room_name,
        "passcode":  passcode,
        "creator":   creator_sid,
        "createdAt": datetime.utcnow(),
        "isPrivate": True,
    }
    print(f"db_create_room: roomName='{room_name}'  passcode='{passcode}'")
    try:
        result = rooms_collection.insert_one(doc)
        _id = str(result.inserted_id)
        doc["_id"] = _id
        print(f"Room '{room_name}' saved to MongoDB  _id={_id}")
        return doc, None

    except DuplicateKeyError as exc:
        # Log the EXACT field that caused the conflict so we can diagnose
        details = getattr(exc, "details", {}) or {}
        key_val = details.get("keyValue", "unknown")
        print(f"DuplicateKeyError on room '{room_name}'")
        print(f"  conflicting key → {key_val}")
        print(f"  full details   → {details}")
        return None, "Room already exists"

    except Exception as exc:
        print(f"insert_one failed for '{room_name}': {exc}")
        return None, str(exc)


def load_recent_messages(room):
    cutoff = time.time() - 86400
    messages = list(
        messages_collection.find(
            {"room": room, "timestamp": {"$gt": cutoff}}
        ).sort("timestamp", 1)
    )
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        msg.pop("createdAt", None)
        msg.setdefault("seenBy", [])
        msg.setdefault("senderId", "unknown")
    return messages

# --------------------------------------------------
# DEBUG HTTP ENDPOINTS
# --------------------------------------------------

@app.route("/api/rooms", methods=["GET"])
def list_rooms():
    """Return all room documents (passcode redacted)."""
    docs = list(rooms_collection.find({}, {"passcode": 0}))
    for d in docs:
        d["_id"] = str(d["_id"])
        if "createdAt" in d:
            d["createdAt"] = d["createdAt"].isoformat()
    return jsonify({"count": len(docs), "rooms": docs})


@app.route("/api/rooms/indexes", methods=["GET"])
def show_indexes():
    """Return every index on the rooms collection."""
    raw = rooms_collection.index_information()
    return jsonify(raw)


@app.route("/api/rooms/nuke", methods=["DELETE"])
def nuke_rooms():
    """
    Emergency reset: delete every document in rooms_collection.
    Call this once from Postman/curl if there is stale data blocking inserts.
    """
    result = rooms_collection.delete_many({})
    return jsonify({"deleted": result.deleted_count})

@app.route("/api/notifications/register", methods=["POST"])
def register_fcm_token():
    data = request.json or {}
    token = data.get("token")
    user_id = data.get("userId", "anonymous")
    username = data.get("username", "Unknown")

    print("[FCM] Token registration API called", {
        "userId": user_id,
        "username": username,
        "platform": data.get("platform", "web"),
        "token": mask_token(token),
    })
    
    if not token:
        print("[FCM] Token registration rejected: missing token")
        return jsonify({"error": "Token is required"}), 400
        
    doc = {
        "token": token,
        "userId": user_id,
        "username": username,
        "platform": data.get("platform", "web"),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        result = fcm_tokens_collection.update_one(
            {"token": token},
            {"$set": doc},
            upsert=True
        )
        total_tokens = fcm_tokens_collection.count_documents({})
    except Exception as e:
        print(f"[FCM] Token storage failed in MongoDB: {e}")
        return jsonify({"error": "MongoDB unavailable while storing FCM token", "details": str(e)}), 503

    print("[FCM] Token stored in MongoDB", {
        "matched_count": result.matched_count,
        "modified_count": result.modified_count,
        "upserted_id": str(result.upserted_id) if result.upserted_id else None,
        "total_tokens": total_tokens,
        "token": mask_token(token),
    })
    return jsonify({
        "success": True,
        "matchedCount": result.matched_count,
        "modifiedCount": result.modified_count,
        "upsertedId": str(result.upserted_id) if result.upserted_id else None,
        "totalTokens": total_tokens,
    })

@app.route("/api/notifications/unregister", methods=["POST"])
def unregister_fcm_token():
    data = request.json or {}
    token = data.get("token")

    print("[FCM] Token unregister API called", {
        "userId": data.get("userId"),
        "token": mask_token(token),
    })
    
    if not token:
        print("[FCM] Token unregister rejected: missing token")
        return jsonify({"error": "Token is required"}), 400
        
    try:
        result = fcm_tokens_collection.delete_one({"token": token})
        total_tokens = fcm_tokens_collection.count_documents({})
    except Exception as e:
        print(f"[FCM] Token removal failed in MongoDB: {e}")
        return jsonify({"error": "MongoDB unavailable while removing FCM token", "details": str(e)}), 503

    print("[FCM] Token removed from MongoDB", {
        "deleted_count": result.deleted_count,
        "total_tokens": total_tokens,
        "token": mask_token(token),
    })
    return jsonify({"success": True, "deletedCount": result.deleted_count, "totalTokens": total_tokens})


@app.route("/api/notifications/debug", methods=["GET"])
def debug_fcm_tokens():
    try:
        docs = load_fcm_tokens()
    except Exception as e:
        return jsonify({
            "firebaseInitialized": firebase_initialized,
            "error": "MongoDB unavailable while loading FCM tokens",
            "details": str(e),
            "count": 0,
            "tokens": [],
        }), 503

    return jsonify({
        "firebaseInitialized": firebase_initialized,
        "count": len(docs),
        "tokens": [
            {
                "userId": doc.get("userId"),
                "username": doc.get("username"),
                "platform": doc.get("platform"),
                "token": mask_token(doc.get("token")),
            }
            for doc in docs
        ],
    })


@app.route("/api/notifications/health", methods=["GET"])
def notification_health():
    return jsonify({
        "firebaseInitialized": firebase_initialized,
        "firebaseAdmin": firebase_admin_metadata,
    })

# --------------------------------------------------
# CONNECT
# --------------------------------------------------
@socketio.on("connect")
def handle_connect():
    print(f"connect: {request.sid}")

# --------------------------------------------------
# CREATE ROOM  (creation only — never joins)
# Emits: room_created | create_room_error
# --------------------------------------------------
@socketio.on("create_room")
def handle_create_room(data):
    data = data or {}
    print(f"\n{'='*55}")
    print(f"create_room: {data}")

    room_name = (data.get("room") or "").strip()
    passcode  = (data.get("passcode") or "").strip()
    sid       = request.sid
    user_id   = data.get("userId")
    username  = data.get("username")

    print(f"  roomName='{room_name}'  passcode='{passcode}'")

    # ── Basic validation ──────────────────────────
    if not room_name:
        emit("create_room_error", {"message": "Room name is required"})
        return
    if not passcode:
        emit("create_room_error", {"message": "Passcode is required"})
        return

    # ── Uniqueness check — BLOCK if already exists ─
    existing = get_room(room_name)
    if existing:
        print(f"   Room '{room_name}' already exists — rejecting creation")
        emit("create_room_error", {"message": "Room name already in use"})
        return

    # ── Insert new room ───────────────────────────
    new_doc, err = db_create_room(room_name, passcode, sid)
    if err:
        print(f"   db_create_room error: {err}")
        emit("create_room_error", {"message": f"Could not create room: {err}"})
        return

    print(f"   Room '{room_name}' created — now joining socket room")

    # ── Join the socket room immediately ──────────
    switch_socket_room(sid, room_name, user_id=user_id, username=username)

    emit("load_messages", [])           # new room — no messages yet
    emit("room_created", {"room": room_name, "isPrivate": True})
    emit_room_users(room_name)
    print(f"{'='*55}\n")


# --------------------------------------------------
# JOIN ROOM  (join only — never creates)
# Emits: room_joined | room_error
# --------------------------------------------------
@socketio.on("join_room")
def handle_join(data):
    data = data or {}
    print(f"\n{'='*55}")
    print(f"join_room: {data}")

    room       = normalize_room_name(data.get("room"))
    passcode   = (data.get("passcode") or "").strip()
    is_private = bool(data.get("isPrivate", False))
    sid        = request.sid
    user_id    = data.get("userId")
    username   = data.get("username")
    room_is_private = False

    print(f"  room='{room}'  passcode='{passcode}'  is_private={is_private}")

    # --------------------------------------------------
    # PRIVATE ROOM — join only, never create
    # --------------------------------------------------
    if is_private:
        existing = get_room(room)
        if not existing:
            # Room does not exist — refuse (creation is a separate flow)
            print(f"   Private room '{room}' not found")
            emit("room_error", {"message": "Room does not exist"})
            return

        # Room exists — verify passcode
        stored = existing.get("passcode", "")
        print(f"  Passcode check: stored='{stored}'  given='{passcode}'  match={stored == passcode}")
        if stored != passcode:
            emit("room_error", {"message": "Invalid room passcode"})
            return
        print("   Passcode correct")
        room_is_private = bool(existing.get("isPrivate", True))

    else:
        # Public join —
        #   "Global" is always allowed (app auto-joins it on load).
        #   Any other name must exist in the DB as a non-private room.
        #   Unknown names are rejected — we never auto-create rooms here.
        if room != "Global":
            existing = get_room(room)
            if not existing:
                print(f"   Public room '{room}' not found in DB — rejecting")
                emit("room_error", {"message": "Room does not exist"})
                return
            if existing.get("isPrivate"):
                emit("room_error", {"message": "That room is private. Use a passcode to join."})
                return
            room_is_private = bool(existing.get("isPrivate", False))

    # --------------------------------------------------
    # SWITCH SOCKET ROOM
    # --------------------------------------------------
    switch_socket_room(sid, room, user_id=user_id, username=username)
    print(f"{sid} joined '{room}'")

    # --------------------------------------------------
    # LOAD LAST 24 h MESSAGES
    # --------------------------------------------------
    messages = load_recent_messages(room)

    emit("load_messages", messages)
    emit("room_joined", {"room": room, "isPrivate": room_is_private})
    emit_room_users(room)
    print(f"{'='*55}\n")

# --------------------------------------------------
# REJOIN ROOM  (session restore after page refresh)
#
# No passcode required — the user was already
# authenticated before the page was reloaded.
# We only verify the room still exists in MongoDB.
# Emits: room_joined | room_error
# --------------------------------------------------
@socketio.on("rejoin_room")
def handle_rejoin(data):
    data = data or {}
    print(f"\n{'='*55}")
    print(f"rejoin_room: {data}")

    room = normalize_room_name(data.get("room"))
    sid  = request.sid
    user_id = data.get("userId")
    username = data.get("username")

    # Global is always allowed
    if room == "Global":
        switch_socket_room(sid, room, user_id=user_id, username=username)
        emit("load_messages", load_recent_messages(room))
        emit("room_joined", {"room": room, "isPrivate": False})
        emit_room_users(room)
        print(f"  → rejoined Global")
        print(f"{'='*55}\n")
        return

    # Verify the room still exists in MongoDB
    existing = get_room(room)
    if not existing:
        print(f"   Room '{room}' no longer exists — falling back to Global")
        emit("room_error", {"message": "Room no longer exists"})
        return

    # Room exists — rejoin the socket room
    switch_socket_room(sid, room, user_id=user_id, username=username)
    print(f"{sid} rejoined '{room}'")

    # Load messages
    messages = load_recent_messages(room)

    emit("load_messages", messages)
    emit("room_joined", {"room": room, "isPrivate": bool(existing.get("isPrivate", False))})
    emit_room_users(room)
    print(f"{'='*55}\n")

# --------------------------------------------------
# CHECK ROOM
# --------------------------------------------------
@socketio.on("check_room")
def handle_check_room(data):
    data = data or {}
    room_name = (data.get("room") or "").strip()
    print(f"check_room: '{room_name}'")
    if not room_name:
        emit("check_room_result", {"exists": False, "isPrivate": False, "room": ""})
        return
    doc    = get_room(room_name)
    result = {
        "exists":    doc is not None,
        "isPrivate": doc.get("isPrivate", False) if doc else False,
        "room":      room_name,
    }
    print(f"  → {result}")
    emit("check_room_result", result)

# --------------------------------------------------
# DISCONNECT
# --------------------------------------------------
@socketio.on("disconnect")
def handle_disconnect():
    sid     = request.sid
    user_id = socket_to_user.get(sid)
    room = socket_to_room.pop(sid, None) or (users.get(user_id, {}).get("room") if user_id else None)
    if user_id:
        users.pop(user_id, None)
        socket_to_user.pop(sid, None)
        invisible_users.discard(user_id)
        print(f"{user_id} disconnected")
    else:
        print(f"{sid} disconnected")
    if room:
        emit_room_users(room)

# --------------------------------------------------
# LOCATION
# --------------------------------------------------
@socketio.on("send_location")
def handle_location(data):
    data = data or {}
    user_id = data.get("id")
    if not user_id:
        return
    sid = request.sid
    room = get_event_room(data, sid=sid, user_id=user_id)
    username = data.get("name", "Unknown")
    socket_room = socket_to_room.get(sid)
    if socket_room != room:
        switch_socket_room(sid, room, user_id=user_id, username=username)
    else:
        socket_to_user[sid] = str(user_id)
        persist_room_membership(user_id, room, username)
    users[user_id] = {
        "id":        user_id,
        "name":      username,
        "lat":       data.get("lat"),
        "lng":       data.get("lng"),
        "heading":   data.get("heading", 0),
        "room":      room,
        "timestamp": time.time(),
    }
    emit_room_users(room)

# --------------------------------------------------
# INVISIBLE MODE
# --------------------------------------------------
@socketio.on("set_invisible")
def handle_set_invisible(data):
    data = data or {}
    user_id   = data.get("userId")
    invisible = data.get("invisible", False)
    if not user_id:
        return
    room = get_event_room(data, sid=request.sid, user_id=user_id)
    if invisible:
        invisible_users.add(user_id)
        print(f"{user_id} went invisible")
    else:
        invisible_users.discard(user_id)
        print(f" {user_id} is now visible")
    emit_room_users(room)
    # Confirm back to the requesting client
    emit("invisible_confirmed", {"invisible": invisible})

# --------------------------------------------------
# CHAT — SEND MESSAGE
# --------------------------------------------------
@socketio.on("send_message")
def handle_message(data):
    data = data or {}
    user      = data.get("user")
    text      = data.get("text", "").strip()
    room      = data.get("room", "Global")
    sender_id = data.get("senderId")
    if not user or not text or not sender_id:
        return
    message = {
        "senderId":  sender_id,
        "user":      user,
        "text":      text,
        "room":      room,
        "timestamp": time.time(),
        "createdAt": datetime.utcnow(),
        "seenBy":    [sender_id],
    }
    result = messages_collection.insert_one(message)
    message.pop("createdAt")
    socketio.emit(
        "receive_message",
        {**message, "_id": str(result.inserted_id)},
        room=room,
        include_self=False,
    )

# --------------------------------------------------
# CHAT — MESSAGE SEEN
# --------------------------------------------------
@socketio.on("message_seen")
def handle_message_seen(data):
    data = data or {}
    mid = data.get("messageId")
    uid = data.get("userId")
    if not mid or not uid:
        return
    messages_collection.update_one(
        {"_id": ObjectId(mid)},
        {"$addToSet": {"seenBy": uid}}
    )
    updated = messages_collection.find_one({"_id": ObjectId(mid)})
    if updated:
        updated["_id"] = str(updated["_id"])
        updated.pop("createdAt", None)
        socketio.emit("message_updated", updated, room=updated["room"])

# --------------------------------------------------
# SOS
# --------------------------------------------------
@socketio.on("sos_alert")
def handle_sos(data):
    data = data or {}
    print("[SOS][Trace] Backend SOS handler received", data)
    sender_id = data.get("id")
    room = get_event_room(data, sid=request.sid, user_id=sender_id)
    payload = {**data, "room": room}

    # 1. Broadcast via Socket.IO to active users
    print("[SOS][Trace] Socket.IO room broadcast: sos_alert", {"room": room})
    socketio.emit("sos_alert", payload, room=room)
    
    # 2. Send FCM push notifications
    try:
        send_sos_fcm("sos_alert", payload, room)
    except Exception as e:
        print(f"[FCM] SOS send error: {e}")

@socketio.on("sos_cancel")
def handle_sos_cancel(data):
    data = data or {}
    print("[SOS][Trace] Backend SOS cancel handler received", data)
    sender_id = data.get("id")
    room = get_event_room(data, sid=request.sid, user_id=sender_id)
    payload = {**data, "room": room}

    # 1. Broadcast via Socket.IO
    print("[SOS][Trace] Socket.IO room broadcast: sos_cancel", {"room": room})
    socketio.emit("sos_cancel", payload, room=room)
    
    # 2. Send FCM cancellation
    try:
        send_sos_fcm("sos_cancel", payload, room)
    except Exception as e:
        print(f"[FCM] SOS cancel send error: {e}")

# --------------------------------------------------
# RUN
# --------------------------------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
