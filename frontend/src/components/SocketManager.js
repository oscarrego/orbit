import { io } from "socket.io-client";
import { backendConfig } from "../config/backendConfig";

console.info("[Socket.IO] Connecting", { url: backendConfig.baseUrl });

const socket = io(backendConfig.baseUrl, {
  transports: ["polling", "websocket"], // VERY IMPORTANT
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("[Socket.IO] CONNECTED:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("[Socket.IO] CONNECTION ERROR:", err.message);
});

export default socket;
