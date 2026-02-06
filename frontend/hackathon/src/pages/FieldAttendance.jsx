import { useState } from "react"
import { api } from "../api"

export default function FieldAttendance() {
  const [location, setLocation] = useState(null)

  const startDay = () => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        setLocation(coords)

        await api("/field/attendance/start", "POST", {
          location: coords
        })

        alert("Attendance started")
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Attendance</h2>

      <button
        onClick={startDay}
        className="bg-blue-600 text-white px-4 py-2 rounded font-bold"
      >
        Start Day (GPS)
      </button>

      {location && (
        <div className="mt-4 text-sm">
          <p><b>Lat:</b> {location.lat}</p>
          <p><b>Lng:</b> {location.lng}</p>
        </div>
      )}
    </div>
  )
}
