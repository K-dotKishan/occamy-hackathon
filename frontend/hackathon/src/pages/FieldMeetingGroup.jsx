import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { X } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export default function FieldMeetingGroup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    village: "",
    district: "",
    state: "",
    attendeesCount: 0,
    meetingType: "DEMO",
    notes: ""
  })
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.village || !formData.attendeesCount) {
      alert("Please fill in all required fields")
      return
    }

    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const formDataToSend = new FormData()
          
          const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          formDataToSend.append('location', JSON.stringify(location))
          formDataToSend.append('type', 'GROUP')
          formDataToSend.append('village', formData.village)
          formDataToSend.append('district', formData.district)
          formDataToSend.append('state', formData.state)
          formDataToSend.append('attendeesCount', formData.attendeesCount)
          formDataToSend.append('meetingType', formData.meetingType)
          formDataToSend.append('notes', formData.notes)

          photos.forEach(photo => {
            formDataToSend.append('photos', photo)
          })

          await fetch(`${API_URL}/field/meeting/group`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formDataToSend
          })

          alert("Group Meeting logged successfully!")
          navigate("/field-dashboard")
        } catch (err) {
          alert("Failed to log meeting")
        } finally {
          setLoading(false)
        }
      },
      () => {
        alert("Location permission denied")
        setLoading(false)
      }
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-gray-800">Group Meeting</h2>
            <button 
              onClick={() => navigate("/field-dashboard")}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Village *</label>
              <input
                type="text"
                value={formData.village}
                onChange={e => setFormData({...formData, village: e.target.value})}
                placeholder="Enter village name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={e => setFormData({...formData, district: e.target.value})}
                  placeholder="District"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => setFormData({...formData, state: e.target.value})}
                  placeholder="State"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Number of Attendees *</label>
              <input
                type="number"
                min="1"
                value={formData.attendeesCount}
                onChange={e => setFormData({...formData, attendeesCount: e.target.value})}
                placeholder="0"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Type</label>
              <select
                value={formData.meetingType}
                onChange={e => setFormData({...formData, meetingType: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              >
                <option value="DEMO">Demo</option>
                <option value="TRAINING">Training</option>
                <option value="FEEDBACK">Feedback</option>
                <option value="AWARENESS">Awareness</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Add meeting notes..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => navigate("/field-dashboard")}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? "Saving..." : "Log Meeting"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
