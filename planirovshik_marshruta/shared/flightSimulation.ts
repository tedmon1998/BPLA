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
  options?: { mode?: FlightMode },
): FlightSimulationResult {
  const flightMode = options?.mode ?? 'normal'
  const mode = modeProfiles[flightMode]

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

  let batteryKm = missionRules.batteryCapacityKm
  let elapsedMin = 0
  let rechargeCount = 0
  let activeChargingZoneId: string | null = null
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
