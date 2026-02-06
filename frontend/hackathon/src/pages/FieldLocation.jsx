import { useState } from "react"
import { api } from "../api"

export default function FieldLocation() {
  const [location, setLocation] = useState(null)

  function getLocation() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        })
      },
      err => alert("Location permission denied")
    )
  }

  async function startDay() {
    if (!location) return alert("Get location first")

    await api("/field/attendance/start", "POST", {
      location
    })

    alert("Day started with location logged")
  }

  return (
    <div className="bg-white p-6 rounded shadow space-y-4">
      <button
        onClick={getLocation}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Get My Location
      </button>

      {location && (
        <>
          <iframe
            title="map"
            width="100%"
            height="250"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
            className="rounded"
          />

          <button
            onClick={startDay}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Start Day
          </button>
        </>
      )}
    </div>
  )
}
