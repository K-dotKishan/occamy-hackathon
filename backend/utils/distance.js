export function getDistanceKm(lat1, lon1, lat2, lon2) {

  const R = 6371

  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180

  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

export function totalKm(path = []) {

  let total = 0

  for (let i = 1; i < path.length; i++) {

    total += getDistanceKm(
      path[i-1].lat,
      path[i-1].lng,
      path[i].lat,
      path[i].lng
    )

  }

  return Number(total.toFixed(2))
}
