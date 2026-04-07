import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import { lineString } from '@turf/helpers'
import length from '@turf/length'
import booleanIntersects from '@turf/boolean-intersects'
import circle from '@turf/circle'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import L from 'leaflet'
import {
  chargingStations,
  landingZone,
  launchZone,
  missionRules,
  noFlyZones,
  staticObstacles,
  windZones,
  yugraMapCenter,
  type LatLng,
  type CircleZone,
} from '../shared/terrain'
import { simulateFlight, type FlightMode, type FlightSimulationResult } from '../shared/flightSimulation'
import './App.css'

type ApiResult = { ok: boolean; message: string; key?: string }
type ActivationResponse = { ok: boolean; token?: string; expiresAt?: number; message?: string }
type ClientValidation = { ok: true } | { ok: false; reason: string }

const allBlockingZones = [...noFlyZones, ...staticObstacles]
const allVisualZones = [...noFlyZones, ...staticObstacles, ...chargingStations, ...windZones]
const modeLabel: Record<FlightMode, string> = {
  slow: 'Медленный',
  normal: 'Нормальный',
  sport: 'Спорт',
}

const modeRuntimeProfile: Record<FlightMode, { speedScale: number; drainPerKm: number }> = {
  slow: { speedScale: 0.72, drainPerKm: 0.62 },
  normal: { speedScale: 1, drainPerKm: 1 },
  sport: { speedScale: 1.3, drainPerKm: 1.3 },
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload)
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }
  const candidates = window.location.protocol === 'file:' ? [`http://localhost:8787${path}`] : [path, `http://localhost:8787${path}`]
  let lastError: unknown
  for (const url of candidates) {
    try {
      const response = await fetch(url, init)
      return (await response.json()) as T
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Network error')
}

function zoneColor(zone: CircleZone) {
  if (zone.kind === 'no-fly') return '#ff4d4f'
  if (zone.kind === 'charging') return '#f59f00'
  if (zone.kind === 'wind') return '#74c0fc'
  return '#2f9e44'
}

function zoneFill(zone: CircleZone) {
  if (zone.kind === 'no-fly') return 0.35
  if (zone.kind === 'charging') return 0.28
  if (zone.kind === 'wind') return 0.22
  return 0.3
}

function zoneEmoji(zone: CircleZone) {
  if (zone.kind === 'no-fly') return '🚫'
  if (zone.kind === 'charging') return '⚡'
  if (zone.kind === 'wind') return '💨'
  return '🌲'
}

const droneIcon = L.divIcon({
  className: 'drone-icon',
  html: '<div>🚁</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const cityIcon = L.divIcon({
  className: 'city-icon',
  html: '<div>📍</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const chargingDroneIcon = L.divIcon({
  className: 'charging-drone-icon',
  html: '<div>⚡🚁</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const toLngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat]

function MapClickCapture({ onPoint }: { onPoint: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPoint([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

function zonePolygon(zone: CircleZone) {
  return circle(toLngLat(zone.center), zone.radiusMeters / 1000, {
    units: 'kilometers',
    steps: 96,
  })
}

function validateOnClient(route: LatLng[]): ClientValidation {
  if (route.length < 2) return { ok: false, reason: 'Добавьте минимум 2 точки маршрута.' }
  const routeLine = lineString(route.map(toLngLat))
  for (const zone of allBlockingZones) {
    if (booleanIntersects(routeLine, zonePolygon(zone))) {
      return { ok: false, reason: `Пересечение препятствия: ${zone.label}.` }
    }
  }

  const startsCorrectly = booleanPointInPolygon(
    point(toLngLat(route[0])),
    circle(toLngLat(launchZone.center), launchZone.radiusMeters / 1000, { units: 'kilometers' }),
  )
  const endsCorrectly = booleanPointInPolygon(
    point(toLngLat(route[route.length - 1])),
    circle(toLngLat(landingZone.center), landingZone.radiusMeters / 1000, { units: 'kilometers' }),
  )
  if (!startsCorrectly) return { ok: false, reason: 'Первая точка должна быть в зоне вылета.' }
  if (!endsCorrectly) return { ok: false, reason: 'Последняя точка должна быть в зоне посадки.' }

  return { ok: true }
}

function blockedByObstacle(route: LatLng[]): string | null {
  if (route.length === 0) return null

  const last = route[route.length - 1]
  for (const zone of allBlockingZones) {
    if (booleanPointInPolygon(point(toLngLat(last)), zonePolygon(zone))) {
      return `Дрон не долетел: точка попала в препятствие "${zone.label}".`
    }
  }

  if (route.length < 2) return null
  const segment = route.slice(-2)
  const segmentLine = lineString(segment.map(([lat, lng]) => [lng, lat]))
  for (const zone of allBlockingZones) {
    if (booleanIntersects(segmentLine, zonePolygon(zone))) {
      return `Дрон не долетел: новый участок пересекает "${zone.label}".`
    }
  }
  return null
}

function buildFlightPath(route: LatLng[]): LatLng[] {
  if (route.length < 2) return route
  const flightPoints: LatLng[] = []
  for (let i = 0; i < route.length - 1; i += 1) {
    const [aLat, aLng] = route[i]
    const [bLat, bLng] = route[i + 1]
    const steps = 28
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
      flightPoints.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t])
    }
  }
  flightPoints.push(route[route.length - 1])
  return flightPoints
}

function App() {
  const [route, setRoute] = useState<LatLng[]>([])
  const [status, setStatus] = useState<string>('Поставьте первую точку в зоне вылета (Ханты-Мансийск).')
  const [key, setKey] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [flightPath, setFlightPath] = useState<LatLng[]>([])
  const [flightIndex, setFlightIndex] = useState(0)
  const [isFlying, setIsFlying] = useState(false)
  const [batteryLeftKm, setBatteryLeftKm] = useState(missionRules.batteryCapacityKm)
  const [elapsedMin, setElapsedMin] = useState(0)
  const [rechargeCount, setRechargeCount] = useState(0)
  const [crashPoint, setCrashPoint] = useState<LatLng | null>(null)
  const [pendingResult, setPendingResult] = useState<FlightSimulationResult | null>(null)
  const [flightMode, setFlightMode] = useState<FlightMode>('normal')
  const [activationInput, setActivationInput] = useState('')
  const [activationToken, setActivationToken] = useState<string | null>(null)
  const [activationExpiresAt, setActivationExpiresAt] = useState<number | null>(null)
  const [activationNow, setActivationNow] = useState(Date.now())
  const [activationError, setActivationError] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const batteryPercent = Math.max(
    0,
    Math.min(100, (batteryLeftKm / missionRules.batteryCapacityKm) * 100),
  )
  const currentFrame = pendingResult?.frames[flightIndex] ?? null
  const isChargingNow = isFlying && currentFrame?.phase === 'charging'
  const isActivated = Boolean(activationToken && activationExpiresAt && activationExpiresAt > activationNow)
  const activationSecondsLeft = activationExpiresAt ? Math.max(0, Math.floor((activationExpiresAt - activationNow) / 1000)) : 0
  const chargingProgressPercent = useMemo(() => {
    if (!pendingResult || !isChargingNow) return 0
    let start = flightIndex
    while (start > 0 && pendingResult.frames[start - 1]?.phase === 'charging') start -= 1
    let end = flightIndex
    while (end + 1 < pendingResult.frames.length && pendingResult.frames[end + 1]?.phase === 'charging') end += 1
    const total = Math.max(1, end - start + 1)
    const done = flightIndex - start + 1
    return Math.round((done / total) * 100)
  }, [pendingResult, isChargingNow, flightIndex])

  const preview = useMemo(() => validateOnClient(route), [route])

  const distanceKm = useMemo(() => {
    if (route.length < 2) return 0
    return length(lineString(route.map(toLngLat)), { units: 'kilometers' })
  }, [route])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivationNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activationExpiresAt && activationExpiresAt <= activationNow) {
      setActivationToken(null)
      setActivationExpiresAt(null)
      setStatus('Время попытки истекло. Требуется повторная активация.')
      setIsFlying(false)
      setFlightPath([])
      setFlightIndex(0)
    }
  }, [activationExpiresAt, activationNow])

  const activateAttempt = async () => {
    setActivationError('')
    setIsActivating(true)
    try {
      const payload = await apiPost<ActivationResponse>('/api/activate', { code: activationInput })
      if (!payload.ok || !payload.token || !payload.expiresAt) {
        setActivationError(payload.message ?? 'Активация не удалась.')
        return
      }
      setActivationToken(payload.token)
      setActivationExpiresAt(payload.expiresAt)
      setActivationInput('')
      setStatus('Попытка активирована. Можно запускать миссию.')
    } catch {
      setActivationError('Ошибка сети при активации. Запустите API сервер или electron:dev.')
    } finally {
      setIsActivating(false)
    }
  }

  const endAttempt = async () => {
    const token = activationToken
    setActivationToken(null)
    setActivationExpiresAt(null)
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setKey('')
    setStatus('Попытка завершена. Введите код активации снова.')
    if (!token) return
    try {
      await apiPost<{ ok: boolean }>('/api/end-attempt', { token })
    } catch {
      // no-op
    }
  }

  const addRoutePoint = (pointValue: LatLng) => {
    const candidate = [...route, pointValue]
    const blockedMessage = blockedByObstacle(candidate)
    if (blockedMessage) {
      setStatus(blockedMessage)
      return
    }
    setRoute(candidate)
    setStatus('Точка добавлена. Продолжайте маршрут.')
    setKey('')
  }

  const undoLastPoint = () => {
    if (route.length === 0) return
    setRoute((prev) => prev.slice(0, -1))
    setStatus('Последняя точка удалена.')
    setKey('')
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setCrashPoint(null)
    setPendingResult(null)
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightMode('normal')
  }

  const clearRoute = () => {
    setRoute([])
    setStatus('Маршрут очищен.')
    setKey('')
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setCrashPoint(null)
    setPendingResult(null)
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightMode('normal')
  }

  const submitRoute = async () => {
    setKey('')
    if (!isActivated || !activationToken) {
      setStatus('Сначала активируйте попытку кодом доступа.')
      return
    }
    if (!preview.ok) {
      setStatus(preview.reason)
      return
    }

    const simulation = simulateFlight(route, { mode: flightMode })
    setPendingResult(simulation)
    const sampledPath = simulation.frames.length > 0 ? simulation.frames.map((frame) => frame.position) : buildFlightPath(route)
    setCrashPoint(null)
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightPath(sampledPath)
    setFlightIndex(0)
    setIsFlying(true)
    setStatus('Полет начат: выполняется расчет ветра, батареи и времени.')

    setIsSubmitting(true)
    try {
      const payload = await apiPost<ApiResult>('/api/validate-route', {
        coordinates: route,
        mode: flightMode,
        token: activationToken,
      })
      setStatus(payload.message)
      if (payload.ok && payload.key) {
        setKey(payload.key ?? '')
      }
    } catch {
      setStatus('Ошибка сети. Проверьте API сервер.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const setModeDuringFlight = (nextMode: FlightMode) => {
    if (nextMode === flightMode) return
    setFlightMode(nextMode)
    if (!isFlying) return
    setStatus(`Режим переключен: ${modeLabel[nextMode]}. Полет продолжается.`)
  }

  const interruptCharging = () => {
    if (!pendingResult || !isChargingNow) return

    let jumpTo = flightIndex + 1
    while (jumpTo < pendingResult.frames.length && pendingResult.frames[jumpTo]?.phase === 'charging') {
      jumpTo += 1
    }
    setFlightIndex(Math.min(jumpTo, pendingResult.frames.length - 1))
    setStatus('Зарядка прервана вручную. Полет продолжается с текущим зарядом.')
  }

  useEffect(() => {
    if (!isFlying || flightPath.length === 0) return
    const sim = pendingResult
    if (!sim) return
    const next = flightIndex + 1
    if (next >= flightPath.length) {
      setIsFlying(false)
      setRechargeCount(sim.rechargeCount)
      const finalElapsed = sim.frames[sim.frames.length - 1]?.elapsedMin ?? elapsedMin
      if (batteryLeftKm <= 0) {
        const last = sim.frames[sim.frames.length - 1]
        if (last) setCrashPoint(last.position)
        setStatus('Дрон упал: батарея разрядилась до 0%.')
      } else if (finalElapsed > missionRules.missionTimeLimitMin) {
        setStatus(`Груз не доставлен: дрон не успел в лимит ${missionRules.missionTimeLimitMin} мин.`)
      } else {
        setStatus(`Дрон долетел до Сургута. Зарядок: ${sim.rechargeCount}, время: ${finalElapsed.toFixed(1)} мин.`)
      }
      return
    }

    const currentElapsed = sim.frames[flightIndex]?.elapsedMin ?? 0
    const nextElapsed = sim.frames[next]?.elapsedMin ?? currentElapsed
    const deltaMin = Math.max(0.05, nextElapsed - currentElapsed)
    // Make mode switch visually obvious during flight:
    // slow = clearly slower animation, sport = clearly faster animation.
    // Playback timing follows simulated mission time only (independent of mode switch UI).
    const delayMs = Math.max(12, Math.min(900, deltaMin * 220))

    const timer = window.setTimeout(() => {
      const prevFrame = sim.frames[flightIndex]
      const nextFrame = sim.frames[next]
      if (!prevFrame || !nextFrame) return

      const modeProfile = modeRuntimeProfile[flightMode]
      let nextBattery = batteryLeftKm
      if (nextFrame.phase === 'charging') {
        const chargeKmPerMinute = missionRules.batteryCapacityKm / missionRules.chargingMinutes
        const chargeGain = Math.max(0, deltaMin * chargeKmPerMinute)
        nextBattery = Math.min(missionRules.batteryCapacityKm, batteryLeftKm + chargeGain)
      } else {
        const stepDistanceKm = length(
          lineString([toLngLat(prevFrame.position), toLngLat(nextFrame.position)]),
          { units: 'kilometers' },
        )
        const expectedModeSpeed = missionRules.baseSpeedKmh * modeProfile.speedScale
        const windPenalty = Math.min(2.1, Math.max(1, expectedModeSpeed / Math.max(1, nextFrame.speedKmh)))
        const drainKm = stepDistanceKm * modeProfile.drainPerKm * windPenalty
        nextBattery = Math.max(0, batteryLeftKm - drainKm)
      }

      setBatteryLeftKm(nextBattery)
      setElapsedMin(nextFrame.elapsedMin)
      if (nextBattery <= 0) {
        setIsFlying(false)
        setCrashPoint(nextFrame.position)
        setStatus('Дрон упал: батарея разрядилась в текущем режиме полета.')
        return
      }
      setFlightIndex(next)
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [isFlying, flightPath, pendingResult, flightIndex, flightMode, batteryLeftKm, elapsedMin])

  if (!isActivated) {
    return (
      <main className="layout">
        <section className="panel activation-panel">
          <h1>Активация доступа</h1>
          <p>Введите код доступа, чтобы запустить попытку. На попытку дается 20 минут.</p>
          <div className="activation-row">
            <input
              className="activation-input"
              type="password"
              value={activationInput}
              onChange={(event) => setActivationInput(event.target.value)}
              placeholder="Код доступа"
            />
            <button type="button" onClick={activateAttempt} disabled={isActivating || activationInput.trim().length === 0}>
              {isActivating ? 'Проверка...' : 'Активировать'}
            </button>
          </div>
          {activationError && <p className="error">{activationError}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="layout">
      <header className="panel">
        <h1>Мультяшный планировщик БПЛА: Ханты-Мансийск - Сургут</h1>
        <p>
          Постройте маршрут кликами: старт в Ханты-Мансийске, финиш в Сургуте, без пересечений с
          бесполетными зонами, домами и тайгой.
        </p>
      </header>

      <section className="map-wrap">
        <MapContainer center={yugraMapCenter} zoom={8} className="map cartoon-map" attributionControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickCapture onPoint={addRoutePoint} />

          <Circle
            center={launchZone.center}
            radius={launchZone.radiusMeters}
            pathOptions={{ color: '#1c7ed6', fillOpacity: 0.2 }}
          />
          <Circle
            center={landingZone.center}
            radius={landingZone.radiusMeters}
            pathOptions={{ color: '#364fc7', fillOpacity: 0.2 }}
          />

          {allVisualZones.map((zone) => (
            <Circle
              key={`${zone.id}-circle`}
              center={zone.center}
              radius={zone.radiusMeters}
              pathOptions={{ color: zoneColor(zone), fillOpacity: zoneFill(zone) }}
            />
          ))}

          {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#111827', weight: 4 }} />}
          {allVisualZones.map((zone) => (
            <Marker key={`${zone.id}-emoji`} position={zone.center} icon={L.divIcon({
              className: 'obstacle-icon',
              html: `<div>${zoneEmoji(zone)}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })} />
          ))}
          <Marker position={launchZone.center} icon={cityIcon} />
          <Marker position={landingZone.center} icon={cityIcon} />
          {isFlying && flightPath[flightIndex] && (
            <Marker
              position={flightPath[flightIndex]}
              icon={isChargingNow ? chargingDroneIcon : droneIcon}
            />
          )}
          {crashPoint && <Marker position={crashPoint} icon={L.divIcon({
            className: 'crash-icon',
            html: '<div>💥</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })} />}
        </MapContainer>
      </section>

      <section className="panel controls">
        <div className="metrics">
          <strong>Точек:</strong> {route.length} | <strong>Длина:</strong> {distanceKm.toFixed(3)} км
        </div>
        <div className="metrics">
          <strong>Осталось попытки:</strong> {Math.floor(activationSecondsLeft / 60)
            .toString()
            .padStart(2, '0')}
          :
          {(activationSecondsLeft % 60).toString().padStart(2, '0')}
        </div>
        <div className="metrics">
          <strong>Режим:</strong> {modeLabel[flightMode]}
        </div>
        <div className="metrics">
          <strong>Батарея:</strong> {batteryLeftKm.toFixed(1)} км | <strong>Лимит времени:</strong>{' '}
          {missionRules.missionTimeLimitMin} мин | <strong>Прошло:</strong>{' '}
          {pendingResult ? `${elapsedMin.toFixed(1)} мин` : 'скрыто до запуска'} | <strong>Зарядок:</strong>{' '}
          {pendingResult ? rechargeCount : '-'}
        </div>
        <div className="battery">
          <div className="battery-top">
            <strong>Уровень заряда</strong>
            <span>{batteryPercent.toFixed(0)}%</span>
          </div>
          <div className="battery-bar">
            <div
              className={`battery-fill ${batteryPercent < 25 ? 'low' : batteryPercent < 55 ? 'mid' : 'high'}`}
              style={{ width: `${batteryPercent}%` }}
            />
          </div>
        </div>
        {isChargingNow && (
          <p className="charging-state">
            Идет зарядка... {chargingProgressPercent}% (время продолжает идти)
          </p>
        )}
        <p className={preview.ok ? 'ok' : 'error'}>{preview.ok ? 'Маршрут выглядит валидным.' : preview.reason}</p>
        <p>{status}</p>
        <div className="actions">
          {!isFlying && (
            <button type="button" onClick={undoLastPoint} disabled={route.length === 0}>
              Удалить последнюю точку
            </button>
          )}
          {!isFlying && (
            <button type="button" onClick={clearRoute} disabled={route.length === 0}>
              Очистить маршрут
            </button>
          )}
          <button type="button" onClick={endAttempt}>
            Закончить попытку
          </button>
          <button type="button" onClick={submitRoute} disabled={route.length < 2 || isSubmitting}>
            {isSubmitting ? 'Проверка...' : 'Запуск проверки'}
          </button>
          {isFlying && (
            <button
              type="button"
              onClick={() => setModeDuringFlight('slow')}
              disabled={!pendingResult}
              className={`mode-btn ${flightMode === 'slow' ? 'active active-slow' : ''}`}
            >
              Медленный
            </button>
          )}
          {isFlying && (
            <button
              type="button"
              onClick={() => setModeDuringFlight('normal')}
              disabled={!pendingResult}
              className={`mode-btn ${flightMode === 'normal' ? 'active active-normal' : ''}`}
            >
              Нормальный
            </button>
          )}
          {isFlying && (
            <button
              type="button"
              onClick={() => setModeDuringFlight('sport')}
              disabled={!pendingResult}
              className={`mode-btn ${flightMode === 'sport' ? 'active active-sport' : ''}`}
            >
              Спорт
            </button>
          )}
          {isFlying && (
            <button type="button" onClick={interruptCharging} disabled={!isChargingNow} className="charge-stop-btn">
              🔌✖ Прервать зарядку
            </button>
          )}
        </div>
        {key && (
          <div className="key-box">
            <span>Ключ миссии:</span>
            <code>{key}</code>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
