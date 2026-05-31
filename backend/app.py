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
client    = MongoClient(MONGO_URI)
db        = client["orbit"]

messages_collection = db["messages"]
rooms_collection    = db["rooms"]

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
firebase_cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
firebase_initialized = False
if firebase_cred_json:
    try:
        cred_dict = json.loads(firebase_cred_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        print("Firebase Admin SDK initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize Firebase Admin SDK: {e}")
else:
    print("Warning: FIREBASE_SERVICE_ACCOUNT env var not found. FCM push notifications disabled.")

fcm_tokens_collection = db["fcm_tokens"]
try:
    fcm_tokens_collection.create_index("token", unique=True, background=True)
except Exception as e:
    print(f"fcm_tokens index: {e}")

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
    
    if not token:
        return jsonify({"error": "Token is required"}), 400
        
    doc = {
        "token": token,
        "userId": user_id,
        "username": data.get("username", "Unknown"),
        "platform": data.get("platform", "web"),
        "updatedAt": datetime.utcnow()
    }
    
    fcm_tokens_collection.update_one(
        {"token": token},
        {"$set": doc},
        upsert=True
    )
    return jsonify({"success": True})

@app.route("/api/notifications/unregister", methods=["POST"])
def unregister_fcm_token():
    data = request.json or {}
    token = data.get("token")
    
    if not token:
        return jsonify({"error": "Token is required"}), 400
        
    fcm_tokens_collection.delete_one({"token": token})
    return jsonify({"success": True})

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
    print(f"\n{'='*55}")
    print(f"create_room: {data}")

    room_name = (data.get("room") or "").strip()
    passcode  = (data.get("passcode") or "").strip()
    sid       = request.sid

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
    old = socket_to_room.get(sid)
    if old:
        leave_room(old)
    join_room(room_name)
    socket_to_room[sid] = room_name

    emit("load_messages", [])           # new room — no messages yet
    emit("room_created", {"room": room_name, "isPrivate": True})
    print(f"{'='*55}\n")


# --------------------------------------------------
# JOIN ROOM  (join only — never creates)
# Emits: room_joined | room_error
# --------------------------------------------------
@socketio.on("join_room")
def handle_join(data):
    print(f"\n{'='*55}")
    print(f"join_room: {data}")

    room       = (data.get("room") or "Global").strip()
    passcode   = (data.get("passcode") or "").strip()
    is_private = bool(data.get("isPrivate", False))
    sid        = request.sid
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
    old = socket_to_room.get(sid)
    if old:
        leave_room(old)
    join_room(room)
    socket_to_room[sid] = room
    print(f"{sid} joined '{room}'")

    # --------------------------------------------------
    # LOAD LAST 24 h MESSAGES
    # --------------------------------------------------
    messages = load_recent_messages(room)

    emit("load_messages", messages)
    emit("room_joined", {"room": room, "isPrivate": room_is_private})
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
    print(f"\n{'='*55}")
    print(f"rejoin_room: {data}")

    room = (data.get("room") or "Global").strip()
    sid  = request.sid

    # Global is always allowed
    if room == "Global":
        old = socket_to_room.get(sid)
        if old:
            leave_room(old)
        join_room(room)
        socket_to_room[sid] = room
        emit("load_messages", load_recent_messages(room))
        emit("room_joined", {"room": room, "isPrivate": False})
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
    old = socket_to_room.get(sid)
    if old:
        leave_room(old)
    join_room(room)
    socket_to_room[sid] = room
    print(f"{sid} rejoined '{room}'")

    # Load messages
    messages = load_recent_messages(room)

    emit("load_messages", messages)
    emit("room_joined", {"room": room, "isPrivate": bool(existing.get("isPrivate", False))})
    print(f"{'='*55}\n")

# --------------------------------------------------
# CHECK ROOM
# --------------------------------------------------
@socketio.on("check_room")
def handle_check_room(data):
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
    socket_to_room.pop(sid, None)
    if user_id:
        users.pop(user_id, None)
        socket_to_user.pop(sid, None)
        invisible_users.discard(user_id)
        print(f"{user_id} disconnected")
    else:
        print(f"{sid} disconnected")
    visible = [u for u in users.values() if u["id"] not in invisible_users]
    socketio.emit("update_users", visible)

# --------------------------------------------------
# LOCATION
# --------------------------------------------------
@socketio.on("send_location")
def handle_location(data):
    user_id = data.get("id")
    if not user_id:
        return
    sid = request.sid
    users[user_id] = {
        "id":        user_id,
        "name":      data.get("name", "Unknown"),
        "lat":       data.get("lat"),
        "lng":       data.get("lng"),
        "heading":   data.get("heading", 0),
        "timestamp": time.time(),
    }
    socket_to_user[sid] = user_id
    visible = [u for u in users.values() if u["id"] not in invisible_users]
    socketio.emit("update_users", visible)

# --------------------------------------------------
# INVISIBLE MODE
# --------------------------------------------------
@socketio.on("set_invisible")
def handle_set_invisible(data):
    user_id   = data.get("userId")
    invisible = data.get("invisible", False)
    if not user_id:
        return
    if invisible:
        invisible_users.add(user_id)
        print(f"{user_id} went invisible")
    else:
        invisible_users.discard(user_id)
        print(f" {user_id} is now visible")
    # Broadcast the updated (filtered) user list to everyone
    visible = [u for u in users.values() if u["id"] not in invisible_users]
    socketio.emit("update_users", visible)
    # Confirm back to the requesting client
    emit("invisible_confirmed", {"invisible": invisible})

# --------------------------------------------------
# CHAT — SEND MESSAGE
# --------------------------------------------------
@socketio.on("send_message")
def handle_message(data):
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
    # 1. Broadcast via Socket.IO to active users
    socketio.emit("sos_alert", data)
    
    # 2. Send FCM push notifications
    if firebase_initialized:
        try:
            tokens = list(fcm_tokens_collection.find({}, {"_id": 0, "token": 1}))
            token_list = [t["token"] for t in tokens if "token" in t]
            
            sender_name = data.get("name", "Someone")
            
            if token_list:
                message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title="EMERGENCY SOS",
                        body=f"{sender_name} has triggered an SOS alert!",
                    ),
                    data={
                        "type": "sos_alert",
                        "senderId": str(data.get("id", "")),
                        "senderName": sender_name,
                    },
                    tokens=token_list,
                )
                response = messaging.send_multicast(message)
                print(f"FCM SOS Alert sent: {response.success_count} success, {response.failure_count} failure")
        except Exception as e:
            print(f"FCM SOS Error: {e}")

@socketio.on("sos_cancel")
def handle_sos_cancel(data):
    # 1. Broadcast via Socket.IO
    socketio.emit("sos_cancel", data)
    
    # 2. Send FCM cancellation
    if firebase_initialized:
        try:
            tokens = list(fcm_tokens_collection.find({}, {"_id": 0, "token": 1}))
            token_list = [t["token"] for t in tokens if "token" in t]
            
            sender_name = data.get("name", "Someone")
            
            if token_list:
                message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title="SOS Cancelled",
                        body=f"{sender_name} has cancelled the SOS alert.",
                    ),
                    data={
                        "type": "sos_cancel",
                        "senderId": str(data.get("id", "")),
                    },
                    tokens=token_list,
                )
                response = messaging.send_multicast(message)
                print(f"FCM SOS Cancel sent: {response.success_count} success, {response.failure_count} failure")
        except Exception as e:
            print(f"FCM SOS Cancel Error: {e}")

# --------------------------------------------------
# RUN
# --------------------------------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
