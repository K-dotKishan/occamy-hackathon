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

     const res = await fetch(`http://localhost:5000${endpoint}`, options)
     const data = await res.json()
     
     if (!res.ok) throw data
     return data
   }