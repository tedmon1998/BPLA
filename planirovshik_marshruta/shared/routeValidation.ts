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
} from './terrain'
import { simulateFlight, type FlightMode } from './flightSimulation'

export const MAX_ROUTE_POINTS = 120

export const ALL_FLIGHT_MODES: FlightMode[] = ['slow', 'normal', 'sport']

export type ValidationResult =
  | { ok: true; distanceKm: number }
  | { ok: false; reason: string }

const allBlockingZones = [...noFlyZones, ...staticObstacles]
const toLngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat]
const launchPolygon = circle(toLngLat(launchZone.center), launchZone.radiusMeters / 1000, { units: 'kilometers' })
const landingPolygon = circle(toLngLat(landingZone.center), landingZone.radiusMeters / 1000, { units: 'kilometers' })

function zoneToPolygon(zone: CircleZone) {
  return circle(toLngLat(zone.center), zone.radiusMeters / 1000, { units: 'kilometers', steps: 96 })
}

/** Геометрия маршрута: старт, финиш, препятствия. */
export function validateRouteGeometry(route: LatLng[]): ValidationResult {
  if (route.length === 0) {
    return { ok: false, reason: 'Поставьте первую точку в зоне вылета.' }
  }
  if (route.length < 2) {
    return { ok: false, reason: 'Добавьте точки маршрута до зоны посадки.' }
  }

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
  return { ok: true, distanceKm }
}

function modesToTry(preferredMode?: FlightMode): FlightMode[] {
  if (!preferredMode) return [...ALL_FLIGHT_MODES]
  return [preferredMode, ...ALL_FLIGHT_MODES.filter((mode) => mode !== preferredMode)]
}

/** Полная проверка: геометрия + симуляция хотя бы в одном режиме (режим в полёте можно менять). */
export function validateRoute(route: LatLng[], preferredMode: FlightMode = 'normal'): ValidationResult {
  const geometry = validateRouteGeometry(route)
  if (!geometry.ok) return geometry

  let lastReason = 'Маршрут не проходит симуляцию полёта.'
  for (const mode of modesToTry(preferredMode)) {
    const simulation = simulateFlight(route, { mode })
    if (simulation.ok) {
      return { ok: true, distanceKm: geometry.distanceKm }
    }
    lastReason = simulation.reason
  }

  return { ok: false, reason: lastReason }
}

export function routePassableInMode(route: LatLng[], mode: FlightMode): boolean {
  if (route.length < 2) return false
  return simulateFlight(route, { mode }).ok
}

export function findPassableFlightMode(route: LatLng[], preferredMode?: FlightMode): FlightMode | null {
  for (const mode of modesToTry(preferredMode)) {
    if (routePassableInMode(route, mode)) return mode
  }
  return null
}
