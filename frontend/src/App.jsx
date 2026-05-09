import { useEffect, useState, useRef, useCallback } from "react";
import MapView from "./components/MapView";
import Login from "./components/Login";
import ProfileModal from "./components/ProfileModal";
import OrbitEasterEgg from "./components/OrbitEasterEgg";
import CreateRoomModal from "./components/CreateRoomModal";
import JoinRoomModal from "./components/JoinRoomModal";
import socket from "./components/SocketManager";
import "./App.css";

// 🛠️ Helpers for persistent identity
const getPersistentUser = () => {
  const savedName = localStorage.getItem("username");
  let savedId = localStorage.getItem("userId");
  let savedSeed = localStorage.getItem("avatarSeed");
  
  if (!savedId) {
    savedId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userId", savedId);
  }

  if (!savedSeed && savedName) {
    savedSeed = savedName;
    localStorage.setItem("avatarSeed", savedSeed);
  }
  
  return { username: savedName, userId: savedId, avatarSeed: savedSeed || savedName };
};

function App() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
    
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [isFollowing, setIsFollowing] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'users', or null
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [is3DView, setIs3DView] = useState(false);
  const [isInvisible, setIsInvisible] = useState(() => localStorage.getItem("invisibleMode") === "true");

  // 🔑 Join-room passcode modal state
  const [joinModal, setJoinModal] = useState(null);  // null | { roomName, loading, error }
  const joinModalRef  = useRef(null); // keep latest modal state for socket callbacks
  const pendingJoinRef = useRef(null); // { isPrivate: bool } — tracks the in-flight join_room emit
  
  // 💬 Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState(localStorage.getItem("roomId") || "Global");
  const [isRoomPrivate, setIsRoomPrivate] = useState(localStorage.getItem("isRoomPrivate") === "true");
  const [roomInput, setRoomInput] = useState("");
  const chatEndRef = useRef(null);
  
  // 🔑 Auth State
  const [user, setUser] = useState(getPersistentUser());
  const mapRef = useRef(null);

  // 💾 Persist theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 🔌 Socket Listeners
  useEffect(() => {
    // Initial join / rejoin if logged in
    if (user.username) {
      // Use rejoin_room — backend verifies room still exists, no passcode needed
      socket.emit("rejoin_room", { room: currentRoom });
    }

    socket.on("update_users", (data) => {
      const unique = {};
      data.forEach((u) => {
        unique[u.id] = u;
      });
      setUsers(Object.values(unique));
    });

    // 👻 INVISIBLE MODE CONFIRMED
    socket.on("invisible_confirmed", ({ invisible }) => {
      setIsInvisible(invisible);
      localStorage.setItem("invisibleMode", String(invisible));
    });

    socket.on("sos_alert", (data) => {
      console.log("🚨 ALERT RECEIVED:", data);
      setSosAlerts(prev => [...prev.filter(alert => String(alert.id) !== String(data.id)), data]);
      
      // Show clickable toast for other users' SOS
      if (String(data.id) !== String(user.userId)) {
        showToast({
          message: `${data.name} needs help!`,
          type: "sos",
          userId: data.id,
          lat: data.lat,
          lng: data.lng
        });
      }
    });

    socket.on("sos_cancel", (data) => {
      console.log("🔥 CANCEL RECEIVED:", data);
      setSosAlerts(prev => prev.filter(alert => String(alert.id) !== String(data.id)));
    });

    // 💬 LOAD OLD MESSAGES
    socket.on("load_messages", (messages) => {
      console.log("📜 LOADED MESSAGES:", messages);
      setChatMessages(messages);
    });

    // 💬 RECEIVE NEW MESSAGE
    socket.on("receive_message", (msg) => {
      console.log("🔥 RECEIVED:", msg);
      setChatMessages((prev) => [...prev, msg]);
    });

    // 💬 MESSAGE UPDATED (SEEN STATUS)
    socket.on("message_updated", (updatedMsg) => {
      setChatMessages((prev) => 
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    });

    // 🔒 ROOM ERROR (wrong passcode, private collision, etc.)
    socket.on("room_error", ({ message }) => {
      console.warn("🔒 ROOM ERROR:", message);

      // If the passcode modal is open, surface the error inside it
      if (joinModalRef.current) {
        setJoinModal(prev => prev ? { ...prev, loading: false, error: message } : null);
        return;
      }

      // Otherwise roll back to Global (e.g. create-room failure, deleted room)
      const rolledBack = "Global";
      setCurrentRoom(rolledBack);
      localStorage.setItem("roomId", rolledBack);
      setIsRoomPrivate(false);
      localStorage.setItem("isRoomPrivate", "false");
      setChatMessages([]);
      socket.emit("join_room", { room: rolledBack });
      showToast({ message, type: "error" });
    });

    // ✅ ROOM JOINED CONFIRMATION (join flow only)
    socket.on("room_joined", ({ room }) => {
      console.log("✅ Joined room:", room);

      const wasPrivate = pendingJoinRef.current?.isPrivate ?? false;
      pendingJoinRef.current = null;

      setCurrentRoom(room);
      localStorage.setItem("roomId", room);
      setChatMessages([]);
      setIsRoomPrivate(wasPrivate);
      localStorage.setItem("isRoomPrivate", String(wasPrivate));

      if (joinModalRef.current) {
        setJoinModal(null);
      }

      showToast({ message: `Joined room: ${room}`, type: "room" });
    });

    // 🔒 ROOM CREATED CONFIRMATION (create flow only)
    socket.on("room_created", ({ room }) => {
      console.log("🔒 Room created:", room);
      setCurrentRoom(room);
      localStorage.setItem("roomId", room);
      setChatMessages([]);
      setIsRoomPrivate(true);
      localStorage.setItem("isRoomPrivate", "true");
      showToast({ message: `Room “${room}” created!`, type: "room" });
    });

    // ❌ CREATE ROOM ERROR
    socket.on("create_room_error", ({ message }) => {
      console.warn("❌ create_room_error:", message);
      // Don't touch room state — just show the error
      showToast({ message, type: "error" });
    });

    // 🔍 CHECK ROOM RESULT  → decide whether to show passcode modal or error
    socket.on("check_room_result", ({ room, exists, isPrivate }) => {
      console.log("🔍 check_room_result:", { room, exists, isPrivate });

      if (!exists) {
        // Room is not in the database — reject, never join
        console.warn(`❌ Room '${room}' does not exist in DB — blocking join`);
        showToast({ message: "Room does not exist", type: "error" });
        return;
      }

      if (isPrivate) {
        // Private room — open passcode modal
        setJoinModal({ roomName: room, loading: false, error: null });
        return;
      }

      // Public room that exists in DB — join directly
      doJoinPublic(room);
    });

    return () => {
      socket.off("update_users");
      socket.off("load_messages");
      socket.off("receive_message");
      socket.off("message_updated");
      socket.off("sos_alert");
      socket.off("sos_cancel");
      socket.off("room_error");
      socket.off("room_joined");
      socket.off("room_created");
      socket.off("create_room_error");
      socket.off("check_room_result");
      socket.off("invisible_confirmed");
    };

  }, [user.username]);

  // Keep ref in sync so socket callbacks can read latest modal state
  useEffect(() => {
    joinModalRef.current = joinModal;
  }, [joinModal]);

  // 📜 Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 🔥 MESSAGE TTL CLEANUP (Frontend)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now() / 1000;
      setChatMessages((prev) => 
        prev.filter((msg) => now - msg.timestamp < 86400)
      );
    }, 60000); // Check every 60 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // 📍 Send live location
  useEffect(() => {
    if (!user.username) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
        };
        setUserLocation(coords);

        socket.emit("send_location", {
          id: user.userId,
          name: user.username,
          avatarSeed: user.avatarSeed,
          ...coords,
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setUserLocation((prev) => prev || { lat: 12.9716, lng: 77.5946, heading: null });
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.username, user.userId, user.avatarSeed]);

  // 👻 Restore invisible state on reconnect
  useEffect(() => {
    const handleReconnect = () => {
      const savedInvisible = localStorage.getItem("invisibleMode") === "true";
      if (savedInvisible && user.userId) {
        socket.emit("set_invisible", { userId: user.userId, invisible: true });
      }
    };
    socket.on("connect", handleReconnect);
    return () => socket.off("connect", handleReconnect);
  }, [user.userId]);

  // 👻 Sync invisible state on initial load
  useEffect(() => {
    if (user.username && isInvisible && user.userId) {
      socket.emit("set_invisible", { userId: user.userId, invisible: true });
    }
  }, [user.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔑 Handle Login
  const handleLogin = (username, roomId) => {
    const trimmed = username.trim();
    if (!trimmed) return;

    const finalRoom = roomId?.trim() || "Global";
    localStorage.setItem("username", trimmed);
    localStorage.setItem("roomId", finalRoom);
    setCurrentRoom(finalRoom);
    
    // Set initial avatar seed as username if not exists
    let seed = localStorage.getItem("avatarSeed");
    if (!seed) {
      seed = trimmed;
      localStorage.setItem("avatarSeed", seed);
    }

showToast({
  message: `Welcome, ${trimmed}!`,
  type: "welcome"
});


setUser((prev) => ({ ...prev, username: trimmed, avatarSeed: seed }));
  socket.emit("join_room", { room: finalRoom });
};

  // 🚪 Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("avatarSeed");
    localStorage.removeItem("roomId");
    localStorage.removeItem("isRoomPrivate");
    localStorage.removeItem("invisibleMode");
    window.location.reload();
  };

  // 🎨 Update Avatar
  const changeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    localStorage.setItem("avatarSeed", newSeed);
    setUser(prev => ({ ...prev, avatarSeed: newSeed }));
  };

  // 📝 Update Username
  const updateUsername = (newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === user.username) return;

    localStorage.setItem("username", trimmed);
    setUser(prev => ({ ...prev, username: trimmed }));

    // Force instant socket sync
    if (userLocation) {
      socket.emit("send_location", {
        id: user.userId,
        name: trimmed,
        avatarSeed: user.avatarSeed,
        ...userLocation
      });
    }

showToast({
  message: "Name updated!",
  type: "success"
});
};

  // 👻 Handle Invisible Mode Toggle
  const handleToggleInvisible = (newValue) => {
    setIsInvisible(newValue);
    localStorage.setItem("invisibleMode", String(newValue));
    socket.emit("set_invisible", { userId: user.userId, invisible: newValue });
    showToast({
      message: newValue ? "You are now invisible" : "You are now visible",
      type: newValue ? "cancel" : "success"
    });
  };
  // Directly join a public room (no passcode required)
  const doJoinPublic = useCallback((room) => {
    pendingJoinRef.current = { isPrivate: false };
    localStorage.setItem("roomId", room);
    socket.emit("join_room", { room });
    setRoomInput("");
  }, []);

  // JOIN button handler — asks backend for room type first
  const handleSwitchRoom = () => {
    const room = roomInput.trim();
    if (!room || room === currentRoom) return;
    setRoomInput("");
    // Ask backend whether this room exists and whether it's private
    socket.emit("check_room", { room });
  };

  // Called by JoinRoomModal when the user submits a passcode
  const handlePasscodeJoin = (passcode) => {
    if (!joinModal) return;
    const { roomName } = joinModal;
    setJoinModal(prev => ({ ...prev, loading: true, error: null }));
    pendingJoinRef.current = { isPrivate: true };
    socket.emit("join_room", { room: roomName, isPrivate: true, passcode });
  };

  const handlePasscodeCancel = () => {
    setJoinModal(null);
  };

  const handleCreateRoom = (roomData) => {
    setShowCreateRoomModal(false);
    // Emit to the dedicated CREATE event — never join_room
    // Backend will reject with create_room_error if room already exists
    socket.emit("create_room", {
      room:     roomData.name,
      passcode: roomData.passcode,
    });
  };

  // 💬 Handle Send Message
  const sendMessage = (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text) return;

    // 🔥 EASTER EGG TRIGGER
    if (text === "/orbit") {
      setShowEasterEgg(true);
      setMsgInput("");
      return;
    }

    const msgData = {
      senderId: user.userId,
      user: user.username,
      text: text,
      timestamp: Date.now() / 1000,
      avatarSeed: user.avatarSeed,
      room: currentRoom,
      seenBy: [user.userId],
    };

    socket.emit("send_message", msgData);
    setChatMessages((prev) => [...prev, msgData]);
    setMsgInput("");
  };

  // 💬 Handle Mark as Seen
  const markAsSeen = (messageId) => {
    if (!messageId) return;
    socket.emit("message_seen", { messageId, userId: user.userId });
  };

  // 💬 Seen Logic Effect (Real-time)
  useEffect(() => {
    if (activePanel !== "chat") return;

    const unseenMessages = chatMessages.filter(
      (msg) =>
        msg._id &&
        msg.senderId !== user.userId &&
        !(msg.seenBy || []).includes(user.userId)
    );

    unseenMessages.forEach((msg) => {
      socket.emit("message_seen", {
        messageId: msg._id,
        userId: user.userId,
      });
    });
  }, [chatMessages, activePanel, user.userId]);

  const unreadCount = chatMessages.filter(
    (msg) =>
      msg.senderId !== user.userId &&
      !(msg.seenBy || []).includes(user.userId)
  ).length;

  const handleSOS = () => {
    if (!userLocation || !user.username) return;
    
    if (isSOSActive) {
      // 🔴 TELL SERVER YOU CANCELLED
      socket.emit("sos_cancel", { id: user.userId });

      // 🔴 REMOVE LOCALLY
      setSosAlerts(prev => prev.filter(alert => alert.id !== user.userId));

      setIsSOSActive(false);
      showToast("SOS cancelled", "cancel");
    } else {
      const data = {
        id: user.userId,
        name: user.username,
        avatarSeed: user.avatarSeed,
        ...userLocation,
      };

      socket.emit("sos_alert", data);
      setIsSOSActive(true);
      showToast({
        message: `${user.username} needs help`,
        type: "sos",
        userId: user.userId,
        lat: userLocation.lat,
        lng: userLocation.lng
      });
    }
  };

  const showToast = (input, type = "default") => {
    if (typeof input === "object") {
      setToast(input);
    } else {
      setToast({ message: input, type });
    }
    
    // Auto-clear toast
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // 🛸 If no username, show Login Page
  if (!user.username) {
    return <Login onLogin={handleLogin} />;
  }

  // 🛰️ Handle Auto-disable Follow Me
  const handleAutoDisableFollowing = () => {
    if (isFollowing) {
      setIsFollowing(false);
    }
  };

  // 📏 Haversine distance formula
  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const handleRecenter = () => {
  if (userLocation) {
    mapRef.current?.handleRecenter();
  } else {
    showToast({
  message: "Waiting for location...",
  type: "location"
});
  }
};

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }} className={`${theme}-mode`}>
      <MapView 
        ref={mapRef} 
        users={users} 
        userLocation={userLocation} 
        theme={theme} 
        isFollowing={isFollowing} 
        setIsFollowing={setIsFollowing}
        onAutoDisableFollowing={handleAutoDisableFollowing}
        currentUserId={user.userId}
        sosAlerts={sosAlerts}
        is3DView={is3DView}
        setIs3DView={setIs3DView}
      />

      {/* 💬 CHAT PANEL (Mica Dark) */}
      <div className={`chat-panel ${activePanel === "chat" ? "open" : "closed"}`}>
        <div className="chat-header">
          <div className="online-dot"></div>
          <div className="header-text-container">
            <span>ORBIT CHAT - </span>
            <span className="active-room-name">{currentRoom.toUpperCase()}</span>
            {isRoomPrivate && (
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="header-lock-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            )}
          </div>
        </div>

        <div className="room-controls">
          <div className="join-row">
            <input 
              type="text" 
              className="room-input" 
              placeholder="Enter Room ID..." 
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSwitchRoom()}
            />
            <button className="join-btn" onClick={handleSwitchRoom}>JOIN</button>
          </div>
          <button className="create-room-trigger" onClick={() => setShowCreateRoomModal(true)}>
            + Create Private Room
          </button>
        </div>
        
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet.</p>
              <p style={{ opacity: 0.6 }}>Say hello!</p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.senderId === user.userId ? "mine" : "other"}`}>
                <div className="chat-bubble">
                  {msg.senderId !== user.userId && (
                    <span className="msg-user">{msg.user}</span>
                  )}
                  <span className="msg-text">{msg.text}</span>
                  <div className="msg-meta">
                    <span className="msg-time">
                      {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.senderId === user.userId && (
                      <span className="seen-status">
                        {(msg.seenBy || []).length > 1 ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input-container" onSubmit={sendMessage}>
          <div className="message-input-wrapper">
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
            />
            <button type="submit" className="send-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </div>


      {/* ⬅️ CHAT TOGGLE BUTTON */}
      <button 
        className={`chat-toggle ${activePanel === "chat" ? "open" : "closed"}`}
        onClick={() => {
          setActivePanel(prev => {
            const next = prev === "chat" ? null : "chat";
            if (next === "chat" && window.innerWidth <= 768) {
              setFabOpen(false);
            }
            return next;
          });
        }}
        title={activePanel === "chat" ? "Collapse Chat" : "Expand Chat"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {activePanel === "chat" ? (
            <polyline points="15 18 9 12 15 6"></polyline>
          ) : (
            <polyline points="9 18 15 12 9 6"></polyline>
          )}
        </svg>
        {activePanel !== "chat" && unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>

      {/* 👥 ACTIVE USERS INDICATOR */}
      {(() => {
        const visibleUsers = isInvisible ? users.filter(u => u.id !== user.userId) : users;
        return (
          <div 
            className="users-indicator" 
            onClick={() => setActivePanel(prev => (prev === "users" ? null : "users"))}
          >
            <div className="online-dot"></div>
            <span>Active Users: {visibleUsers.length}</span>
          </div>
        );
      })()}

      {/* 👥 USERS PANEL */}
      {activePanel === "users" && (() => {
        const visibleUsers = isInvisible ? users.filter(u => u.id !== user.userId) : users;
        return (
        <div className="users-panel">
          <h3>Nearby Users</h3>
          <div className="user-list">
            {visibleUsers.length > 0 ? (
              [...visibleUsers]
                .sort((a, b) => (a.id === user.userId ? -1 : b.id === user.userId ? 1 : 0))
                .map((u, i) => {
                  let distance = "Calculating...";

                  if (userLocation && u.lat && u.lng) {
                    const d = getDistanceKm(
                      userLocation.lat,
                      userLocation.lng,
                      u.lat,
                      u.lng
                    );
                    distance = `${d.toFixed(2)} km`;
                  }

                  return (
                    <div key={u.id}>
                      <div 
                        className={`user-item ${u.id === user.userId ? "current" : ""}`}
                        onClick={() => {
                          mapRef.current?.handleCenterOnUser(u.lng, u.lat);
                          setIsFollowing(false);
                          showToast(`Tracking ${u.name}`, "tracking");
                        }}
                      >
                        <div className="user-info">
                          <span className="user-name">
                            {u.name} {u.id === user.userId ? <span className="you-label"></span> : ""}
                          </span>
                          <span className="user-status">
                            Online now {distance && u.id !== user.userId && <span className="distance" style={{ opacity: 0.7 }}> • {distance}</span>}
                          </span>
                        </div>
                      </div>
                      {u.id === user.userId && visibleUsers.length > 1 && (
                        <div className="user-divider"></div>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="no-users">No users nearby</div>
            )}
          </div>
        </div>
        );
      })()}

      {/* 📱 MOBILE FAB */}
      <div className={`fab-container ${fabOpen ? "open" : ""}`}>
        <div className="fab-actions">
          <button 
            className="control-btn" 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <button 
            className="control-btn recenter-btn" 
            onClick={handleRecenter}
            title="Toggle camera mode"
          >
            {is3DView ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10l9-5 9 5-9 5-9-5z" />
                <path d="M3 14l9 5 9-5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/>
                <path d="M9 4v14M15 6v14"/>
              </svg>
            )}
          </button>

          <button 
            className={`control-btn ${isFollowing ? "active" : ""}`} 
            onClick={() => {
              setIsFollowing(!isFollowing);
              showToast(
                isFollowing ? "Follow Me OFF" : "Follow Me ON",
                "follow"
              );
            }}
            title={isFollowing ? "Disable Follow Me" : "Enable Follow Me"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </button>
        </div>

        <button className="fab-main" onClick={() => {
          setFabOpen(prev => {
            const next = !prev;
            if (next && window.innerWidth <= 768) {
              setActivePanel(current => current === "chat" ? null : current);
            }
            return next;
          });
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>

      {/* 🛠️ CONTROL CLUSTER */}
      <div className="control-cluster">
        <button className="profile-btn" onClick={() => setShowProfile(true)}>
          <div className="avatar">
            <img 
              src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user.avatarSeed)}`} 
              alt="My Avatar" 
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
            />
          </div>
        </button>

        <button 
          className={`control-btn ${isFollowing ? "active" : ""}`} 
          onClick={() => {
            setIsFollowing(!isFollowing);
            showToast(
              isFollowing ? "Follow Me OFF" : "Follow Me ON",
              "follow"
            );
          }}
          title={isFollowing ? "Disable Follow Me" : "Enable Follow Me"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </button>

        <button 
          className="control-btn recenter-btn" 
          onClick={handleRecenter}
          title="Toggle camera mode"
        >
          {is3DView ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10l9-5 9 5-9 5-9-5z" />
              <path d="M3 14l9 5 9-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/>
  <path d="M9 4v14M15 6v14"/>
</svg>
          )}
        </button>

        <button 
          className="control-btn" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>

      <button
        className={`sos-btn ${isSOSActive ? "active" : ""}`}
        onClick={handleSOS}
      >
        {/* 👇 Show icon ONLY when NOT active */}
        {!isSOSActive && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 20, height: 20 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}

        <span>{isSOSActive ? "CANCEL" : "SOS"}</span>
      </button>

      {toast && (
        <div 
          className={`toast ${toast.type}`}
          onClick={() => {
            if (toast.type === "sos" && toast.userId !== user.userId) {
              mapRef.current?.handleCenterOnUser(toast.lng, toast.lat);
              setIsFollowing(false);
              showToast({ message: "Tracking user...", type: "tracking" });
            }
          }}
          style={{ 
            cursor: toast.type === "sos" && toast.userId !== user.userId ? "pointer" : "default" 
          }}
        >
          {/* ICON */}
          {toast.type === "tracking" && (
            <svg className="icon radar-sweep" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.3"/>
              <path className="sweep" d="M12 3 A9 9 0 0 1 21 12" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" fill="white"/>
            </svg>
          )}

          {toast.type === "follow" && (    
            <svg className="icon follow-fly" viewBox="0 0 24 24" fill="none">
              <path d="M3 11L22 2L13 21L11 13L3 11Z"
                stroke="white" strokeWidth="2"/>
            </svg>
          )}


{toast.type === "success" && (
  <svg className="icon check-icon" viewBox="0 0 24 24" fill="none">
    <circle
      className="ring"
      cx="12"
      cy="12"
      r="10"
      stroke="white"
      strokeWidth="2"
    />
    <path
      d="M7 13l3 3 7-7"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)}


{toast.type === "room" && (
  <svg className="icon room-icon" viewBox="0 0 24 24" fill="none">
    <circle
      className="portal-ring"
      cx="12"
      cy="12"
      r="9"
      stroke="white"
      strokeWidth="2"
    />
    <path
      className="portal-arrow"
      d="M10 8l4 4-4 4"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)}


          {toast.type === "sos" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}

          {toast.type === "cancel" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}

          {toast.type === "location" && (
  <svg className="icon" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z"
      stroke="white"
      strokeWidth="2"
    />
    <circle cx="12" cy="11" r="2" fill="white" />
  </svg>
)}

          <span className="text">{toast.message}</span>

          {toast.type === "sos" && toast.userId !== user.userId && (
            <button 
              className="view-btn"
              onClick={(e) => {
                e.stopPropagation();
                mapRef.current?.handleCenterOnUser(toast.lng, toast.lat);
                setIsFollowing(false);
                showToast({ message: "Tracking user...", type: "tracking" });
              }}
            >
              VIEW
            </button>
          )}
        </div>
      )}

        




      {showProfile && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfile(false)} 
          onChangeAvatar={changeAvatar}
          onUpdateUsername={updateUsername}
          onLogout={handleLogout}
          isInvisible={isInvisible}
          onToggleInvisible={handleToggleInvisible}
        />
      )}

      {showCreateRoomModal && (
        <CreateRoomModal 
          onClose={() => setShowCreateRoomModal(false)} 
          onCreate={handleCreateRoom}
        />
      )}

      {joinModal && (
        <JoinRoomModal
          roomName={joinModal.roomName}
          onJoin={handlePasscodeJoin}
          onCancel={handlePasscodeCancel}
          error={joinModal.error}
          loading={joinModal.loading}
        />
      )}

      {showEasterEgg && (
        <OrbitEasterEgg onComplete={() => setShowEasterEgg(false)} />
      )}
    </div>
  );
}

export default App;
