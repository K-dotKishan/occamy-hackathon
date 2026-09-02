import 'dotenv/config'
import express from "express"
import cors from "cors"
import http from "http"
import { Server } from "socket.io"

import { connectDB } from "./models/index.js"
import { Location, AdminMessage } from "./models/index.js"   // 🔥 Needed for tracking DB
import { geoFenceCheck } from "./geoFence.js" // 🔥 Create file if not yet

console.log("1. Importing routes...")
import authRoutes from "./routes/auth.js"
console.log("2. Auth routes imported")
import adminRoutes from "./routes/admin.js"
console.log("3. Admin routes imported")
import fieldRoutes from "./routes/field.js"
console.log("4. Field routes imported")
import inventoryRoutes from "./routes/inventory.js"
console.log("5. Inventory routes imported")
import distributorRoutes from "./routes/distributor.js"
console.log("6. Distributor routes imported")

const app = express()

/* ================= BASIC MIDDLEWARE ================= */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// CORS — allow localhost in dev and the deployed Vercel frontend in production
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://occamy-frontend.vercel.app",
  // Accept any *.vercel.app preview deployment
  /\.vercel\.app$/,
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true)
    if (
      allowedOrigins.some(allowed =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
      )
    ) {
      return callback(null, true)
    }
    // Allow any origin in development (NODE_ENV !== "production")
    if (process.env.NODE_ENV !== "production") return callback(null, true)
    return callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept-Language"],
}))

// Handle preflight OPTIONS for all routes
app.options("*", cors())

app.use(express.json())

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ================= ROUTES ================= */
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/field", fieldRoutes)
app.use("/inventory", inventoryRoutes)
app.use("/distributor", distributorRoutes)

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Error:", err)
  res.status(500).json({ error: err.message })
})

/* ================= HTTP SERVER ================= */
const httpServer = http.createServer(app)

/* ================= SOCKET SERVER ================= */
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://occamy-frontend.vercel.app",
      /\.vercel\.app$/,
    ],
    methods: ["GET", "POST"],
    credentials: true,
  }
})

/* ================= SOCKET CONNECTION ================= */
io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id)

  // Field officer broadcasts live location → admin sees it on map
  socket.on("field-location-update", (data) => {
    io.emit("admin-location-update", data)

    // Geofence check (non-blocking)
    try { geoFenceCheck(data) } catch (err) {
      console.error("Geofence Check Error:", err)
    }
  })

  // Field officer status changes (active / offline)
  socket.on("field-status-change", (data) => {
    io.emit("field-status-change", data)
  })

  // Legacy: admin messages sent via socket
  socket.on("send-admin-message", async (data) => {
    try {
      const message = await AdminMessage.create({
        officerId: data.officerId,
        officerName: data.officerName,
        officerPhone: data.officerPhone,
        text: data.text,
        location: data.location,
        distanceTravelled: data.distanceTravelled,
        status: data.status || "UPDATE",
        meetingType: data.meetingType,
      })
      io.emit("admin-message-update", message)
    } catch (err) {
      console.error("Message Save Error:", err.message)
    }
  })

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected:", socket.id)
  })
})

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

/* ================= MONGODB ================= */
connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.warn("⚠ MongoDB connection failed:", err.message)
  })

/* ================= GLOBAL ERROR SAFETY ================= */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason)
})


