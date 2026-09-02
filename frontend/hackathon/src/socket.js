import { io } from "socket.io-client"

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
})
