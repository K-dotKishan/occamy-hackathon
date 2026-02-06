import { useEffect, useState, useRef } from "react"
import { MapPin, RefreshCw, Users, Activity, Clock } from "lucide-react"
import { api } from "../api"

export default function LiveTrackingMap() {
  const [liveLocations, setLiveLocations] = useState([])
  const [selectedOfficer, setSelectedOfficer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshRate, setRefreshRate] = useState(10) // seconds
  const mapRef = useRef(null)
  const refreshIntervalRef = useRef(null)
  const markersRef = useRef({})
  const mapInstanceRef = useRef(null)

  // Load live locations
  const loadLiveLocations = async () => {
    try {
      setLoading(true)
      const data = await api("/admin/tracking/live-locations")
      setLiveLocations(data || [])
      
      if (data && data.length > 0 && !selectedOfficer) {
        setSelectedOfficer(data[0].officer.id)
      }
    } catch (err) {
      console.error("Failed to load live locations:", err)
    } finally {
      setLoading(false)
    }
  }

  // Initialize and update map
  useEffect(() => {
    loadLiveLocations()

    // Set up auto-refresh
    refreshIntervalRef.current = setInterval(() => {
      loadLiveLocations()
    }, refreshRate * 1000)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [refreshRate])

  // Update map when locations change
  useEffect(() => {
    if (!liveLocations || liveLocations.length === 0) return

    // Initialize map if not already done
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 20, lng: 78 }, // Center of India
        mapTypeId: "roadmap"
      })
    }

    if (mapInstanceRef.current) {
      // Clear old markers
      Object.values(markersRef.current).forEach(marker => marker.setMap(null))
      markersRef.current = {}

      // Add new markers
      const bounds = new window.google.maps.LatLngBounds()

      liveLocations.forEach(item => {
        if (item.location && item.location.lat && item.location.lng) {
          const position = { lat: item.location.lat, lng: item.location.lng }

          // Create marker with custom icon
          const marker = new window.google.maps.Marker({
            position,
            map: mapInstanceRef.current,
            title: item.officer.name,
            icon: item.isActive
              ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
              : "http://maps.google.com/mapfiles/ms/icons/gray-dot.png",
            animation: item.isActive ? window.google.maps.Animation.DROP : null
          })

          // Create info window
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 10px; font-size: 12px;">
                <strong>${item.officer.name}</strong><br/>
                📱 ${item.officer.phone}<br/>
                📍 ${item.location.address || `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`}<br/>
                ⏱️ ${item.lastUpdated}<br/>
                📊 Activity: ${item.activity}<br/>
                ✓ ${item.isActive ? "Active" : "Inactive"}
              </div>
            `
          })

          marker.addListener("click", () => {
            // Close all other info windows
            Object.values(markersRef.current).forEach(m => {
              if (m.infoWindow) m.infoWindow.close()
            })
            infoWindow.open(mapInstanceRef.current, marker)
          })

          marker.infoWindow = infoWindow
          markersRef.current[item.officer.id] = marker

          bounds.extend(position)
        }
      })

      // Fit bounds if we have locations
      if (liveLocations.some(l => l.location)) {
        mapInstanceRef.current.fitBounds(bounds)
      }
    }
  }, [liveLocations])

  const activeCount = liveLocations.filter(l => l.isActive).length
  const inactiveCount = liveLocations.length - activeCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <MapPin className="text-blue-600" size={28} />
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Live Field Officer Tracking</h3>
              <p className="text-sm text-gray-500">Real-time GPS locations of all field officers</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadLiveLocations}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mb-1">
              <Users size={18} />
              Total Officers
            </div>
            <p className="text-3xl font-bold text-blue-600">{liveLocations.length}</p>
          </div>

          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
              <Activity size={18} />
              Currently Active
            </div>
            <p className="text-3xl font-bold text-green-600">{activeCount}</p>
          </div>

          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700 font-semibold mb-1">
              <Clock size={18} />
              Inactive
            </div>
            <p className="text-3xl font-bold text-orange-600">{inactiveCount}</p>
          </div>
        </div>

        {/* Refresh Rate Control */}
        <div className="mt-4 pt-4 border-t flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Auto-refresh every:</label>
          <select
            value={refreshRate}
            onChange={(e) => setRefreshRate(parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
          </select>
        </div>
      </div>

      {/* Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3">
          <div
            ref={mapRef}
            className="w-full h-[500px] rounded-lg shadow border border-gray-200"
            style={{ minHeight: "500px" }}
          >
            {!window.google && (
              <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                <p className="text-gray-500">⚠️ Google Maps not loaded. Please add your API key.</p>
              </div>
            )}
          </div>
        </div>

        {/* Officers List Sidebar */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 font-bold">
            Field Officers ({liveLocations.length})
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {liveLocations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p>No field officers found</p>
              </div>
            ) : (
              liveLocations.map((item) => (
                <div
                  key={item.officer.id}
                  onClick={() => setSelectedOfficer(item.officer.id)}
                  className={`p-4 cursor-pointer transition hover:bg-gray-50 border-l-4 ${
                    selectedOfficer === item.officer.id
                      ? "bg-blue-50 border-blue-600"
                      : "border-transparent"
                  } ${item.isActive ? "bg-green-50" : ""}`}
                >
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    {item.officer.name}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">📱 {item.officer.phone}</p>
                  <p className="text-xs text-gray-500">📍 {item.officer.district}</p>

                  {item.location && (
                    <>
                      <p className="text-xs text-gray-600 mt-2 font-mono">
                        {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
                      </p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">
                        {item.activity || "TRAVEL"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Updated: {item.lastUpdated}
                      </p>
                    </>
                  )}

                  {item.distanceTravelled && (
                    <p className="text-xs text-green-600 font-semibold mt-2 bg-green-50 p-2 rounded">
                      📊 Distance: {item.distanceTravelled.toFixed(2)} km
                    </p>
                  )}

                  {item.accuracy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Accuracy: ±{item.accuracy}m
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
        <p className="text-sm text-blue-800">
          <strong>📍 Live Tracking:</strong> Shows real-time GPS positions of all field officers on duty. 
          Blue markers indicate active officers, gray markers show inactive ones. 
          Click on an officer to see their details and location history.
        </p>
      </div>
    </div>
  )
}
