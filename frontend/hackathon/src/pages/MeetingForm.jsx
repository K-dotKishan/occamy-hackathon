import { useState } from "react"
import { api } from "../api"

export default function MeetingForm({ onClose }) {
  const [meetingType, setMeetingType] = useState("ONE_TO_ONE")
  const [category, setCategory] = useState("Farmer")
  const [notes, setNotes] = useState("")

  const submit = async () => {
    await api("/field/meeting", "POST", {
      meetingType,
      category,
      notes
    })
    alert("Meeting logged")
    onClose()
  }

  return (
    <div className="bg-white p-6 rounded shadow mt-6">
      <h3 className="font-bold mb-4">Log Meeting</h3>

      <label>Meeting Type</label>
      <select
        className="border p-2 w-full mb-3"
        onChange={e => setMeetingType(e.target.value)}
      >
        <option value="ONE_TO_ONE">One to One</option>
        <option value="GROUP">Group (One to Many)</option>
      </select>

      <label>Category</label>
      <select
        className="border p-2 w-full mb-3"
        onChange={e => setCategory(e.target.value)}
      >
        <option>Farmer</option>
        <option>Seller</option>
        <option>Influencer</option>
      </select>

      <textarea
        className="border p-2 w-full mb-3"
        placeholder="Notes"
        onChange={e => setNotes(e.target.value)}
      />

      <button
        onClick={submit}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Save Meeting
      </button>
    </div>
  )
}
