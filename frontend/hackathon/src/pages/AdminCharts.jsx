import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"

export default function AdminCharts({ stats }) {
  const data = [
    { name: "Users", value: stats.totalUsers },
    { name: "Meetings", value: stats.totalMeetings },
    { name: "Sales", value: stats.totalSales },
    { name: "Samples", value: stats.totalSamples }
  ]

  return (
    <div className="bg-white p-6 rounded shadow">
      <h3 className="font-bold mb-4">Operations Overview</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
