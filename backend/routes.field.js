import express from "express"
import auth from "./auth.js"
import { Attendance, Activity, Sale, Sample, LocationLog, AdminMessage, User } from "./models.js"
import multer from "multer" // For photo uploads
import path from "path"
import { upload } from "./middleware/upload.js"
import { LocationTrack } from "./models.js"
import { calculateDistance } from "./utils/distance.js"



const router = express.Router()

router.use((req, res, next) => {
  console.log(`[Field] ${req.method} ${req.url}`);
  /*
  if (Object.keys(req.body).length > 0) {
     // console.log('Body:', JSON.stringify(req.body, null, 2).slice(0, 500));
  }
  */
  next();
});



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
    // Calculate distance traveled
    // If odometer is provided, use it. Otherwise, keep the GPS-calculated distance.
    const totalDistance = req.body.odometer
      ? req.body.odometer - attendance.startOdometer
      : (attendance.totalDistance || 0)

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
router.post("/meeting/one-to-one", auth, upload.array('photos', 10), async (req, res) => {
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

      // Category specific details
      landSize: req.body.landSize,
      cropType: req.body.cropType,
      shopName: req.body.shopName,
      monthlyTurnover: req.body.monthlyTurnover,
      socialHandle: req.body.socialHandle,
      followerCount: req.body.followerCount,
      agencyName: req.body.agencyName,
      territory: req.body.territory,

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

    // Helper to safely parse location
    const parseLoc = (loc) => {
      try {
        if (typeof loc === 'string') return JSON.parse(loc)
        if (typeof loc === 'object' && loc !== null) return loc
        return { lat: 0, lng: 0 }
      } catch (e) {
        return { lat: 0, lng: 0 }
      }
    }

    const location = parseLoc(req.body.location)

    // Log location (Non-blocking)
    LocationLog.create({
      userId: req.user.id,
      location: location,
      activity: "MEETING",
      timestamp: new Date()
    }).catch(err => console.error("Failed to log meeting location:", err.message))

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

      // Non-blocking Admin Message
      AdminMessage.create({
        officerId: req.user.id,
        officerName: officer?.name || 'Field Officer',
        officerPhone: officer?.phone || '',
        text: `One-to-one meeting with ${req.body.personName || 'participant'}${req.body.notes ? ' - ' + req.body.notes.slice(0, 200) : ''}`,
        location: location,
        distanceTravelled,
        status: 'MEETING',
        meetingType: 'ONE_TO_ONE',
        timestamp: new Date()
      }).catch(err => console.error("Failed to create admin message:", err.message))

    } catch (msgErr) {
      console.error('Error preparing admin message setup:', msgErr)
    }

    res.json(activity)
  } catch (err) {
    console.error("Meeting logging error:", err)
    res.status(500).json({ error: "Failed to log meeting: " + err.message })
  }
})

/* ================= LOG MEETING (SIMPLE JSON) ================= */
// Backwards-compatible endpoint for clients that send JSON instead of multipart/form-data
router.post("/meeting", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    console.log('JSON meeting payload received:', JSON.stringify(req.body, null, 2))

    // Helper to safely parse location
    const parseLoc = (loc) => {
      try {
        if (typeof loc === 'string') return JSON.parse(loc)
        if (typeof loc === 'object' && loc !== null) return loc
        return { lat: 0, lng: 0 }
      } catch (e) {
        return { lat: 0, lng: 0 }
      }
    }

    const mt = (req.body.meetingType || req.body.type || 'ONE_TO_ONE').toUpperCase()
    const location = parseLoc(req.body.location)

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
      activityPayload.location = location
      activityPayload.village = req.body.village || ''
      activityPayload.district = req.body.district || ''
      activityPayload.landSize = req.body.landSize
      activityPayload.cropType = req.body.cropType
      activityPayload.shopName = req.body.shopName
      activityPayload.monthlyTurnover = req.body.monthlyTurnover
      activityPayload.socialHandle = req.body.socialHandle
      activityPayload.followerCount = req.body.followerCount
      activityPayload.agencyName = req.body.agencyName
      activityPayload.territory = req.body.territory
    } else {
      // GROUP
      activityPayload.village = req.body.village || ''
      activityPayload.district = req.body.district || ''
      activityPayload.state = req.body.state || ''
      activityPayload.attendeesCount = parseInt(req.body.attendeesCount) || 0
      activityPayload.meetingType = req.body.meetingTypeDetail || req.body.meetingType || req.body.meeting || req.body.topic || ''
      activityPayload.location = location
    }

    const activity = await Activity.create(activityPayload)

    // Log location if provided (Non-blocking)
    if (activity.location && activity.location.lat) {
      LocationLog.create({
        userId: req.user.id,
        location: activity.location,
        activity: 'MEETING'
      }).catch(e => console.error("Loc log error:", e.message))
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

    // Log location (Non-blocking)
    LocationLog.create({
      userId: req.user.id,
      location: typeof req.body.location === 'string' ? JSON.parse(req.body.location) : (req.body.location || { lat: 0, lng: 0 }),
      activity: "MEETING"
    }).catch(e => console.error("Group meeting loc log error:", e.message))

    // Create admin message so admins see group meeting distribution updates
    const createAdminMsg = async () => {
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
    }
    createAdminMsg();

    res.json(activity)
  } catch (err) {
    console.error("Group meeting error:", err)
    res.status(500).json({ error: "Failed to log group meeting" })
  }
})

/* ================= DISTRIBUTE SAMPLE ================= */
router.post("/sample", auth, upload.array('photos', 10), async (req, res) => {
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

    // Log location (Non-blocking)
    LocationLog.create({
      userId: req.user.id,
      location: JSON.parse(req.body.location),
      activity: "SAMPLE"
    }).catch(e => console.error("Sample loc log error:", e.message))

    res.json(sample)
  } catch (err) {
    console.error("Sample distribution error:", err)
    res.status(500).json({ error: "Failed to log sample distribution" })
  }
})

/* ================= RECORD SALE ================= */
router.post("/sale", auth, upload.array('photos', 10), async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers allowed" })
    }

    console.log("Sale payload:", JSON.stringify(req.body, null, 2))

    // Helper to safely parse location (Deduplicated)
    const parseLoc = (loc) => {
      try {
        if (typeof loc === 'string') return JSON.parse(loc)
        if (typeof loc === 'object' && loc !== null) return loc
        return { lat: 0, lng: 0 }
      } catch (e) {
        return { lat: 0, lng: 0 }
      }
    }

    const location = parseLoc(req.body.location)

    const sale = await Sale.create({
      userId: req.user.id,
      productName: req.body.productName,
      quantity: req.body.quantity,
      pricePerUnit: req.body.price, // mapped from price
      totalAmount: req.body.totalAmount,
      saleType: req.body.saleType,
      farmerName: req.body.farmerName,
      distributorName: req.body.distributorName,
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,
      location: location,
      photos: req.body.photos || (req.body.photoUrl ? [req.body.photoUrl] : []),
      notes: req.body.notes
    })


    // Log location (Non-blocking)
    if (sale.location && sale.location.lat) {
      LocationLog.create({
        userId: req.user.id,
        location: sale.location,
        activity: 'SALE'
      }).catch(e => console.error("Sale loc log error:", e.message))
    }

    // Admin message (Non-blocking)
    AdminMessage.create({
      officerId: req.user.id,
      officerName: req.user.name || 'Field Officer',
      text: `New Sale: ${req.body.quantity}x ${req.body.productName} (₹${req.body.totalAmount})`,
      location: location,
      status: 'SALE',
      timestamp: new Date()
    }).catch(e => console.error("Sale admin msg error:", e.message))

    // Update stats logic (Non-blocking)
    const updateStats = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        await AnalyticsSummary.findOneAndUpdate(
          { userId: req.user.id, date: today },
          {
            $inc: {
              salesCount: 1,
              totalSalesAmount: sale.totalAmount || 0,
              b2cSales: sale.saleType === 'B2C' ? 1 : 0,
              b2bSales: sale.saleType === 'B2B' ? 1 : 0
            }
          },
          { upsert: true }
        )
      } catch (statsErr) {
        console.error("Failed to update sales stats:", statsErr)
      }
    }
    updateStats();

    res.json(sale)
  } catch (err) {
    console.error("Sale logging error:", err)
    res.status(500).json({ error: "Failed to log sale: " + err.message })
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

    const [meetings, samples, sales, attendanceRecords] = await Promise.all([
      Activity.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Sample.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Sale.countDocuments({ userId: req.user.id, createdAt: { $gte: today } }),
      Attendance.find({ userId: req.user.id, startTime: { $gte: today } })
    ])

    const totalSales = await Sale.aggregate([
      { $match: { userId: req.user.id, createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ])

    const totalDist = attendanceRecords.reduce((sum, att) => sum + (att.totalDistance || 0), 0)
    const activeAttendance = attendanceRecords.find(a => !a.endTime)

    res.json({
      today: {
        meetings,
        samples,
        sales,
        revenue: totalSales[0]?.total || 0,
        distanceTraveled: parseFloat(totalDist.toFixed(2)),
        isActive: !!activeAttendance
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

        // Only add reasonable distances (e.g., > 2 meters and < 100km to avoid GPS jumps)
        if (dist > 0.002 && dist < 100) {
          attendance.totalDistance = (attendance.totalDistance || 0) + dist
          await attendance.save()
          // console.log(`📍 Distance updated for ${req.user.name}: +${dist.toFixed(3)}km (Total: ${attendance.totalDistance.toFixed(2)}km)`)
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