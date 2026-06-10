import type { FlightMode } from '../shared/flightSimulation.ts'
import type { LatLng } from '../shared/terrain.ts'
import { validateRoute, validateRouteGeometry } from '../shared/routeValidation.ts'

export { validateRoute, validateRouteGeometry }

export function parseFlightMode(payload: unknown): FlightMode {
  if (!payload || typeof payload !== 'object') return 'normal'
  const mode = (payload as { mode?: unknown }).mode
  if (mode === 'slow' || mode === 'normal' || mode === 'sport') return mode
  return 'normal'
}

export function parseRouteCoordinates(payload: unknown): LatLng[] | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = (payload as { coordinates?: unknown }).coordinates
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 120) {
    return null
  }
  const coords: LatLng[] = []
  for (const value of raw) {
    if (!Array.isArray(value) || value.length !== 2) return null
    const [lat, lng] = value
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null
    }
    coords.push([lat, lng])
  }
  return coords
}
