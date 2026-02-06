export function geoFenceCheck(data){

  const CENTER = {
    lat: 28.6139,
    lng: 77.2090,
    radius: 5000
  }

  const R = 6371e3
  const φ1 = data.lat * Math.PI/180
  const φ2 = CENTER.lat * Math.PI/180
  const Δφ = (CENTER.lat - data.lat) * Math.PI/180
  const Δλ = (CENTER.lng - data.lng) * Math.PI/180

  const a =
    Math.sin(Δφ/2)**2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2)**2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c

  if(distance > CENTER.radius){
    console.log("🚨 GEO FENCE BREACH:", data.userId)
  }

}
