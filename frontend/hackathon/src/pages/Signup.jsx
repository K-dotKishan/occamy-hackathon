import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Signup() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "USER" // USER or FIELD only
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://localhost:5000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Signup failed")
        setLoading(false)
        return
      }

      alert("Signup successful. Please login.")
      navigate("/login")
    } catch (err) {
      setError("Server error. Try again.")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center text-green-700 mb-4">
          Create Account
        </h2>

        <p className="text-sm text-center text-gray-500 mb-6">
          Signup as a User or Field Officer
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 text-sm p-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-green-300"
          />

          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            required
            value={form.phone}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-green-300"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-green-300"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-green-300"
          />

          {/* ROLE SELECTION (NO ADMIN) */}
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-green-300"
          >
            <option value="USER">User (Buy / Sell Products)</option>
            <option value="FIELD">Field Officer / Distributor</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <span
            className="text-green-700 cursor-pointer hover:underline"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  )
}
