import express from "express"
import auth from "./auth.js"
import {
  Attendance, Activity, Sale, Sample, User, Product,
  LocationLog, AnalyticsSummary, AdminMessage
} from "./models.js"

const router = express.Router()

/* ================= MAIN DASHBOARD ================= */
router.get("/dashboard", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    // Date filters (default to last 30 days)
    // Normalize start/end to cover full days so UI date pickers include activities on the end date
    let endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()
    endDate.setHours(23, 59, 59, 999)

    let startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    startDate.setHours(0, 0, 0, 0)

    // Fetch data with date filters
    const [attendance, meetings, users, sales, samples] = await Promise.all([
      Attendance.find({
        startTime: { $gte: startDate, $lte: endDate }
      })
        .populate("userId", "name role email state district")
        .sort({ startTime: -1 })
        .limit(50),

      Activity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .populate("userId", "name role email")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),  // Add lean() here for meetings

      User.find().select("-password"),

      Sale.find({
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .populate("userId", "name role email")
        .sort({ createdAt: -1 }),

      Sample.find({
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .populate("userId", "name role email")
        .sort({ createdAt: -1 })
    ])

    // Fetch recent admin messages to show in dashboard (recent 100)
    const adminMessages = await AdminMessage.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean()

    // Create a map of messages by officer+type for faster lookup
    const messageMap = {}
    adminMessages.forEach(msg => {
      if (msg.officerId && msg.meetingType) {
        const key = `${msg.officerId.toString()}_${msg.meetingType}`
        if (!messageMap[key]) messageMap[key] = msg  // Keep first (most recent) message for each combo
      }
    })

    // Join meetings with their admin messages
    meetings.forEach(meeting => {
      const officerId = typeof meeting.userId === 'object' ? meeting.userId._id : meeting.userId
      const meetingType = meeting.type || meeting.meetingType

      if (officerId && meetingType) {
        const key = `${officerId.toString()}_${meetingType}`
        const message = messageMap[key]
        meeting.adminMessage = message ? message.text : null
      } else {
        meeting.adminMessage = null
      }
    })

    // Calculate statistics
    const totalDistance = attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)
    const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)

    const b2cSales = sales.filter(s => s.saleType === 'B2C').length
    const b2bSales = sales.filter(s => s.saleType === 'B2B').length

    const oneToOneMeetings = meetings.filter(m => m.meetingType === 'ONE_TO_ONE' || m.type === 'ONE_TO_ONE').length
    const groupMeetings = meetings.filter(m => m.meetingType === 'GROUP' || m.type === 'GROUP').length

    // Sales chart data (by type)
    const salesChart = [
      { type: 'B2C', count: b2cSales, amount: sales.filter(s => s.saleType === 'B2C').reduce((sum, s) => sum + s.totalAmount, 0) },
      { type: 'B2B', count: b2bSales, amount: sales.filter(s => s.saleType === 'B2B').reduce((sum, s) => sum + s.totalAmount, 0) }
    ]

    // Meeting type chart
    const meetingChart = [
      { type: 'One-to-One', count: oneToOneMeetings },
      { type: 'Group', count: groupMeetings }
    ]

    // State-wise breakdown
    const stateStats = {}
    meetings.forEach(m => {
      if (m.state) {
        if (!stateStats[m.state]) {
          stateStats[m.state] = { meetings: 0, sales: 0, samples: 0 }
        }
        stateStats[m.state].meetings++
      }
    })
    sales.forEach(s => {
      if (s.state && stateStats[s.state]) {
        stateStats[s.state].sales++
      }
    })
    samples.forEach(s => {
      if (s.state && stateStats[s.state]) {
        stateStats[s.state].samples++
      }
    })

    const stateData = Object.entries(stateStats).map(([state, data]) => ({
      state,
      ...data
    }))

    // Farmer conversion rate
    const totalFarmersContacted = meetings.filter(m => m.category === 'FARMER').length
    const farmersConverted = sales.filter(s => s.saleType === 'B2C').length
    const conversionRate = totalFarmersContacted > 0
      ? ((farmersConverted / totalFarmersContacted) * 100).toFixed(1)
      : 0

    console.log("Admin dashboard: meetings", meetings.length, "oneToOne", oneToOneMeetings, "group", groupMeetings)
    console.log("Admin dashboard: meetingChart", meetingChart)

    res.json({
      stats: {
        totalUsers: users.length,
        totalMeetings: meetings.length,
        totalSales: sales.length,
        totalSamples: samples.length,
        totalRevenue,
        totalDistance,
        totalFarmersContacted,
        farmersConverted,
        conversionRate
      },
      attendance,
      meetings,
      users,
      sales,
      samples,
      adminMessages: adminMessages || [],
      salesChart,
      meetingChart,
      stateData,
      dateRange: { startDate, endDate }
    })
  } catch (err) {
    console.error("Admin dashboard error:", err)
    res.status(500).json({ error: "Failed to fetch dashboard data" })
  }
})

/* ================= ANALYTICS: PERFORMANCE BY OFFICER ================= */
router.get("/analytics/officers", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const officers = await User.find({ role: "FIELD" }).select("-password")

    const performanceData = await Promise.all(
      officers.map(async (officer) => {
        const [meetings, sales, samples, attendance] = await Promise.all([
          Activity.countDocuments({ userId: officer._id }),
          Sale.find({ userId: officer._id }),
          Sample.countDocuments({ userId: officer._id }),
          Attendance.find({ userId: officer._id })
        ])

        const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)
        const totalDistance = attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)

        return {
          officerId: officer._id,
          name: officer.name,
          email: officer.email,
          state: officer.state,
          district: officer.district,
          metrics: {
            meetings,
            sales: sales.length,
            samples,
            revenue: totalRevenue,
            distance: totalDistance,
            activeDays: attendance.length
          }
        }
      })
    )

    // Sort by revenue
    performanceData.sort((a, b) => b.metrics.revenue - a.metrics.revenue)

    res.json(performanceData)
  } catch (err) {
    console.error("Officer analytics error:", err)
    res.status(500).json({ error: "Failed to fetch analytics" })
  }
})

/* ================= ANALYTICS: GEOGRAPHIC BREAKDOWN ================= */
router.get("/analytics/geography", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    // Aggregate by state
    const stateAggregation = await Activity.aggregate([
      {
        $group: {
          _id: "$state",
          meetings: { $sum: 1 },
          villages: { $addToSet: "$village" }
        }
      },
      {
        $project: {
          state: "$_id",
          meetings: 1,
          uniqueVillages: { $size: "$villages" }
        }
      },
      { $sort: { meetings: -1 } }
    ])

    // Get sales by state
    const salesByState = await Sale.aggregate([
      {
        $group: {
          _id: "$state",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      }
    ])

    // Merge data
    const geoData = stateAggregation.map(state => {
      const salesData = salesByState.find(s => s._id === state.state)
      return {
        state: state.state || "Unknown",
        meetings: state.meetings,
        villages: state.uniqueVillages,
        sales: salesData?.totalSales || 0,
        revenue: salesData?.totalRevenue || 0
      }
    })

    res.json(geoData)
  } catch (err) {
    console.error("Geography analytics error:", err)
    res.status(500).json({ error: "Failed to fetch geographic data" })
  }
})

/* ================= ANALYTICS: MONTHLY REPORT ================= */
router.get("/analytics/monthly", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const year = parseInt(req.query.year) || new Date().getFullYear()
    const month = parseInt(req.query.month) || new Date().getMonth() + 1

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const [meetings, sales, samples, attendance] = await Promise.all([
      Activity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate("userId", "name"),

      Sale.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate("userId", "name"),

      Sample.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate("userId", "name"),

      Attendance.find({
        startTime: { $gte: startDate, $lte: endDate }
      }).populate("userId", "name")
    ])

    // Daily breakdown
    const dailyData = {}
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = date.toISOString().split('T')[0]

      dailyData[dateStr] = {
        date: dateStr,
        meetings: 0,
        sales: 0,
        samples: 0,
        revenue: 0,
        distance: 0
      }
    }

    meetings.forEach(m => {
      const dateStr = m.createdAt.toISOString().split('T')[0]
      if (dailyData[dateStr]) dailyData[dateStr].meetings++
    })

    sales.forEach(s => {
      const dateStr = s.createdAt.toISOString().split('T')[0]
      if (dailyData[dateStr]) {
        dailyData[dateStr].sales++
        dailyData[dateStr].revenue += s.totalAmount
      }
    })

    samples.forEach(s => {
      const dateStr = s.createdAt.toISOString().split('T')[0]
      if (dailyData[dateStr]) dailyData[dateStr].samples++
    })

    attendance.forEach(a => {
      const dateStr = a.startTime.toISOString().split('T')[0]
      if (dailyData[dateStr]) dailyData[dateStr].distance += a.totalDistance || 0
    })

    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)
    const totalDistance = attendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)

    // Top performers
    const officerPerformance = {}
    sales.forEach(s => {
      const officerId = s.userId._id.toString()
      if (!officerPerformance[officerId]) {
        officerPerformance[officerId] = {
          name: s.userId.name,
          sales: 0,
          revenue: 0
        }
      }
      officerPerformance[officerId].sales++
      officerPerformance[officerId].revenue += s.totalAmount
    })

    const topPerformers = Object.values(officerPerformance)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    res.json({
      period: { year, month },
      summary: {
        totalMeetings: meetings.length,
        totalSales: sales.length,
        totalSamples: samples.length,
        totalRevenue,
        totalDistance,
        uniqueVillages: [...new Set(meetings.map(m => m.village).filter(Boolean))].length
      },
      dailyData: Object.values(dailyData),
      topPerformers
    })
  } catch (err) {
    console.error("Monthly report error:", err)
    res.status(500).json({ error: "Failed to generate monthly report" })
  }
})

/* ================= MAP DATA: All Activity Locations ================= */
router.get("/map/activities", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const activityType = req.query.type // meeting, sale, sample, all

    let query = {}
    if (activityType && activityType !== 'all') {
      query.activity = activityType.toUpperCase()
    }

    const locations = await LocationLog.find(query)
      .populate("userId", "name")
      .sort({ timestamp: -1 })
      .limit(1000)

    const mapData = locations.map(loc => ({
      lat: loc.location.lat,
      lng: loc.location.lng,
      address: loc.location.address,
      activity: loc.activity,
      officer: loc.userId?.name,
      timestamp: loc.timestamp
    }))

    res.json(mapData)
  } catch (err) {
    console.error("Map data error:", err)
    res.status(500).json({ error: "Failed to fetch map data" })
  }
})

/* ================= DETAILED MEETING VIEW ================= */
router.get("/meeting/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const meeting = await Activity.findById(req.params.id)
      .populate("userId", "name email phone state district")

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" })
    }

    res.json(meeting)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch meeting details" })
  }
})

/* ================= DETAILED SALE VIEW ================= */
router.get("/sale/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const sale = await Sale.findById(req.params.id)
      .populate("userId", "name email phone state district")

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" })
    }

    res.json(sale)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sale details" })
  }
})

/* ================= USER MANAGEMENT ================= */
router.post("/user/create", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const user = await User.create(req.body)
    res.json({ message: "User created", user })
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" })
  }
})

router.patch("/user/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" })
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select("-password")

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" })
  }
})

/* ================= LIVE FIELD OFFICER TRACKING ================= */
router.get("/tracking/live-locations", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin allowed" })
    }

    // Get all active field officers
    const fieldOfficers = await User.find({ role: "FIELD" }).select("-password")

    // Get latest location for each field officer
    const locations = await Promise.all(
      fieldOfficers.map(async (officer) => {
        const latestLocation = await LocationLog.findOne({
          userId: officer._id
        }).sort({ timestamp: -1 })

        const activeAttendance = await Attendance.findOne({
          userId: officer._id,
          endTime: null
        })

        // Get today's distance travelled
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayAttendance = await Attendance.findOne({
          userId: officer._id,
          startTime: { $gte: today }
        }).sort({ startTime: -1 })

        const distanceTravelled = todayAttendance ? (todayAttendance.totalDistance || 0) : 0

        return {
          officer: {
            id: officer._id,
            name: officer.name,
            phone: officer.phone,
            email: officer.email,
            state: officer.state,
            district: officer.district
          },
          location: latestLocation ? latestLocation.location : null,
          timestamp: latestLocation ? latestLocation.timestamp : null,
          accuracy: latestLocation ? latestLocation.accuracy : null,
          activity: latestLocation ? latestLocation.activity : null,
          distanceTravelled: distanceTravelled,
          isActive: !!activeAttendance,
          lastUpdated: latestLocation ? new Date(latestLocation.timestamp).toLocaleString() : "No data"
        }
      })
    )

    res.json(locations)
  } catch (err) {
    console.error("Live tracking error:", err)
    res.status(500).json({ error: "Failed to fetch live locations" })
  }
})

/* ================= GET FIELD OFFICER LOCATION HISTORY ================= */
router.get("/tracking/location-history/:userId", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin allowed" })
    }

    const hours = parseInt(req.query.hours) || 24
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

    const locations = await LocationLog.find({
      userId: req.params.userId,
      timestamp: { $gte: startTime }
    })
      .populate("userId", "name email phone")
      .sort({ timestamp: 1 })

    res.json(locations)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch location history" })
  }
})

/* ================= GET LIVE TRACKING FOR SPECIFIC OFFICER ================= */
router.get("/tracking/officer/:userId", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin allowed" })
    }

    const officer = await User.findById(req.params.userId).select("-password")
    const latestLocation = await LocationLog.findOne({
      userId: req.params.userId
    }).sort({ timestamp: -1 })

    const activeAttendance = await Attendance.findOne({
      userId: req.params.userId,
      endTime: null
    })

    res.json({
      officer: {
        id: officer._id,
        name: officer.name,
        phone: officer.phone,
        email: officer.email,
        state: officer.state,
        district: officer.district
      },
      location: latestLocation ? latestLocation.location : null,
      timestamp: latestLocation ? latestLocation.timestamp : null,
      accuracy: latestLocation ? latestLocation.accuracy : null,
      activity: latestLocation ? latestLocation.activity : null,
      isActive: !!activeAttendance,
      lastUpdated: latestLocation ? new Date(latestLocation.timestamp).toLocaleString() : "No data"
    })
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch officer tracking data" })
  }
})

/* ================= GET ADMIN MESSAGES ================= */
router.get("/messages", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin allowed" })
    }

    const limit = parseInt(req.query.limit) || 100
    const messages = await AdminMessage.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()

    res.json(messages)
  } catch (err) {
    console.error("Get messages error:", err)
    res.status(500).json({ error: "Failed to fetch messages" })
  }
})

/* ================= CREATE ADMIN MESSAGE (from field officer) ================= */
router.post("/messages", auth, async (req, res) => {
  try {
    if (req.user.role !== "FIELD") {
      return res.status(403).json({ error: "Only field officers can create messages" })
    }

    const { text, location, distanceTravelled, status, meetingType } = req.body

    const message = await AdminMessage.create({
      officerId: req.user._id,
      officerName: req.user.name,
      officerPhone: req.user.phone,
      text,
      location,
      distanceTravelled,
      status: status || "UPDATE",
      meetingType
    })

    res.status(201).json(message)
  } catch (err) {
    console.error("Create message error:", err)
    res.status(500).json({ error: "Failed to create message" })
  }
})

export default router