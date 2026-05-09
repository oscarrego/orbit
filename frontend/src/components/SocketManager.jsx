import { io } from "socket.io-client";

const socket = io("https://orbit-g4ah.onrender.com", {
  transports: ["polling", "websocket"], // 🔥 VERY IMPORTANT
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("✅ CONNECTED:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("❌ CONNECTION ERROR:", err.message);
});

export default socket;