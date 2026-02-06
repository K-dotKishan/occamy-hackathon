import 'dotenv/config'
import express from "express"
import cors from "cors"
import http from "http"
import { Server } from "socket.io"

import { connectDB } from "./models.js"
import { Location, AdminMessage } from "./models.js"   // 🔥 Needed for tracking DB
import { geoFenceCheck } from "./geoFence.js" // 🔥 Create file if not yet

console.log("1. Importing routes...")
import authRoutes from "./routes.auth.js"
console.log("2. Auth routes imported")
import adminRoutes from "./routes.admin.js"
console.log("3. Admin routes imported")
import fieldRoutes from "./routes.field.js"
console.log("4. Field routes imported")
import inventoryRoutes from "./routes.inventory.js"
console.log("5. Inventory routes imported")

const app = express()

/* ================= BASIC MIDDLEWARE ================= */
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static('uploads'))
app.use("/uploads", express.static("uploads"))

/* ================= ROUTES ================= */
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/field", fieldRoutes)
app.use("/inventory", inventoryRoutes)

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
    origin: "*",
    methods: ["GET", "POST"]
  }
})

/* ================= SOCKET CONNECTION ================= */
io.on("connection", socket => {

  console.log("🟢 Socket Connected:", socket.id)

  /* ===== FIELD LIVE LOCATION ===== */
  socket.on("field-location-update", async (data) => {

    try {

      // Save to DB
      await Location.create({
        userId: data.userId,
        lat: data.lat,
        lng: data.lng,
        time: data.time || new Date()
      })

      // Geo Fence Check
      geoFenceCheck(data)

      // Send to ALL Admin Dashboards
      io.emit("admin-location-update", data)

    } catch (err) {
      console.error("Location Save Error:", err.message)
    }

  })

  /* ===== FIELD OFFICER MESSAGE ===== */
  socket.on("field-message", async (data) => {

    try {

      // Save to DB
      const message = await AdminMessage.create({
        officerId: data.officerId,
        officerName: data.officerName,
        officerPhone: data.officerPhone,
        text: data.text,
        location: data.location,
        distanceTravelled: data.distanceTravelled,
        status: data.status || "UPDATE",
        meetingType: data.meetingType
      })

      // Broadcast to all admins
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
