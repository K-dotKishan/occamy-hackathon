import express from "express"
import auth from "./auth.js"
import { Attendance, Activity, Sale, Sample, LocationLog, AdminMessage, User } from "./models.js"
import multer from "multer" // For photo uploads
import path from "path"
import { upload } from "./middleware/upload.js"
import { LocationTrack } from "./models.js"
import { calculateDistance } from "./utils/distance.js"



const router = express.Router()



// import LocationTrack from "../models/LocationTrack.js"

router.post(
  "/upload-photo",
  upload.single("photo"),
  async (req, res) => {

    res.json({
      photoUrl: `/uploads/${req.file.filename}`
    })

  }
)

/* ================= FIELD DASHBOARD ================= */
router.get("/dashboard", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    // Get active attendance if any
    const activeAttendance = await Attendance.findOne({
      userId: req.user.id,
      endTime: null
    })

    // Get last known location
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const locationTrack = await LocationTrack.findOne({
      userId: req.user.id,
      date: today
    }).sort({ "path.time": -1 })

    const lastLocation = locationTrack?.path?.[locationTrack.path.length - 1] || null

    res.json({
      activeAttendance: activeAttendance || null,
      lastLocation: lastLocation ? {
        lat: lastLocation.lat,
        lng: lastLocation.lng,
        time: lastLocation.time
      } : null
    })
  } catch (err) {
    console.error("Field dashboard error:", err)
    res.status(500).json({ error: "Failed to fetch dashboard data" })
  }
})

router.post("/location", async (req, res) => {

  try {
    const { lat, lng } = req.body
    const userId = req.user?.id || req.body.userId

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let track = await LocationTrack.findOne({
      userId,
      date: today
    })

    if (!track) {
      track = await LocationTrack.create({
        userId,
        date: today,
        path: []
      })
    }

    track.path.push({
      lat,
      lng,
      time: new Date()
    })

    await track.save()

    res.json({ success: true })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }

})



/* ================= START DAY (ATTENDANCE) ================= */
router.post("/attendance/start", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    // Check if there's already an active attendance
    const activeAttendance = await Attendance.findOne({
      userId: req.user.id,
      endTime: null
    })

    if (activeAttendance) {
      return res.status(400).json({ error: "Day already started. Please end the current day first." })
    }

    const attendance = await Attendance.create({
      userId: req.user.id,
      startLocation: {
        lat: req.body.location.lat,
        lng: req.body.location.lng,
        address: req.body.location.address || ""
      },
      startTime: new Date(),
      startOdometer: req.body.odometer || 0 // NEW: Odometer reading
    })

    res.json(attendance)
  } catch (err) {
    console.error("Start day error:", err)
    res.status(500).json({ error: "Failed to start day" })
  }
})

/* ================= END DAY ================= */
router.post("/attendance/end", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const attendance = await Attendance.findOne({
      userId: req.user.id,
      endTime: null
    }).sort({ startTime: -1 })

    if (!attendance) {
      return res.status(400).json({ error: "No active day found" })
    }

    // Calculate distance traveled
    const totalDistance = req.body.odometer
      ? req.body.odometer - attendance.startOdometer
      : 0

    attendance.endTime = new Date()
    attendance.endLocation = {
      lat: req.body.location.lat,
      lng: req.body.location.lng,
      address: req.body.location.address || ""
    }
    attendance.endOdometer = req.body.odometer || 0
    attendance.totalDistance = totalDistance

    await attendance.save()

    res.json({ message: "Day ended successfully", attendance })
  } catch (err) {
    console.error("End day error:", err)
    res.status(500).json({ error: "Failed to end day" })
  }
})

/* ================= LOG MEETING (ONE-TO-ONE) ================= */
router.post("/meeting/one-to-one", auth, upload.array('photos', 5), async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []

    const activity = await Activity.create({
      userId: req.user.id,
      type: "ONE_TO_ONE",

      // Person details
      personName: req.body.personName,
      contactNumber: req.body.contactNumber,
      category: req.body.category,

      // Business potential
      businessPotential: req.body.businessPotential ? (typeof req.body.businessPotential === 'string' ? JSON.parse(req.body.businessPotential) : req.body.businessPotential) : undefined,

      // Location
      location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,

      // Notes & photos
      notes: req.body.notes,
      photos: photoUrls,

      // Follow-up
      followUpRequired: req.body.followUpRequired === 'true',
      followUpDate: req.body.followUpDate || undefined
    })

    // Log location
    await LocationLog.create({
      userId: req.user.id,
      location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
      activity: "MEETING"
    })

    // Create an admin message so admins see meeting distribution updates
    try {
      let distanceTravelled = 0
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
        distanceTravelled = att?.totalDistance || 0
      } catch (dErr) {
        distanceTravelled = 0
      }

      const officer = await User.findById(req.user.id).select('name phone')

      await AdminMessage.create({
        officerId: req.user.id,
        officerName: officer?.name || 'Field Officer',
        officerPhone: officer?.phone || '',
        text: `One-to-one meeting with ${req.body.personName || 'participant'}${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
        location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
        distanceTravelled,
        status: 'MEETING',
        meetingType: 'ONE_TO_ONE',
        timestamp: new Date()
      })
    } catch (msgErr) {
      console.error('Failed to create admin message for one-to-one meeting:', msgErr)
    }

    res.json(activity)
  } catch (err) {
    console.error("Meeting logging error:", err)
    res.status(500).json({ error: "Failed to log meeting" })
  }
})

/* ================= LOG MEETING (SIMPLE JSON) ================= */
// Backwards-compatible endpoint for clients that send JSON instead of multipart/form-data
router.post("/meeting", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    console.log('JSON meeting payload received:', req.body)

    const mt = (req.body.meetingType || req.body.type || 'ONE_TO_ONE').toUpperCase()

    const activityPayload = {
      userId: req.user.id,
      type: mt,
      notes: req.body.notes || '',
      photos: req.body.photos || (req.body.photoUrl ? [req.body.photoUrl] : []),
      category: req.body.category || (req.body.category || 'FARMER')
    }

    if (mt === 'ONE_TO_ONE') {
      activityPayload.personName = req.body.personName || req.body.person || req.body.farmerName || ''
      activityPayload.contactNumber = req.body.contactNumber || req.body.contact || req.body.phoneNumber || ''
      activityPayload.location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 })
      activityPayload.village = req.body.village || ''
      activityPayload.district = req.body.district || ''
      activityPayload.state = req.body.state || ''
    } else {
      // GROUP
      activityPayload.village = req.body.village || ''
      activityPayload.district = req.body.district || ''
      activityPayload.state = req.body.state || ''
      activityPayload.attendeesCount = parseInt(req.body.attendeesCount) || 0
      activityPayload.meetingType = req.body.meetingTypeDetail || req.body.meetingType || req.body.meeting || ''
      activityPayload.location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 })
    }

    const activity = await Activity.create(activityPayload)

    // Log location if provided
    if (activity.location) {
      await LocationLog.create({ userId: req.user.id, location: activity.location, activity: 'MEETING' })
    }

    // Create admin message for JSON meeting endpoint
    try {
      let distanceTravelled = 0
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
        distanceTravelled = att?.totalDistance || 0
      } catch (dErr) {
        distanceTravelled = 0
      }

      const officer = await User.findById(req.user.id).select('name phone')
      const text = activity.type === 'ONE_TO_ONE'
        ? `One-to-one meeting with ${activity.personName || 'participant'}${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`
        : `Group meeting at ${activity.village || 'unknown'} with ${activity.attendeesCount || 0} attendees${activity.notes ? ' - ' + activity.notes.slice(0, 200) : ''}`

      await AdminMessage.create({
        officerId: req.user.id,
        officerName: officer?.name || 'Field Officer',
        officerPhone: officer?.phone || '',
        text,
        location: activity.location || { lat: 0, lng: 0, address: '' },
        distanceTravelled,
        status: 'MEETING',
        meetingType: activity.type,
        timestamp: new Date()
      })
    } catch (msgErr) {
      console.error('Failed to create admin message for JSON meeting:', msgErr)
    }

    res.status(201).json(activity)
  } catch (err) {
    console.error('JSON meeting logging error:', err)
    res.status(500).json({ error: 'Failed to log meeting (json endpoint)', details: err.message })
  }
})

/* ================= LOG MEETING (GROUP) ================= */
router.post("/meeting/group", auth, upload.array('photos', 10), async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []

    const activity = await Activity.create({
      userId: req.user.id,
      type: "GROUP",

      // Group details
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,
      attendeesCount: parseInt(req.body.attendeesCount),
      meetingType: req.body.meetingType, // demo, training, feedback
      category: req.body.category || "FARMER",

      // Location
      location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),

      // Notes & photos
      notes: req.body.notes,
      photos: photoUrls
    })

    // Log location
    await LocationLog.create({
      userId: req.user.id,
      location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
      activity: "MEETING"
    })

    // Create admin message so admins see group meeting distribution updates
    try {
      let distanceTravelled = 0
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const att = await Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } }).sort({ startTime: -1 })
        distanceTravelled = att?.totalDistance || 0
      } catch (dErr) {
        distanceTravelled = 0
      }

      const officer = await User.findById(req.user.id).select('name phone')

      await AdminMessage.create({
        officerId: req.user.id,
        officerName: officer?.name || 'Field Officer',
        officerPhone: officer?.phone || '',
        text: `Group meeting at ${req.body.village || 'unknown'} with ${req.body.attendeesCount || 0} attendees${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
        location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
        distanceTravelled,
        status: 'MEETING',
        meetingType: 'GROUP',
        timestamp: new Date()
      })
    } catch (msgErr) {
      console.error('Failed to create admin message for group meeting:', msgErr)
    }

    res.json(activity)
  } catch (err) {
    console.error("Group meeting error:", err)
    res.status(500).json({ error: "Failed to log group meeting" })
  }
})

/* ================= DISTRIBUTE SAMPLE ================= */
router.post("/sample", auth, upload.array('photos', 5), async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []

    const sample = await Sample.create({
      userId: req.user.id,

      // Product
      productName: req.body.productName,
      productSKU: req.body.productSKU,
      quantity: parseFloat(req.body.quantity),
      unit: req.body.unit,

      // Recipient
      recipientName: req.body.recipientName,
      recipientContact: req.body.recipientContact,
      recipientCategory: req.body.recipientCategory,

      // Purpose
      purpose: req.body.purpose,
      expectedFeedbackDate: req.body.expectedFeedbackDate || undefined,

      // Location
      location: JSON.parse(req.body.location),
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,

      photos: photoUrls
    })

    // Log location
    await LocationLog.create({
      userId: req.user.id,
      location: JSON.parse(req.body.location),
      activity: "SAMPLE"
    })

    res.json(sample)
  } catch (err) {
    console.error("Sample distribution error:", err)
    res.status(500).json({ error: "Failed to log sample distribution" })
  }
})

/* ================= RECORD SALE ================= */
router.post("/sale", auth, upload.array('photos', 3), async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    console.log("Sale request received:", {
      saleType: req.body.saleType,
      productName: req.body.productName,
      quantity: req.body.quantity,
      price: req.body.price,
      farmerName: req.body.farmerName,
      distributorName: req.body.distributorName
    })

    const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : []

    let quantity = parseInt(req.body.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      quantity = 1
    }

    let pricePerUnit = parseFloat(req.body.pricePerUnit || req.body.price)
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      pricePerUnit = 0
    }

    const totalAmount = quantity * pricePerUnit

    // Handle location - it could be a string or object
    let location = req.body.location
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location)
      } catch (e) {
        console.error("Location parsing error:", e)
        location = null
      }
    }

    // Ensure location has required fields
    if (!location || typeof location !== 'object') {
      location = { lat: 0, lng: 0 }
    }

    // Ensure lat and lng are numbers
    location.lat = parseFloat(location.lat) || 0
    location.lng = parseFloat(location.lng) || 0

    const saleType = (req.body.saleType || "B2C").toUpperCase()

    // Get customer name based on sale type
    const customerName = saleType === 'B2C'
      ? (req.body.farmerName || "").trim()
      : (req.body.distributorName || "").trim()

    console.log("Sale type:", saleType, "Customer name:", customerName)

    const saleData = {
      userId: req.user.id,

      // Product
      productName: (req.body.productName || "").trim(),
      productSKU: (req.body.productSKU || "").trim(),
      packSize: (req.body.packSize || "").trim(),
      quantity,
      pricePerUnit,
      totalAmount,

      // Sale type
      saleType: saleType,

      // Customer details (based on type)
      farmerName: saleType === 'B2C' ? (req.body.farmerName || "").trim() : null,
      farmerContact: saleType === 'B2C' ? (req.body.farmerContact || "").trim() : null,
      distributorName: saleType === 'B2B' ? (req.body.distributorName || "").trim() : null,
      distributorContact: saleType === 'B2B' ? (req.body.distributorContact || "").trim() : null,
      distributorType: (req.body.distributorType || "").trim(),

      // Order tracking
      isRepeatOrder: req.body.isRepeatOrder === 'true' || req.body.isRepeatOrder === true,
      paymentMode: req.body.paymentMode || 'CASH',
      paymentStatus: req.body.paymentStatus || 'PAID',

      // Location
      location: location,
      village: (req.body.village || "").trim(),
      district: (req.body.district || "").trim(),
      state: (req.body.state || "").trim(),

      // Delivery
      deliveryStatus: req.body.deliveryStatus || 'IMMEDIATE',

      photos: photoUrls,
      notes: (req.body.notes || "").trim()
    }

    console.log("Creating sale with data:", {
      saleType: saleData.saleType,
      productName: saleData.productName,
      farmerName: saleData.farmerName,
      distributorName: saleData.distributorName,
      quantity: saleData.quantity,
      pricePerUnit: saleData.pricePerUnit,
      totalAmount: saleData.totalAmount
    })

    const sale = await Sale.create(saleData)
    console.log("Sale created successfully:", sale._id)

    // Log location
    await LocationLog.create({
      userId: req.user.id,
      location: location,
      activity: "SALE"
    })

    res.json(sale)
  } catch (err) {
    console.error("Sale recording error:", err.message)
    console.error("Error stack:", err.stack)
    console.error("Request body was:", req.body)
    res.status(500).json({
      error: err.message,
      type: err.name,
      details: err.toString()
    })
  }
})

/* ================= GET FIELD OFFICER SUMMARY ================= */
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [meetings, samples, sales, attendance] = await Promise.all([
      Activity.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Sample.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Sale.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Attendance.findOne({ userId: req.user.id, startTime: { $gte: today } })
    ])

    const totalSales = await Sale.aggregate([
      { $match: { userId: req.user.id, createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ])

    res.json({
      today: {
        meetings,
        samples,
        sales,
        revenue: totalSales[0]?.total || 0,
        distanceTraveled: attendance?.totalDistance || 0,
        isActive: attendance && !attendance.endTime
      }
    })
  } catch (err) {
    console.error("Summary error:", err)
    res.status(500).json({ error: "Failed to fetch summary" })
  }
})

/* ================= UPDATE SAMPLE FEEDBACK ================= */
router.patch("/sample/:id/feedback", auth, async (req, res) => {
  try {
    const sample = await Sample.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        feedbackReceived: true,
        feedbackNotes: req.body.feedbackNotes,
        convertedToSale: req.body.convertedToSale || false
      },
      { new: true }
    )

    if (!sample) {
      return res.status(404).json({ error: "Sample not found" })
    }

    res.json(sample)
  } catch (err) {
    res.status(500).json({ error: "Failed to update feedback" })
  }
})



/* ================= REAL-TIME LOCATION TRACKING ================= */
router.post("/location/track", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const { lat, lng, accuracy, address, activity } = req.body

    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude required" })
    }

    // Get active attendance
    const attendance = await Attendance.findOne({
      userId: req.user.id,
      endTime: null
    })

    // Log the location
    const locationLog = await LocationLog.create({
      userId: req.user.id,
      attendanceId: attendance?._id,
      location: { lat, lng, address: address || "" },
      accuracy: accuracy || 0,
      activity: activity || "TRAVEL"
    })

    // NEW: Calculate Live Distance
    if (attendance) {
      // Find the PREVIOUS location log (before the one we just created)
      const lastLog = await LocationLog.findOne({
        userId: req.user.id,
        attendanceId: attendance._id,
        _id: { $ne: locationLog._id } // Exclude current one
      }).sort({ timestamp: -1 })

      if (lastLog && lastLog.location && lastLog.location.lat) {
        const dist = calculateDistance(
          lastLog.location.lat,
          lastLog.location.lng,
          lat,
          lng
        )

        // Only add reasonable distances (e.g., > 10 meters and < 100km to avoid GPS jumps)
        if (dist > 0.01 && dist < 100) {
          attendance.totalDistance = (attendance.totalDistance || 0) + dist
          await attendance.save()
          console.log(`📍 Distance updated for ${req.user.name}: +${dist.toFixed(3)}km (Total: ${attendance.totalDistance.toFixed(2)}km)`)
        }
      }
    }

    res.json({
      success: true,
      message: "Location tracked",
      locationId: locationLog._id,
      totalDistance: attendance?.totalDistance || 0
    })
  } catch (err) {
    console.error("Location tracking error:", err)
    res.status(500).json({ error: "Failed to track location" })
  }
})

/* ================= GET CURRENT LOCATION (Latest) ================= */
router.get("/location/current", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const latestLocation = await LocationLog.findOne({
      userId: req.user.id
    }).sort({ timestamp: -1 })

    if (!latestLocation) {
      return res.status(404).json({ error: "No location data found" })
    }

    res.json(latestLocation)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current location" })
  }
})

/* ================= GET LOCATION HISTORY ================= */
router.get("/location/history", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    const hours = parseInt(req.query.hours) || 24
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

    const locations = await LocationLog.find({
      userId: req.user.id,
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 })

    res.json(locations)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch location history" })
  }
})

export default router