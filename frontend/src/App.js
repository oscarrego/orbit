import { useEffect, useState, useRef, useCallback } from "react";
import MapView from "./components/MapView";
import Login from "./components/Login";
import ProfileModal from "./components/ProfileModal";
import OrbitEasterEgg from "./components/OrbitEasterEgg";
import CreateRoomModal from "./components/CreateRoomModal";
import JoinRoomModal from "./components/JoinRoomModal";
import socket from "./components/SocketManager";
import useNotifications from "./hooks/useNotifications";
import "./App.css";
import "./styles/orbit-ui.css";
import "./styles/dark-theme.css";
import "./styles/light-theme.css";
import "./styles/mobile.css";
import { Check, CheckCheck } from "lucide-react";

// Helpers for persistent identity
const getPersistentUser = () => {
  const storedName = localStorage.getItem("username");
  const savedName = storedName && /^[A-Za-z]{5}$/.test(storedName.trim())
    ? storedName.trim().toUpperCase()
    : null;
  let savedId = localStorage.getItem("userId");
  let savedSeed = localStorage.getItem("avatarSeed");

  if (storedName && !savedName) {
    localStorage.removeItem("username");
  } else if (savedName && storedName !== savedName) {
    localStorage.setItem("username", savedName);
  }

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

const getIsMobileViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px)").matches;

const getStoredChatPosition = () =>
  typeof window !== "undefined" && localStorage.getItem("chatPosition") === "right"
    ? "right"
    : "left";

const CAMERA_MODES = {
  TOP: "top",
  CINEMATIC: "cinematic",
  IMMERSIVE: "immersive",
};

const DEFAULT_THEME_ID = "dark";
const isValidIdentity = (value) => /^[A-Za-z]{5}$/.test(value.trim());

// Premium 2D / 3D toggle icons
const CameraModeIcon = ({ mode }) => {
  if (mode === CAMERA_MODES.TOP) {
    return (
      <svg className="perspective-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 6.5 12 3l8.5 3.5v11L12 21l-8.5-3.5z" />
        <path d="M12 3v18M3.5 10.2 12 13.6l8.5-3.4M3.5 14 12 17.4l8.5-3.4" opacity="0.54" />
        <circle cx="12" cy="10" r="1.45" className="perspective-pulse" />
      </svg>
    );
  }
  if (mode === CAMERA_MODES.CINEMATIC) {
    return (
      <svg className="perspective-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 15.8h18M5 14l3.4-3.6 2.3 2.1 3.2-4.8 5.1 6.3" />
        <path d="M4 18.8h16M7 5.4h10" opacity="0.5" />
        <circle cx="12" cy="15.8" r="1.25" className="perspective-pulse" />
      </svg>
    );
  }
  return (
    <svg className="perspective-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3.5H4.5V8M16 3.5h3.5V8M8 20.5H4.5V16M16 20.5h3.5V16" />
      <path d="M8.4 12h7.2M12 8.4v7.2" opacity="0.76" />
      <circle cx="12" cy="12" r="2.8" className="perspective-pulse" />
    </svg>
  );
};

const CAMERA_MODE_LABELS = {
  [CAMERA_MODES.TOP]: "Top View",
  [CAMERA_MODES.CINEMATIC]: "Front View",
  [CAMERA_MODES.IMMERSIVE]: "Close View",
};

const nextModeLabel = (mode) => {
  if (mode === CAMERA_MODES.TOP) return CAMERA_MODE_LABELS[CAMERA_MODES.CINEMATIC];
  if (mode === CAMERA_MODES.CINEMATIC) return CAMERA_MODE_LABELS[CAMERA_MODES.IMMERSIVE];
  return CAMERA_MODE_LABELS[CAMERA_MODES.TOP];
};

const normalizeHeading = (value) => ((value % 360) + 360) % 360;

const useDeviceHeading = () => {
  const [deviceHeading, setDeviceHeading] = useState(null);
  const listening = useRef(false);
  const frame = useRef(null);
  const smoothedHeading = useRef(null);

  const handleOrientation = useCallback((event) => {
    const rawHeading =
      typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : event.absolute && typeof event.alpha === "number"
          ? 360 - event.alpha
          : null;
    if (rawHeading === null || Number.isNaN(rawHeading)) return;
    const target = normalizeHeading(rawHeading);
    if (smoothedHeading.current === null) {
      smoothedHeading.current = target;
    } else {
      const delta = ((target - smoothedHeading.current + 540) % 360) - 180;
      smoothedHeading.current = normalizeHeading(smoothedHeading.current + delta * 0.2);
    }
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      setDeviceHeading(smoothedHeading.current);
      frame.current = null;
    });
  }, []);

  const attachHeadingListener = useCallback(() => {
    if (listening.current || typeof window.DeviceOrientationEvent === "undefined") return;
    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);
    listening.current = true;
  }, [handleOrientation]);

  const requestDeviceHeading = useCallback(async () => {
    if (typeof window.DeviceOrientationEvent === "undefined") return;
    if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
      try {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== "granted") return;
      } catch (error) {
        return;
      }
    }
    attachHeadingListener();
  }, [attachHeadingListener]);

  useEffect(() => {
    if (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof window.DeviceOrientationEvent.requestPermission !== "function"
    ) {
      attachHeadingListener();
    }
    return () => {
      if (listening.current) {
        window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [attachHeadingListener, handleOrientation]);

  return { deviceHeading, requestDeviceHeading };
};

const NorthCompassIcon = ({ bearing }) => (
  <svg className="orbit-compass" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <circle className="orbit-compass-face" cx="21" cy="21" r="19" />
    <path className="orbit-compass-mark" d="M21 4.5v3.2M37.5 21h-3.2M21 37.5v-3.2M4.5 21h3.2" />
    <g
      className="orbit-compass-needle"
      style={{ transform: `rotate(${-bearing}deg)`, transformOrigin: "21px 21px" }}
    >
      <path className="orbit-compass-north" d="M21 7.3 24.6 21 21 18.6 17.4 21z" />
      <path className="orbit-compass-south" d="M21 34.7 24.6 21 21 23.4 17.4 21z" />
    </g>
    <circle className="orbit-compass-center" cx="21" cy="21" r="2.1" />
  </svg>
);

function App() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [theme, setTheme] = useState(() =>
    localStorage.getItem("theme") === "light" ? "light" : DEFAULT_THEME_ID
  );
  const [buildingsEnabled, setBuildingsEnabled] = useState(() =>
    localStorage.getItem("buildingView") !== "2d"
  );
  const [isFollowing, setIsFollowing] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'users', or null
  const activePanelRef = useRef(activePanel);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [cameraMode, setCameraMode] = useState(CAMERA_MODES.CINEMATIC);
  const [mapBearing, setMapBearing] = useState(0);
  const [isInvisible, setIsInvisible] = useState(() => localStorage.getItem("invisibleMode") === "true");
  const [chatPosition, setChatPosition] = useState(getStoredChatPosition);
  const { deviceHeading, requestDeviceHeading } = useDeviceHeading();

  // Join-room passcode modal state
  const [joinModal, setJoinModal] = useState(null);  // null | { roomName, loading, error }
  const joinModalRef = useRef(null); // keep latest modal state for socket callbacks
  const pendingJoinRef = useRef(null); // { isPrivate: bool } tracks the in-flight join_room emit

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState(localStorage.getItem("roomId") || "Global");
  const [isRoomPrivate, setIsRoomPrivate] = useState(localStorage.getItem("isRoomPrivate") === "true");
  const [roomInput, setRoomInput] = useState("");
  const chatEndRef = useRef(null);
  const currentRoomRef = useRef(currentRoom);
  const isRoomPrivateRef = useRef(isRoomPrivate);

  // Auth State
  const [user, setUser] = useState(getPersistentUser());
  const mapRef = useRef(null);
  const userLocationRef = useRef(userLocation);
  const notifications = useNotifications(user);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = () => setIsMobileViewport(mediaQuery.matches);

    handleViewportChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  const persistRoomSelection = useCallback((room, privateRoom) => {
    currentRoomRef.current = room;
    isRoomPrivateRef.current = privateRoom;
    setCurrentRoom(room);
    setIsRoomPrivate(privateRoom);
    localStorage.setItem("roomId", room);
    localStorage.setItem("isRoomPrivate", String(privateRoom));
  }, []);

  // Persist theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("buildingView", buildingsEnabled ? "3d" : "2d");
  }, [buildingsEnabled]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    isRoomPrivateRef.current = isRoomPrivate;
  }, [isRoomPrivate]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const emitLocationUpdate = useCallback((coords = userLocationRef.current, overrides = {}) => {
    if (!coords || !user.username || !user.userId) return;

    socket.emit("send_location", {
      id: user.userId,
      name: overrides.name || user.username,
      avatarSeed: user.avatarSeed,
      room: overrides.room || currentRoomRef.current,
      ...coords,
    });
  }, [user.userId, user.username, user.avatarSeed]);

  // Socket Listeners
  const requestPublicRoomJoin = useCallback((room) => {
    pendingJoinRef.current = { isPrivate: false };
    localStorage.setItem("roomId", room);
    socket.emit("join_room", { room, userId: user.userId, username: user.username });
    setRoomInput("");
  }, [user.userId, user.username]);

  useEffect(() => {
    socket.on("update_users", (data) => {
      const unique = {};
      const activeRoom = currentRoomRef.current;
      (data || []).forEach((u) => {
        if (u.room && u.room !== activeRoom) return;
        unique[u.id] = u;
      });
      setUsers(Object.values(unique));
    });

    // INVISIBLE MODE CONFIRMED
    socket.on("invisible_confirmed", ({ invisible }) => {
      setIsInvisible(invisible);
      localStorage.setItem("invisibleMode", String(invisible));
    });

    socket.on("sos_alert", (data) => {
      console.info("[SOS][Trace] Socket.IO event received: sos_alert", data);
      if (data.room && data.room !== currentRoomRef.current) return;
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
      console.info("[SOS][Trace] Socket.IO event received: sos_cancel", data);
      if (data.room && data.room !== currentRoomRef.current) return;
      setSosAlerts(prev => prev.filter(alert => String(alert.id) !== String(data.id)));
    });

    // LOAD OLD MESSAGES
    socket.on("load_messages", (messages) => {
      console.log("LOADED MESSAGES:", messages);
      const now = Date.now() / 1000;
      setChatMessages((messages || []).filter((msg) => now - msg.timestamp < 86400));
    });

    // RECEIVE NEW MESSAGE
    socket.on("receive_message", (msg) => {
      console.log("RECEIVED:", msg);
      if (msg.room && msg.room !== currentRoomRef.current) return;
      setChatMessages((prev) => {
        if (msg._id && prev.some((item) => item._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    // MESSAGE UPDATED (SEEN STATUS)
    socket.on("message_updated", (updatedMsg) => {
      if (updatedMsg.room && updatedMsg.room !== currentRoomRef.current) return;
      setChatMessages((prev) =>
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    });

    // ROOM ERROR (wrong passcode, private collision, etc.)
    socket.on("room_error", ({ message }) => {
      console.warn("ROOM ERROR:", message);

      // If the passcode modal is open, surface the error inside it
      if (joinModalRef.current) {
        setJoinModal(prev => prev ? { ...prev, loading: false, error: message } : null);
        return;
      }

      // Otherwise roll back to Global (e.g. create-room failure, deleted room)
      const rolledBack = "Global";
      persistRoomSelection(rolledBack, false);
      setChatMessages([]);
      setUsers([]);
      setSosAlerts([]);
      setIsSOSActive(false);
      socket.emit("join_room", { room: rolledBack, userId: user.userId, username: user.username });
      showToast({ message, type: "error" });
    });

    // ROOM JOINED CONFIRMATION (join flow only)
    socket.on("room_joined", ({ room, isPrivate }) => {
      console.log("Joined room:", room);

      const pendingJoin = pendingJoinRef.current;
      const previousRoom = currentRoomRef.current;
      const wasRestore = !pendingJoin && room === previousRoom;
      const roomChanged = room !== previousRoom;
      const wasPrivate =
        typeof isPrivate === "boolean"
          ? isPrivate
          : pendingJoin?.isPrivate ?? (wasRestore ? isRoomPrivateRef.current : false);
      pendingJoinRef.current = null;

      persistRoomSelection(room, wasPrivate);

      if (roomChanged) {
        setUsers([]);
        setSosAlerts([]);
        setIsSOSActive(false);
      }

      emitLocationUpdate(userLocationRef.current, { room });

      if (localStorage.getItem("invisibleMode") === "true" && user.userId) {
        socket.emit("set_invisible", { userId: user.userId, invisible: true, room });
      }

      if (joinModalRef.current) {
        setJoinModal(null);
      }

      if (!wasRestore) {
        showToast({ message: `Joined room: ${room}`, type: "room" });
      }
    });

    // ROOM CREATED CONFIRMATION (create flow only)
    socket.on("room_created", ({ room }) => {
      console.log("Room created:", room);
      persistRoomSelection(room, true);
      setChatMessages([]);
      setUsers([]);
      setSosAlerts([]);
      setIsSOSActive(false);
      emitLocationUpdate(userLocationRef.current, { room });
      if (localStorage.getItem("invisibleMode") === "true" && user.userId) {
        socket.emit("set_invisible", { userId: user.userId, invisible: true, room });
      }
      showToast({ message: `Room "${room}" created!`, type: "room" });
    });

    // CREATE ROOM ERROR
    socket.on("create_room_error", ({ message }) => {
      console.warn("create_room_error:", message);
      // Don't touch room state; just show the error
      showToast({ message, type: "error" });
    });

    // CHECK ROOM RESULT: decide whether to show passcode modal or error
    socket.on("check_room_result", ({ room, exists, isPrivate }) => {
      console.log("check_room_result:", { room, exists, isPrivate });

      if (!exists) {
        // Room is not in the database; reject, never join
        console.warn(`Room '${room}' does not exist in DB; blocking join`);
        showToast({ message: "Room does not exist", type: "error" });
        return;
      }

      if (isPrivate) {
        // Private room: open passcode modal
        setJoinModal({ roomName: room, loading: false, error: null });
        return;
      }

      // Public room that exists in DB: join directly
      requestPublicRoomJoin(room);
    });

    if (user.username) {
      socket.emit("rejoin_room", {
        room: currentRoomRef.current,
        userId: user.userId,
        username: user.username,
      });
    }

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

  }, [emitLocationUpdate, persistRoomSelection, requestPublicRoomJoin, user.username, user.userId]);

  // Keep ref in sync so socket callbacks can read latest modal state
  useEffect(() => {
    joinModalRef.current = joinModal;
  }, [joinModal]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // MESSAGE TTL CLEANUP (Frontend)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now() / 1000;
      setChatMessages((prev) =>
        prev.filter((msg) => now - msg.timestamp < 86400)
      );
    }, 60000); // Check every 60 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // Send live location
  useEffect(() => {
    if (!user.username) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
        };
        setUserLocation(coords);
        userLocationRef.current = coords;
        emitLocationUpdate(coords);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setUserLocation((prev) => prev || { lat: 12.9716, lng: 77.5946, heading: null });
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [emitLocationUpdate, user.username]);

  // Restore invisible state on reconnect
  useEffect(() => {
    const handleReconnect = () => {
      if (user.username) {
        socket.emit("rejoin_room", {
          room: currentRoomRef.current,
          userId: user.userId,
          username: user.username,
        });
      }
      const savedInvisible = localStorage.getItem("invisibleMode") === "true";
      if (savedInvisible && user.userId) {
        socket.emit("set_invisible", {
          userId: user.userId,
          invisible: true,
          room: currentRoomRef.current,
        });
      }
    };
    socket.on("connect", handleReconnect);
    return () => socket.off("connect", handleReconnect);
  }, [user.username, user.userId]);

  // Sync invisible state on initial load
  useEffect(() => {
    if (user.username && isInvisible && user.userId) {
      socket.emit("set_invisible", {
        userId: user.userId,
        invisible: true,
        room: currentRoomRef.current,
      });
    }
  }, [user.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Login
  const handleLogin = (username, roomId) => {
    const trimmed = username.trim().toUpperCase();
    if (!isValidIdentity(trimmed)) return;

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
    socket.emit("join_room", { room: finalRoom, userId: user.userId, username: trimmed });
  };

  // Handle Logout
  const handleLogout = async () => {
    await notifications.disableNotifications();
    localStorage.removeItem("username");
    localStorage.removeItem("avatarSeed");
    localStorage.removeItem("roomId");
    localStorage.removeItem("isRoomPrivate");
    localStorage.removeItem("invisibleMode");
    window.location.reload();
  };

  // Update Avatar
  const changeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    localStorage.setItem("avatarSeed", newSeed);
    setUser(prev => ({ ...prev, avatarSeed: newSeed }));
  };

  // Update Username
  const updateUsername = (newName) => {
    const trimmed = newName.trim().toUpperCase();
    if (!isValidIdentity(trimmed) || trimmed === user.username) return;

    localStorage.setItem("username", trimmed);
    setUser(prev => ({ ...prev, username: trimmed }));

    // Force instant socket sync
    if (userLocation) {
      emitLocationUpdate(userLocation, { name: trimmed });
    }

    showToast({
      message: "Name updated!",
      type: "success"
    });
  };

  // Handle Invisible Mode Toggle
  const handleToggleInvisible = (newValue) => {
    setIsInvisible(newValue);
    localStorage.setItem("invisibleMode", String(newValue));
    socket.emit("set_invisible", {
      userId: user.userId,
      invisible: newValue,
      room: currentRoomRef.current,
    });
    showToast({
      message: newValue ? "You are now invisible" : "You are now visible",
      type: newValue ? "cancel" : "success"
    });
  };

  const handleToggleNotifications = async (enabled) => {
    const nextState = await notifications.setNotificationsEnabled(enabled);
    const message =
      nextState.status === "denied"
        ? "Notifications are blocked in this browser"
        : nextState.status === "unsupported"
          ? "Notifications are not supported here"
          : nextState.status === "prepared-placeholder"
            ? "Notifications prepared for Firebase setup"
            : nextState.enabled
              ? "Notifications enabled"
              : "Notifications disabled";

    showToast({
      message,
      type: nextState.enabled ? "success" : nextState.status === "denied" ? "error" : "cancel",
    });
  };

  const handleChatPositionChange = (position) => {
    const nextPosition = position === "right" ? "right" : "left";
    setChatPosition(nextPosition);
    localStorage.setItem("chatPosition", nextPosition);
  };

  // Directly join a public room (no passcode required)
  // JOIN button handler: asks backend for room type first
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
    socket.emit("join_room", {
      room: roomName,
      isPrivate: true,
      passcode,
      userId: user.userId,
      username: user.username,
    });
  };

  const handlePasscodeCancel = () => {
    setJoinModal(null);
  };

  const handleCreateRoom = (roomData) => {
    setShowCreateRoomModal(false);
    // Emit to the dedicated CREATE event, never join_room.
    // Backend will reject with create_room_error if room already exists
    socket.emit("create_room", {
      room: roomData.name,
      passcode: roomData.passcode,
      userId: user.userId,
      username: user.username,
    });
  };

  const handleMessageInputChange = (e) => {
    const nextValue = e.target.value;
    if (nextValue.trim().toLowerCase() === "/orbit") {
      setShowEasterEgg(true);
      setMsgInput("");
      return;
    }
    setMsgInput(nextValue);
  };

  // Handle Send Message
  const sendMessage = (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text) return;

    // EASTER EGG TRIGGER
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

  // Seen Logic Effect (Real-time)
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
    console.info("[SOS][Trace] SOS Button Click", {
      active: isSOSActive,
      hasLocation: Boolean(userLocation),
      userId: user.userId,
      username: user.username,
    });

    if (!userLocation || !user.username) return;

    if (isSOSActive) {
      // TELL SERVER YOU CANCELLED
      const cancelData = {
        id: user.userId,
        name: user.username,
        avatarSeed: user.avatarSeed,
        room: currentRoomRef.current,
        ...(userLocation || {}),
      };
      console.info("[SOS][Trace] Socket.IO emit: sos_cancel", cancelData);
      socket.emit("sos_cancel", cancelData);

      // REMOVE LOCALLY
      setSosAlerts(prev => prev.filter(alert => alert.id !== user.userId));

      setIsSOSActive(false);
      showToast("SOS cancelled", "cancel");
    } else {
      const data = {
        id: user.userId,
        name: user.username,
        avatarSeed: user.avatarSeed,
        room: currentRoomRef.current,
        ...userLocation,
      };

      socket.emit("sos_alert", data);
      console.info("[SOS][Trace] Socket.IO emit: sos_alert", data);
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

  // If no username, show Login Page
  const handleCompassReset = () => {
    requestDeviceHeading();
    mapRef.current?.resetBearing();
  };

  const handleMapInteraction = useCallback(() => {
    const isMobileViewport =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;

    if (!isMobileViewport || activePanelRef.current !== "chat") return;
    setActivePanel(null);
  }, []);

  if (!user.username) {
    return <Login onLogin={handleLogin} />;
  }

  // Handle Auto-disable Follow Me
  const handleAutoDisableFollowing = () => {
    if (isFollowing) {
      setIsFollowing(false);
    }
  };

  // Haversine distance formula
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

  const isChatOpen = activePanel === "chat";
  const isMobileChatRight = isMobileViewport && chatPosition === "right";
  const chatDockPositionClass = isMobileChatRight ? "chat-dock--right" : "chat-dock--left";
  const chatTogglePoints = isMobileChatRight
    ? (isChatOpen ? "9 18 15 12 9 6" : "15 18 9 12 15 6")
    : (isChatOpen ? "15 18 9 12 15 6" : "9 18 15 12 9 6");

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }} className={`orbit-app-shell ${theme}-mode`}>
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
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        onBearingChange={setMapBearing}
        buildingsEnabled={buildingsEnabled}
        deviceHeading={deviceHeading}
        onMapInteraction={handleMapInteraction}
      />

      {/* CHAT PANEL (Mica Dark) */}
      <div className={`chat-dock ${chatDockPositionClass} ${isChatOpen ? "open" : "closed"}`}>
      <div className={`chat-panel ${isChatOpen ? "open" : "closed"}`}>
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
  {(msg.seenBy || []).length > 1 ? (
    <CheckCheck size={14} className="msg-seen-icon" />
  ) : (
    <Check size={14} className="msg-seen-icon" />
  )}
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
              onChange={handleMessageInputChange}
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


      {/* CHAT TOGGLE BUTTON */}
      <button
        className={`chat-toggle ${isChatOpen ? "open" : "closed"}`}
        onClick={() => {
          setActivePanel(prev => {
            const next = prev === "chat" ? null : "chat";
            if (next === "chat" && window.innerWidth <= 768) {
              setFabOpen(false);
            }
            return next;
          });
        }}
        title={isChatOpen ? "Collapse Chat" : "Expand Chat"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={chatTogglePoints}></polyline>
        </svg>
        {activePanel !== "chat" && unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>
      </div>

      {/* ACTIVE USERS INDICATOR */}
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

      {/* USERS PANEL */}
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
                              Online now {distance && u.id !== user.userId && <span className="distance" style={{ opacity: 0.7 }}> - {distance}</span>}
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

      {/* MOBILE FAB */}
      <div className={`fab-container ${fabOpen ? "open" : ""}`}>
        <div className="fab-actions">
          <button
            className={`control-btn recenter-btn perspective-${cameraMode} active`}
            onClick={handleRecenter}
            title={`${CAMERA_MODE_LABELS[cameraMode]} active. Switch to ${nextModeLabel(cameraMode)}`}
            aria-label={`${CAMERA_MODE_LABELS[cameraMode]} active. Switch to ${nextModeLabel(cameraMode)}`}
          >
            <CameraModeIcon mode={cameraMode} />
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

        <button
          className={`control-btn compass-control-btn mobile-compass-control ${Math.abs(mapBearing) > 0.5 ? "bearing-active" : ""}`}
          onClick={handleCompassReset}
          title="Reset bearing to north"
          aria-label="Reset bearing to north"
        >
          <NorthCompassIcon bearing={mapBearing} />
        </button>

        <button
          className="fab-main"
          aria-label={fabOpen ? "Close map controls" : "Open map controls"}
          onClick={() => {
          setFabOpen(prev => {
            const next = !prev;
            if (next && window.innerWidth <= 768) {
              setActivePanel(current => current === "chat" ? null : current);
            }
            return next;
          });
        }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>

      {/* CONTROL CLUSTER */}
      <div className="control-cluster">
        <button className="profile-btn" onClick={() => setShowProfile(true)} aria-label="Open profile settings">
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
          className={`control-btn recenter-btn perspective-${cameraMode} active`}
          onClick={handleRecenter}
          title={`${CAMERA_MODE_LABELS[cameraMode]} active. Switch to ${nextModeLabel(cameraMode)}`}
          aria-label={`${CAMERA_MODE_LABELS[cameraMode]} active. Switch to ${nextModeLabel(cameraMode)}`}
        >
          <CameraModeIcon mode={cameraMode} />
        </button>



        <button
          className={`control-btn compass-control-btn ${Math.abs(mapBearing) > 0.5 ? "bearing-active" : ""}`}
          onClick={handleCompassReset}
          title="Reset bearing to north"
          aria-label="Reset bearing to north"
        >
          <NorthCompassIcon bearing={mapBearing} />
        </button>
      </div>

      <button
        className={`sos-btn ${isSOSActive ? "active" : ""}`}
        onClick={handleSOS}
        aria-pressed={isSOSActive}
        aria-label={isSOSActive ? "Cancel SOS alert" : "Send SOS alert"}
      >
        <span className="sos-btn__glow" aria-hidden="true" />
        <span className="sos-btn__state sos-btn__state--sos" aria-hidden={isSOSActive}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.2 14.2a4.8 4.8 0 0 1 9.6 0v2.1H7.2z" />
            <path d="M5.4 18.8h13.2" />
            <path d="M9 14.1a3 3 0 0 1 6 0" opacity="0.45" />
            <path d="M12 3.6v2.2M5.4 6.2 3.9 4.7M18.6 6.2l1.5-1.5" />
          </svg>
          <span>SOS</span>
        </span>
        <span className="sos-btn__state sos-btn__state--cancel" aria-hidden={!isSOSActive}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="7.8" />
            <path d="m15 9-6 6M9 9l6 6" />
          </svg>
          <span>CANCEL</span>
        </span>
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
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.3" />
              <path className="sweep" d="M12 3 A9 9 0 0 1 21 12" stroke="white" strokeWidth="2" />
              <circle cx="12" cy="12" r="2" fill="white" />
            </svg>
          )}

          {toast.type === "follow" && (
            <svg className="icon follow-fly" viewBox="0 0 24 24" fill="none">
              <path d="M3 11L22 2L13 21L11 13L3 11Z"
                stroke="white" strokeWidth="2" />
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
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}

          {toast.type === "cancel" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

          {toast.type === "maintenance" && (
            <svg className="icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 18v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M3 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" />
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
          notificationsEnabled={notifications.enabled}
          notificationStatus={notifications.status}
          notificationPermission={notifications.permission}
          notificationsSupported={notifications.supported}
          onToggleNotifications={handleToggleNotifications}
          isMobileViewport={isMobileViewport}
          chatPosition={chatPosition}
          onChatPositionChange={handleChatPositionChange}
          themeMode={theme}
          onThemeModeChange={setTheme}
          buildingsEnabled={buildingsEnabled}
          onBuildingsEnabledChange={setBuildingsEnabled}
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
