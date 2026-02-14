import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import { auth, googleProvider, isFirebaseConfigured } from "../firebase"
import { signInWithPopup } from "firebase/auth"
import { Leaf, Mail, Lock, User, Phone, Eye, EyeOff, Sparkles, Shield, Globe, ArrowRight, CheckCircle, Zap } from "lucide-react"

export default function Login() {
  const navigate = useNavigate()
  const [isSignup, setIsSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Social Login Simulation State
  const [showSocialModal, setShowSocialModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(null)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "USER"
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  /* ================= HYBRID SOCIAL LOGIN ================= */
  // Handles both Real Firebase (if configured) and Simulation (fallback)
  const handleSocialLogin = async (providerName) => {
    // 1. If Firebase is configured, use Real Auth
    if (isFirebaseConfigured && providerName === "Google") {
      setIsLoading(true)
      try {
        const result = await signInWithPopup(auth, googleProvider)
        const user = result.user

        // Backend Trust Handshake
        const data = await api("/auth/mock-social-login", "POST", {
          email: user.email,
          provider: "Google"
        })

        completeLogin(data)

      } catch (err) {
        console.error("Firebase Error:", err)
        setIsLoading(false)
        if (err.code !== 'auth/popup-closed-by-user') {
          // Fallback to simulation if technical error (optional)
          console.warn("Falling back to simulation due to error")
          openSimulationModal(providerName)
        }
      }
      return
    }

    // 2. Fallback: Simulation Mode
    openSimulationModal(providerName)
  }

  const openSimulationModal = (provider) => {
    setSelectedProvider(provider)
    setShowSocialModal(true)
  }

  const confirmSocialLogin = async () => {
    setIsLoading(true)
    setShowSocialModal(false)

    try {
      await new Promise(r => setTimeout(r, 600)) // Sim delay

      // Mock login always succeeds in simulation
      const data = await api("/auth/mock-social-login", "POST", { provider: selectedProvider })

      completeLogin(data)
    } catch (err) {
      console.error(err)
      setIsLoading(false)
      alert("Login failed: " + (err.error || err.message))
    }
  }

  const completeLogin = (data) => {
    localStorage.setItem("token", data.token)
    localStorage.setItem("role", data.role)

    setTimeout(() => {
      setIsLoading(false)
      navigate("/dashboard")
    }, 800)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignup) {
        await api("/auth/signup", "POST", formData)
        setTimeout(() => {
          setIsLoading(false)
          alert("Account created successfully! Please login.")
          setIsSignup(false)
          setFormData({ name: "", phone: "", email: "", password: "", role: "USER" })
        }, 1500)
      } else {
        const data = await api("/auth/login", "POST", {
          email: formData.email,
          password: formData.password
        })
        completeLogin(data)
      }
    } catch (err) {
      setIsLoading(false)
      alert(err.error || "Authentication failed")
    }
  }

  /* ================= PASSWORD RESET LOGIC ================= */
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [resetStep, setResetStep] = useState(1)
  const [resetEmail, setResetEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      const res = await api("/auth/forgot-password", "POST", { email: resetEmail })
      if (res.demoToken) {
        setResetToken(res.demoToken)
        alert(`DEMO: Token is ${res.demoToken} (Check console also)`)
      }
      setResetStep(2)
    } catch (err) {
      alert(err.error || "Failed to send reset link")
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      await api("/auth/reset-password", "POST", {
        email: resetEmail,
        token: resetToken,
        newPassword
      })
      alert("Password reset successful! Please login.")
      setShowForgotModal(false)
      setResetStep(1)
      setResetEmail("")
      setResetToken("")
      setNewPassword("")
    } catch (err) {
      alert(err.error || "Failed to reset password")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex items-center justify-center p-4 lg:p-8 overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob lg:w-96 lg:h-96"></div>
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 lg:w-96 lg:h-96"></div>
        <div className="absolute -bottom-20 left-1/4 w-60 h-60 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 lg:w-96 lg:h-96"></div>

        {/* Additional large screen decorations */}
        <div className="hidden lg:block absolute top-1/4 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
        <div className="hidden lg:block absolute bottom-1/3 left-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-ping animation-delay-1000"></div>
        <div className="hidden lg:block absolute top-1/2 right-1/3 w-2 h-2 bg-teal-400 rounded-full animate-ping animation-delay-2000"></div>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-md lg:max-w-7xl">
        {/* Two Column Layout - Desktop Only */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">

          {/* LEFT SIDE - Brand Section - Desktop Only */}
          <div className="hidden lg:block animate-slideInLeft">
            <div className="relative lg:min-h-[800px] flex items-center">
              {/* Main Brand Card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-white/50 relative overflow-hidden">
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 pointer-events-none"></div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Logo Section */}
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl shadow-2xl mb-6 transform hover:rotate-12 hover:scale-110 transition-all duration-500 animate-float">
                      <Leaf size={56} className="text-white" />
                    </div>
                    <h1 className="text-5xl font-black text-gray-800 mb-3 tracking-tight">OCCAMY</h1>
                    <p className="text-xl text-gray-600 font-medium">Sustainable Agriculture Solutions</p>
                    <div className="w-20 h-1.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mx-auto mt-4"></div>
                  </div>

                  {/* Stats Section */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl transform hover:scale-105 transition-transform duration-300">
                      <div className="text-3xl font-black text-green-600 mb-1">10K+</div>
                      <div className="text-xs text-gray-600 font-medium">Active Users</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl transform hover:scale-105 transition-transform duration-300">
                      <div className="text-3xl font-black text-emerald-600 mb-1">50+</div>
                      <div className="text-xs text-gray-600 font-medium">Countries</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-green-50 rounded-2xl transform hover:scale-105 transition-transform duration-300">
                      <div className="text-3xl font-black text-teal-600 mb-1">99%</div>
                      <div className="text-xs text-gray-600 font-medium">Satisfaction</div>
                    </div>
                  </div>

                  {/* Feature Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl transform hover:scale-105 hover:shadow-lg transition-all duration-300 group">
                      <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-3 group-hover:rotate-12 transition-transform duration-300">
                        <Shield className="text-green-600" size={24} />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">Secure Platform</h3>
                      <p className="text-sm text-gray-600">Bank-grade encryption</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 rounded-2xl transform hover:scale-105 hover:shadow-lg transition-all duration-300 group">
                      <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-3 group-hover:rotate-12 transition-transform duration-300">
                        <Globe className="text-emerald-600" size={24} />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">Global Network</h3>
                      <p className="text-sm text-gray-600">Connect worldwide</p>
                    </div>

                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-5 rounded-2xl transform hover:scale-105 hover:shadow-lg transition-all duration-300 group">
                      <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-3 group-hover:rotate-12 transition-transform duration-300">
                        <Sparkles className="text-teal-600" size={24} />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">AI-Powered</h3>
                      <p className="text-sm text-gray-600">Smart insights</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl transform hover:scale-105 hover:shadow-lg transition-all duration-300 group">
                      <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-3 group-hover:rotate-12 transition-transform duration-300">
                        <Zap className="text-green-600" size={24} />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">Lightning Fast</h3>
                      <p className="text-sm text-gray-600">Real-time updates</p>
                    </div>
                  </div>

                  {/* Testimonial Carousel */}
                  <div className="relative">
                    <div className="bg-gradient-to-r from-green-100 via-emerald-100 to-teal-100 p-6 rounded-2xl shadow-lg transform hover:scale-102 transition-all duration-300">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          RK
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-gray-700 italic leading-relaxed mb-2">
                            "OCCAMY has completely transformed how we manage our farm. The platform is incredibly intuitive and the AI insights have boosted our productivity by 40%."
                          </p>
                          <p className="text-sm text-gray-600 font-semibold">— Rajesh Kumar, <span className="text-green-600">Progressive Farmer</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Decorative quotes */}
                    <div className="absolute -top-3 -left-3 text-6xl text-green-200 opacity-50 font-serif">"</div>
                  </div>

                  {/* Trust Badges */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>ISO Certified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>SOC 2 Compliant</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>GDPR Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl opacity-20 blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-gradient-to-br from-teal-400 to-green-500 rounded-3xl opacity-20 blur-2xl animate-pulse animation-delay-2000"></div>
            </div>
          </div>

          {/* RIGHT SIDE - Form Section */}
          <div className="lg:animate-slideInRight lg:min-h-[800px] lg:flex lg:flex-col lg:justify-center">
            {/* Logo Section - Mobile Only */}
            <div className="text-center mb-6 md:mb-8 lg:hidden">
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 max-w-[420px] mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl md:rounded-3xl shadow-lg md:shadow-2xl mb-3 md:mb-4 transform hover:rotate-12 transition-transform duration-500">
                <Leaf size={32} className="text-white md:text-3xl" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-1 md:mb-2">OCCAMY</h1>
              <p className="text-sm md:text-base text-gray-600 font-medium">Sustainable Agriculture Solutions</p>

              {/* Feature Highlights - Cleaned up for mobile */}
              <div className="flex flex-wrap justify-center gap-2 mt-3 md:mt-4 max-w-[420px] mx-auto">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <Shield size={12} />
                  Secure
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  <Globe size={12} />
                  Global
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                  <Sparkles size={12} />
                  Modern
                </span>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-xl md:shadow-2xl p-5 md:p-8 lg:p-10 border border-white/50 lg:border-2 lg:border-white/70 relative overflow-hidden lg:h-full lg:flex lg:flex-col lg:justify-center">
              {/* Gradient overlay for large screens */}
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-br from-green-50/30 via-transparent to-emerald-50/30 pointer-events-none"></div>

              {/* Content */}
              <div className="relative z-10">
                {/* Form Toggle */}
                <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl md:rounded-2xl lg:shadow-inner">
                  <button
                    onClick={() => setIsSignup(false)}
                    className={`flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${!isSignup
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md md:shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                      }`}
                  >
                    <span>Login</span>
                    {!isSignup && <ArrowRight size={16} className="animate-pulse" />}
                  </button>
                  <button
                    onClick={() => setIsSignup(true)}
                    className={`flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${isSignup
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md md:shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                      }`}
                  >
                    <span>Sign Up</span>
                    {isSignup && <ArrowRight size={16} className="animate-pulse" />}
                  </button>
                </div>

                {/* Form Title */}
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mb-5 md:mb-6 text-center">
                  {isSignup ? "Create Your Account" : "Welcome Back"}
                  <div className="w-12 h-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mx-auto mt-2"></div>
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                  {isSignup && (
                    <>
                      <EnhancedInputField
                        icon={<User size={18} className="md:w-5 md:h-5" />}
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />

                      <EnhancedInputField
                        icon={<Phone size={18} className="md:w-5 md:h-5" />}
                        type="tel"
                        name="phone"
                        placeholder="Phone Number"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </>
                  )}

                  <EnhancedInputField
                    icon={<Mail size={18} className="md:w-5 md:h-5" />}
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />

                  <div className="relative">
                    <EnhancedInputField
                      icon={<Lock size={18} className="md:w-5 md:h-5" />}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 rounded-lg hover:bg-gray-100"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {isSignup && (
                    <div className="relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3">
                        Account Type
                      </label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full px-4 py-3 pl-12 text-sm md:text-base border-2 border-gray-200 rounded-lg md:rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all bg-white appearance-none hover:border-gray-300 cursor-pointer"
                      >
                        <option value="USER">👤 Customer (Buy Products)</option>
                        <option value="FIELD">🚜 Field Officer</option>
                      </select>
                      <div className="absolute right-3 top-[50%] pointer-events-none text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 md:py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg md:rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group relative overflow-hidden"
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{isSignup ? "Creating Account..." : "Logging in..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{isSignup ? "Create Account" : "Login to Dashboard"}</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Forgot Password - Only on Login */}
                  {!isSignup && (
                    <div className="text-right">
                      <button
                        type="button"
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors hover:underline"
                        onClick={() => setShowForgotModal(true)}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </form>

                {/* Divider */}
                <div className="flex items-center my-6 md:my-8">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  <span className="px-3 text-sm text-gray-500 font-medium">Or continue with</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                  <button
                    type="button"
                    className="py-2.5 md:py-3 bg-white border-2 border-gray-300 rounded-lg md:rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 transform hover:shadow-md"
                    onClick={() => handleSocialLogin("Google")}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="text-sm md:text-base">Google</span>
                  </button>
                  <button
                    type="button"
                    className="py-2.5 md:py-3 bg-white border-2 border-gray-300 rounded-lg md:rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 transform hover:shadow-md"
                    onClick={() => handleSocialLogin("Microsoft")}
                  >
                    <svg className="w-5 h-5" fill="#00A4EF" viewBox="0 0 24 24">
                      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                    </svg>
                    <span className="text-sm md:text-base">Microsoft</span>
                  </button>
                </div>

                {/* Toggle Text */}
                <div className="text-center">
                  <p className="text-sm md:text-base text-gray-600">
                    {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                      onClick={() => setIsSignup(!isSignup)}
                      className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors inline-flex items-center gap-1 group"
                    >
                      {isSignup ? "Login here" : "Sign up here"}
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 md:mt-8">
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs md:text-sm text-gray-500 mb-3">
                <a href="#" className="hover:text-emerald-600 transition-colors font-medium">Privacy Policy</a>
                <a href="#" className="hover:text-emerald-600 transition-colors font-medium">Terms of Service</a>
                <a href="#" className="hover:text-emerald-600 transition-colors font-medium">Contact Support</a>
              </div>
              <p className="text-xs md:text-sm text-gray-500">
                © 2024 OCCAMY Bioscience. All rights reserved.
              </p>
            </div>

            {/* Floating Success Indicator */}
            {isLoading && (
              <div className="fixed md:absolute bottom-4 md:bottom-auto md:top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slideInRight flex items-center gap-2 z-50">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">{isSignup ? "Creating account..." : "Logging in..."}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Reset Password</h3>
              <button onClick={() => setShowForgotModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors hover:rotate-90 transform duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {resetStep === 1 ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-600">Enter your email address to receive a password reset link.</p>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {resetLoading ? "Sending Link..." : "Send Reset Link"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-gray-600">Enter the token sent to your email and your new password.</p>
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded text-xs mb-2 border border-yellow-200">
                  ℹ️ Simulation: Token is logged in server console
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter Token"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {resetLoading ? "Resetting..." : "Set New Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SOCIAL LOGIN SIMULATION MODAL */}
      {showSocialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-scaleIn overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 text-center">
              {selectedProvider === 'Google' && (
                <div className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
              )}
              {selectedProvider === 'Microsoft' && (
                <div className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="#00A4EF" viewBox="0 0 24 24">
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                  </svg>
                </div>
              )}
              <h3 className="text-lg font-medium text-gray-800">Sign in with {selectedProvider}</h3>
              <p className="text-sm text-gray-500 mt-1">Choose an account to continue to <br /> <span className="font-semibold text-emerald-600">OCCAMY Bioscience</span></p>
            </div>

            {/* Account List */}
            <div className="p-2">
              <button
                onClick={confirmSocialLogin}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  D
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Demo User</p>
                  <p className="text-xs text-gray-500">demo@example.com</p>
                </div>
              </button>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={confirmSocialLogin}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Use another account</p>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
              <button
                onClick={() => setShowSocialModal(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Cancel
              </button>
            </div>
            {/* Gradient Line */}
            <div className="h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Space */}
      <div className="h-16 md:h-0"></div>

      {/* Enhanced Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInLeft {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-slideInUp {
          animation: slideInUp 0.5s ease-out;
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        /* Custom scrollbar */
        select {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }
        
        /* Enhanced focus styles */
        input:focus, select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
        
        /* Better touch targets */
        @media (max-width: 640px) {
          button, input, select {
            min-height: 44px;
          }
          
          input, select, textarea {
            font-size: 16px;
          }
          
          * {
            -webkit-tap-highlight-color: transparent;
          }
        }
        
        /* Autofill styles */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important;
          -webkit-text-fill-color: #1f2937 !important;
        }

        /* Smooth scale on hover */
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  )
}

function EnhancedInputField({ icon, ...props }) {
  return (
    <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors duration-300">
        {icon}
      </div>
      <input
        {...props}
        className="w-full px-4 py-3 pl-11 text-sm md:text-base border-2 border-gray-200 rounded-lg md:rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all duration-300 bg-white placeholder-gray-400 group-hover:border-gray-300 lg:hover:shadow-md"
      />
      {/* Focus glow effect */}
      <div className="absolute inset-0 rounded-lg md:rounded-xl border-2 border-transparent group-focus-within:border-emerald-300 pointer-events-none transition-all duration-300 group-focus-within:shadow-lg group-focus-within:shadow-emerald-100"></div>
    </div>
  )
}