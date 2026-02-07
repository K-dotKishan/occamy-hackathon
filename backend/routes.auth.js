import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User } from "./models.js"

const router = express.Router()

/* ================= SIGNUP ================= */
router.post("/signup", async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body

    // 1. Validate mandatory fields
    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: "All fields are required" })
    }

    // 2. Normalize inputs (Lowercase email, trim whitespace)
    const cleanPhone = phone.trim()
    const cleanEmail = email.trim().toLowerCase()

    // 3. Check for existing users (Phone or Email)
    const existing = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { email: cleanEmail }
      ]
    })

    if (existing) {
      return res.status(400).json({ error: "User with this email or phone already exists" })
    }

    // 4. Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10)

    // 5. Create user (Force role to uppercase to match frontend checks)
    const newUser = await User.create({
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password: hashedPassword,
      role: (role || "USER").toUpperCase()
    })

    res.status(201).json({ message: "Signup successful" })

  } catch (err) {
    console.error("Signup error details:", err)
    res.status(500).json({ error: "Signup failed due to server error" })
  }
})

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    // 2. Normalize and find user
    const cleanEmail = email.trim().toLowerCase()
    const user = await User.findOne({ email: cleanEmail })

    if (!user) {
      // Use generic error for security
      return res.status(401).json({ error: "Invalid email or password" })
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    // 4. Generate JWT Token
    // Payload includes ID and Role for use in the 'auth' middleware
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    // 5. Return success response
    // IMPORTANT: 'role' is sent explicitly so frontend can handle redirection
    res.json({
      token,
      role: user.role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    })

  } catch (err) {
    console.error("Login error details:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

/* ================= FORGOT PASSWORD (SIMULATED) ================= */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // SIMULATION: Generate a dummy token
    const resetToken = Math.random().toString(36).substring(7)

    // In a real app, successful save would trigger email
    // Here we just log it
    console.log(`\n==========================================`)
    console.log(`🔐 PASSWORD RESET REQUEST`)
    console.log(`👤 User: ${user.email}`)
    console.log(`🎫 Token: ${resetToken}`)
    console.log(`🔗 Link: http://localhost:5173/reset-password?token=${resetToken}`)
    console.log(`==========================================\n`)

    // We send the token back to client ONLY for testing/demo purposes
    // In production, you'd never do this
    res.json({
      message: "Password reset link sent to email (Check Server Console)",
      demoToken: resetToken
    })

  } catch (err) {
    console.error("Forgot password error:", err)
    res.status(500).json({ error: "Failed to process request" })
  }
})

/* ================= RESET PASSWORD ================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // SIMULATION: Accept any token for now since we don't save it to DB
    // In production, verify token against DB/Redis

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    await user.save()

    res.json({ message: "Password reset successful! Please login." })

  } catch (err) {
    console.error("Reset password error:", err)
    res.status(500).json({ error: "Failed to reset password" })
  }
})

export default router