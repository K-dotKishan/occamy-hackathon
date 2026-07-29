import express from "express"
import { signup, login, forgotPassword, mockSocialLogin, resetPassword, getMe } from "../controllers/authController.js"
import auth from "../middleware/auth.js"

const router = express.Router()

router.post("/signup", signup)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.post("/mock-social-login", mockSocialLogin)
router.post("/reset-password", resetPassword)
router.get("/me", auth, getMe)

export default router
