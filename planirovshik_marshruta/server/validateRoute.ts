import { lineString, point } from '@turf/helpers'
import booleanIntersects from '@turf/boolean-intersects'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import circle from '@turf/circle'
import length from '@turf/length'
import {
  landingZone,
  launchZone,
  noFlyZones,
  staticObstacles,
  type CircleZone,
  type LatLng,
} from '../shared/terrain.ts'
import { simulateFlight, type FlightMode } from '../shared/flightSimulation.ts'

type ValidationResult =
  | { ok: true; distanceKm: number }
  | { ok: false; reason: string }

const allBlockingZones = [...noFlyZones, ...staticObstacles]
const toLngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat]
const launchPolygon = circle(toLngLat(launchZone.center), launchZone.radiusMeters / 1000, { units: 'kilometers' })
const landingPolygon = circle(toLngLat(landingZone.center), landingZone.radiusMeters / 1000, { units: 'kilometers' })

function zoneToPolygon(zone: CircleZone) {
  return circle(toLngLat(zone.center), zone.radiusMeters / 1000, { units: 'kilometers', steps: 96 })
}

function isValidLatLng(value: unknown): value is LatLng {
  if (!Array.isArray(value) || value.length !== 2) {
    return false
  }
  const [lat, lng] = value
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function parseRouteCoordinates(payload: unknown): LatLng[] | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = (payload as { coordinates?: unknown }).coordinates
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 120) {
    return null
  }
  const coords = raw.filter(isValidLatLng)
  if (coords.length !== raw.length) {
    return null
  }
  return coords
}

export function parseFlightMode(payload: unknown): FlightMode {
  if (!payload || typeof payload !== 'object') return 'normal'
  const mode = (payload as { mode?: unknown }).mode
  if (mode === 'slow' || mode === 'normal' || mode === 'sport') return mode
  return 'normal'
}

export function validateRoute(route: LatLng[], mode: FlightMode): ValidationResult {
  const start = route[0]
  const finish = route[route.length - 1]

  if (!booleanPointInPolygon(point(toLngLat(start)), launchPolygon)) {
    return { ok: false, reason: 'Маршрут должен начинаться в зоне вылета.' }
  }
  if (!booleanPointInPolygon(point(toLngLat(finish)), landingPolygon)) {
    return { ok: false, reason: 'Маршрут должен заканчиваться в зоне посадки.' }
  }

  const geoLine = lineString(route.map(toLngLat))

  for (const zone of allBlockingZones) {
    const zonePolygon = zoneToPolygon(zone)
    if (booleanIntersects(geoLine, zonePolygon)) {
      return { ok: false, reason: `Маршрут пересекает препятствие: ${zone.label}.` }
    }
  }

  const distanceKm = length(geoLine, { units: 'kilometers' })

  const simulation = simulateFlight(route, { mode })
  if (!simulation.ok) {
    return { ok: false, reason: simulation.reason }
  }

  return { ok: true, distanceKm }
}
