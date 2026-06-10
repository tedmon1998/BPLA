import { lineString, point } from '@turf/helpers'
import booleanIntersects from '@turf/boolean-intersects'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import circle from '@turf/circle'
import length from '@turf/length'
import {
  chargingStations,
  missionRules,
  noFlyZones,
  staticObstacles,
  windZones,
  type CircleZone,
  type LatLng,
} from './terrain'

export type FlightFrame = {
  position: LatLng
  batteryKm: number
  elapsedMin: number
  speedKmh: number
  phase: 'flight' | 'charging'
}

export type FlightSimulationResult = {
  ok: boolean
  reason: string
  frames: FlightFrame[]
  distanceKm: number
  rechargeCount: number
  elapsedMin: number
}

export type FlightMode = 'slow' | 'normal' | 'sport'

export type FlightSimulationResume = {
  batteryKm: number
  elapsedMin: number
  rechargeCount: number
  chargedZoneIds: readonly string[]
}

export type SimulateFlightOptions = {
  mode?: FlightMode
  resume?: FlightSimulationResume
  skipRoutePreflight?: boolean
}

type ModeProfile = {
  speedMultiplier: number
  energyMultiplier: number
  windSpeedSensitivity: number
  windEnergySensitivity: number
}

const modeProfiles: Record<FlightMode, ModeProfile> = {
  // Slow: battery economy, but wind hurts speed the most.
  slow: { speedMultiplier: 0.72, energyMultiplier: 0.5, windSpeedSensitivity: 1.5, windEnergySensitivity: 0.45 },
  // Normal: balanced profile.
  normal: { speedMultiplier: 1, energyMultiplier: 0.85, windSpeedSensitivity: 1, windEnergySensitivity: 0.85 },
  // Sport: fast and power-hungry, with much lower wind impact on speed.
  sport: { speedMultiplier: 1.3, energyMultiplier: 1.35, windSpeedSensitivity: 0.32, windEnergySensitivity: 0.55 },
}

const toLngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat]

function zonePolygon(zone: CircleZone) {
  return circle(toLngLat(zone.center), zone.radiusMeters / 1000, { units: 'kilometers', steps: 96 })
}

const noFlyPolygons = noFlyZones.map((zone) => ({ zone, polygon: zonePolygon(zone) }))
const obstaclePolygons = staticObstacles.map((zone) => ({ zone, polygon: zonePolygon(zone) }))
const chargingPolygons = chargingStations.map((zone) => ({ zone, polygon: zonePolygon(zone) }))
const windPolygons = windZones.map((zone) => ({ zone, polygon: zonePolygon(zone) }))

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function pointInAnyZone(pos: LatLng, zones: { zone: CircleZone; polygon: ReturnType<typeof zonePolygon> }[]) {
  const p = point(toLngLat(pos))
  for (const item of zones) {
    if (booleanPointInPolygon(p, item.polygon)) return item.zone
  }
  return null
}

function chargingZoneAt(pos: LatLng): CircleZone | null {
  return pointInAnyZone(pos, chargingPolygons)
}

export function countRechargesInFrames(frames: FlightFrame[]): number {
  let count = 0
  let inCharge = false
  for (const frame of frames) {
    if (frame.phase === 'charging' && !inCharge) {
      count += 1
    }
    inCharge = frame.phase === 'charging'
  }
  return count
}

export function collectChargedZoneIds(frames: FlightFrame[]): string[] {
  const ids = new Set<string>()
  let inCharge = false
  for (const frame of frames) {
    if (frame.phase === 'charging') {
      if (!inCharge) {
        const zone = chargingZoneAt(frame.position)
        if (zone) ids.add(zone.id)
      }
      inCharge = true
    } else {
      inCharge = false
    }
  }
  return [...ids]
}

function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return 0
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  return Math.max(0, Math.min(1, t))
}

function dist2(a: LatLng, b: LatLng): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

/** Оставшийся маршрут от текущей позиции дрона до финиша. */
export function sliceRouteFromPosition(route: LatLng[], position: LatLng): LatLng[] {
  if (route.length === 0) return []
  if (route.length === 1) return [position]

  let bestSegment = 0
  let bestT = 0
  let bestDist = Infinity

  for (let i = 0; i < route.length - 1; i += 1) {
    const t = projectOnSegment(position, route[i], route[i + 1])
    const projected = interpolate(route[i], route[i + 1], t)
    const dist = dist2(position, projected)
    if (dist < bestDist) {
      bestDist = dist
      bestSegment = i
      bestT = t
    }
  }

  const startIndex = bestT >= 0.999 ? bestSegment + 1 : bestSegment + 1
  const rest = route.slice(startIndex)
  if (rest.length === 0) return [position]
  if (dist2(position, rest[0]) < 1e-8) return rest
  return [position, ...rest]
}

function findChargingBlockBounds(frames: FlightFrame[], index: number) {
  let start = index
  while (start > 0 && frames[start - 1]?.phase === 'charging') start -= 1
  let end = index
  while (end + 1 < frames.length && frames[end + 1]?.phase === 'charging') end += 1
  const totalTicks = end - start + 1
  const completedTicks = index - start + 1
  const remainingTicks = Math.max(0, totalTicks - completedTicks)
  return { start, end, totalTicks, remainingTicks }
}

function synthesizeRemainingChargeFrames(
  currentFrame: FlightFrame,
  remainingTicks: number,
  totalTicks: number,
): FlightFrame[] {
  if (remainingTicks <= 0 || totalTicks <= 0) return []

  const batteryAtStart = currentFrame.batteryKm
  const targetBattery = missionRules.batteryCapacityKm
  const pos = currentFrame.position
  let elapsed = currentFrame.elapsedMin
  const minutesPerTick = missionRules.chargingMinutes / totalTicks
  const frames: FlightFrame[] = []

  for (let tick = 1; tick <= remainingTicks; tick += 1) {
    const t = tick / remainingTicks
    elapsed += minutesPerTick
    const batteryKm = Math.min(targetBattery, batteryAtStart + (targetBattery - batteryAtStart) * t)
    frames.push({
      position: pos,
      batteryKm,
      elapsedMin: elapsed,
      speedKmh: 0,
      phase: 'charging',
    })
  }

  return frames
}

function mergeContinuation(
  fullRoute: LatLng[],
  played: FlightFrame[],
  resumeFrame: FlightFrame,
  mode: FlightMode,
): FlightSimulationResult {
  const remainingRoute = sliceRouteFromPosition(fullRoute, resumeFrame.position)
  if (remainingRoute.length < 2) {
    return {
      ok: played.length > 0,
      reason: 'Полет завершен.',
      frames: played,
      distanceKm: length(lineString(fullRoute.map(toLngLat)), { units: 'kilometers' }),
      rechargeCount: countRechargesInFrames(played),
      elapsedMin: resumeFrame.elapsedMin,
    }
  }

  const continuation = simulateFlight(remainingRoute, {
    mode,
    skipRoutePreflight: true,
    resume: {
      batteryKm: resumeFrame.batteryKm,
      elapsedMin: resumeFrame.elapsedMin,
      rechargeCount: countRechargesInFrames(played),
      chargedZoneIds: collectChargedZoneIds(played),
    },
  })

  const mergedFrames = [...played, ...continuation.frames.slice(1)]
  return {
    ...continuation,
    frames: mergedFrames,
    distanceKm: length(lineString(fullRoute.map(toLngLat)), { units: 'kilometers' }),
  }
}

export function continueFlightFromFrame(
  fullRoute: LatLng[],
  playedFrames: FlightFrame[],
  flightIndex: number,
  mode: FlightMode,
): FlightSimulationResult {
  const currentFrame = playedFrames[flightIndex]
  if (!currentFrame) {
    return {
      ok: false,
      reason: 'Не удалось продолжить полет: нет текущего кадра.',
      frames: playedFrames,
      distanceKm: 0,
      rechargeCount: 0,
      elapsedMin: 0,
    }
  }

  const played = playedFrames.slice(0, flightIndex + 1)
  return mergeContinuation(fullRoute, played, currentFrame, mode)
}

export function continueFlightWithMode(
  fullRoute: LatLng[],
  playedFrames: FlightFrame[],
  flightIndex: number,
  nextMode: FlightMode,
): FlightSimulationResult {
  const currentFrame = playedFrames[flightIndex]
  if (!currentFrame) {
    return {
      ok: false,
      reason: 'Не удалось переключить режим: нет текущего кадра полета.',
      frames: playedFrames,
      distanceKm: 0,
      rechargeCount: 0,
      elapsedMin: 0,
    }
  }

  if (currentFrame.phase === 'charging') {
    const { remainingTicks, totalTicks } = findChargingBlockBounds(playedFrames, flightIndex)
    const remainingChargeFrames = synthesizeRemainingChargeFrames(currentFrame, remainingTicks, totalTicks)
    const played = [...playedFrames.slice(0, flightIndex + 1), ...remainingChargeFrames]
    const resumeFrame = remainingChargeFrames.length > 0
      ? remainingChargeFrames[remainingChargeFrames.length - 1]!
      : currentFrame

    if (resumeFrame.elapsedMin > missionRules.missionTimeLimitMin) {
      return {
        ok: false,
        reason: `Груз не доставлен: на зарядке потеряно время, лимит ${missionRules.missionTimeLimitMin} мин.`,
        frames: played,
        distanceKm: length(lineString(fullRoute.map(toLngLat)), { units: 'kilometers' }),
        rechargeCount: countRechargesInFrames(played),
        elapsedMin: resumeFrame.elapsedMin,
      }
    }

    return mergeContinuation(fullRoute, played, resumeFrame, nextMode)
  }

  return continueFlightFromFrame(fullRoute, playedFrames, flightIndex, nextMode)
}

export function interruptChargingAt(
  fullRoute: LatLng[],
  playedFrames: FlightFrame[],
  flightIndex: number,
  mode: FlightMode,
): FlightSimulationResult | null {
  const currentFrame = playedFrames[flightIndex]
  if (!currentFrame || currentFrame.phase !== 'charging') return null
  return continueFlightFromFrame(fullRoute, playedFrames, flightIndex, mode)
}

function windMultiplierAt(pos: LatLng): number {
  const p = point(toLngLat(pos))
  let multiplier = 1
  for (const item of windPolygons) {
    if (booleanPointInPolygon(p, item.polygon)) {
      multiplier = Math.min(multiplier, item.zone.speedMultiplier ?? 1)
    }
  }
  return multiplier
}

export function simulateFlight(
  route: LatLng[],
  options?: SimulateFlightOptions,
): FlightSimulationResult {
  const flightMode = options?.mode ?? 'normal'
  const mode = modeProfiles[flightMode]
  const resume = options?.resume
  const skipRoutePreflight = options?.skipRoutePreflight ?? false

  if (route.length < 2) {
    return {
      ok: false,
      reason: 'Дрон не взлетел: слишком короткий маршрут.',
      frames: [],
      distanceKm: 0,
      rechargeCount: 0,
      elapsedMin: 0,
    }
  }

  const totalLine = lineString(route.map(toLngLat))
  const totalDistanceKm = length(totalLine, { units: 'kilometers' })

  if (!skipRoutePreflight) {
    for (const item of noFlyPolygons) {
      if (booleanIntersects(totalLine, item.polygon)) {
        return {
          ok: false,
          reason: `Дрон не долетел: маршрут пересекает бесполетную зону "${item.zone.label}".`,
          frames: [
            {
              position: route[0],
              batteryKm: missionRules.batteryCapacityKm,
              elapsedMin: 0,
              speedKmh: 0,
              phase: 'flight',
            },
          ],
          distanceKm: totalDistanceKm,
          rechargeCount: 0,
          elapsedMin: 0,
        }
      }
    }

    for (const item of obstaclePolygons) {
      if (booleanIntersects(totalLine, item.polygon)) {
        return {
          ok: false,
          reason: `Дрон не долетел: путь пересекает препятствие "${item.zone.label}".`,
          frames: [
            {
              position: route[0],
              batteryKm: missionRules.batteryCapacityKm,
              elapsedMin: 0,
              speedKmh: 0,
              phase: 'flight',
            },
          ],
          distanceKm: totalDistanceKm,
          rechargeCount: 0,
          elapsedMin: 0,
        }
      }
    }
  }

  let batteryKm = resume?.batteryKm ?? missionRules.batteryCapacityKm
  let elapsedMin = resume?.elapsedMin ?? 0
  let rechargeCount = resume?.rechargeCount ?? 0
  let activeChargingZoneId: string | null = null
  const startChargingZone = chargingZoneAt(route[0])
  if (startChargingZone) {
    activeChargingZoneId = startChargingZone.id
  }

  const frames: FlightFrame[] = [
    {
      position: route[0],
      batteryKm,
      elapsedMin,
      speedKmh: missionRules.baseSpeedKmh * mode.speedMultiplier,
      phase: 'flight',
    },
  ]

  for (let i = 0; i < route.length - 1; i += 1) {
    const start = route[i]
    const end = route[i + 1]
    const segmentLine = lineString([toLngLat(start), toLngLat(end)])
    const segmentKm = length(segmentLine, { units: 'kilometers' })
    const steps = Math.max(1, Math.ceil(segmentKm / missionRules.simulationStepKm))

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      const pos = interpolate(start, end, t)
      const perStepKm = segmentKm / steps
      const multiplier = windMultiplierAt(pos)
      const windSpeedFactor = Math.max(0.25, 1 - (1 - multiplier) * mode.windSpeedSensitivity)
      const speedKmh = missionRules.baseSpeedKmh * mode.speedMultiplier * windSpeedFactor
      const energyMultiplier = mode.energyMultiplier * (1 + (1 - multiplier) * mode.windEnergySensitivity)

      batteryKm -= perStepKm * energyMultiplier
      elapsedMin += (perStepKm / Math.max(10, speedKmh)) * 60
      frames.push({ position: pos, batteryKm: Math.max(0, batteryKm), elapsedMin, speedKmh, phase: 'flight' })

      const noFlyHit = pointInAnyZone(pos, noFlyPolygons)
      if (noFlyHit) {
        return {
          ok: false,
          reason: `Дрон сбит: вошел в бесполетную зону "${noFlyHit.label}".`,
          frames,
          distanceKm: totalDistanceKm,
          rechargeCount,
          elapsedMin,
        }
      }

      const obstacleHit = pointInAnyZone(pos, obstaclePolygons)
      if (obstacleHit) {
        return {
          ok: false,
          reason: `Дрон упал: столкновение с препятствием "${obstacleHit.label}".`,
          frames,
          distanceKm: totalDistanceKm,
          rechargeCount,
          elapsedMin,
        }
      }

      if (batteryKm <= 0) {
        return {
          ok: false,
          reason: 'Дрон упал: батарея разрядилась до 0%.',
          frames,
          distanceKm: totalDistanceKm,
          rechargeCount,
          elapsedMin,
        }
      }

      if (elapsedMin > missionRules.missionTimeLimitMin) {
        return {
          ok: false,
          reason: `Груз не доставлен: дрон не успел в лимит ${missionRules.missionTimeLimitMin} мин.`,
          frames,
          distanceKm: totalDistanceKm,
          rechargeCount,
          elapsedMin,
        }
      }

      const stationHit = pointInAnyZone(pos, chargingPolygons)
      if (!stationHit) {
        activeChargingZoneId = null
      } else if (activeChargingZoneId !== stationHit.id) {
        activeChargingZoneId = stationHit.id
        rechargeCount += 1
        const chargingTicks = Math.max(1, Math.ceil(missionRules.chargingMinutes / 1))
        const startBattery = batteryKm
        for (let tick = 1; tick <= chargingTicks; tick += 1) {
          const t = tick / chargingTicks
          elapsedMin += missionRules.chargingMinutes / chargingTicks
          batteryKm = startBattery + (missionRules.batteryCapacityKm - startBattery) * t
          frames.push({
            position: pos,
            batteryKm,
            elapsedMin,
            speedKmh: 0,
            phase: 'charging',
          })
        }
        if (elapsedMin > missionRules.missionTimeLimitMin) {
          return {
            ok: false,
            reason: `Груз не доставлен: на зарядке потеряно время, лимит ${missionRules.missionTimeLimitMin} мин.`,
            frames,
            distanceKm: totalDistanceKm,
            rechargeCount,
            elapsedMin,
          }
        }
      }
    }
  }

  return {
    ok: true,
    reason: `Полет успешен: ${rechargeCount} зарядок, время ${elapsedMin.toFixed(1)} мин.`,
    frames,
    distanceKm: totalDistanceKm,
    rechargeCount,
    elapsedMin,
  }
}
