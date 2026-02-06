const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export async function api(endpoint, method = "GET", body = null) {
     const token = localStorage.getItem("token")
     
     const options = {
       method,
       headers: {
         "Content-Type": "application/json",
         ...(token && { Authorization: `Bearer ${token}` })
       },
       ...(body && { body: JSON.stringify(body) })
     }

     const res = await fetch(`${API_URL}${endpoint}`, options)
     const data = await res.json()
     
     if (!res.ok) throw data
     return data
   }