import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  continueFlightWithMode,
  countRechargesInFrames,
  interruptChargingAt,
  simulateFlight,
  type FlightMode,
  type FlightSimulationResult,
} from '../shared/flightSimulation'
import { findPassableFlightMode } from '../shared/routeValidation'
import {
  MdDeleteSweep,
  MdFlightTakeoff,
  MdStopCircle,
  MdUndo,
  MdVpnKey,
} from 'react-icons/md'
import { TbClock, TbPlane, TbPlugOff, TbRocket } from 'react-icons/tb'
import './App.css'

type ApiResult = { ok: boolean; message: string; key?: string }
type ActivationResponse = { ok: boolean; token?: string; expiresAt?: number; message?: string }
type ClientValidation = { ok: true } | { ok: false; reason: string }

const KEY_VISIBILITY_MS = 15_000

const allBlockingZones = [...noFlyZones, ...staticObstacles]
const allVisualZones = [...noFlyZones, ...staticObstacles, ...chargingStations, ...windZones]
const modeLabel: Record<FlightMode, string> = {
  slow: 'Медленный',
  normal: 'Нормальный',
  sport: 'Спорт',
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
  className: 'drone-icon leaflet-div-icon',
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
  className: 'charging-drone-icon leaflet-div-icon',
  html: '<div>⚡🚁</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

function DroneMarker({ position, icon }: { position: LatLng; icon: L.DivIcon }) {
  const markerRef = useRef<L.Marker>(null)

  useEffect(() => {
    markerRef.current?.setLatLng(position)
  }, [position])

  return <Marker ref={markerRef} position={position} icon={icon} zIndexOffset={1200} />
}

const toLngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat]

function MapClickCapture({ onPoint, disabled }: { onPoint: (point: LatLng) => void; disabled?: boolean }) {
  useMapEvents({
    click(event) {
      if (disabled) return
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
  const [keyExpiresAt, setKeyExpiresAt] = useState<number | null>(null)
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
  const flightVerdictRef = useRef<{ ok: boolean; message: string; key?: string } | null>(null)
  const flightRouteRef = useRef<LatLng[]>([])
  const activationTokenRef = useRef<string | null>(activationToken)
  activationTokenRef.current = activationToken
  const expiryHandledRef = useRef(false)
  const keyExpiryHandledRef = useRef(false)
  const flightModeRef = useRef<FlightMode>(flightMode)
  flightModeRef.current = flightMode
  const isRouteEditingLocked = isFlying || isSubmitting
  const batteryPercent = Math.max(
    0,
    Math.min(100, (batteryLeftKm / missionRules.batteryCapacityKm) * 100),
  )
  const currentFrame = pendingResult?.frames[flightIndex] ?? null
  const isChargingNow = isFlying && currentFrame?.phase === 'charging'
  const isActivated = Boolean(activationToken && activationExpiresAt && activationExpiresAt > activationNow)
  const activationSecondsLeft = activationExpiresAt ? Math.max(0, Math.floor((activationExpiresAt - activationNow) / 1000)) : 0
  const keySecondsLeft = keyExpiresAt ? Math.max(0, Math.ceil((keyExpiresAt - activationNow) / 1000)) : 0
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

  const flightPreview = useMemo(() => {
    if (route.length < 2 || !preview.ok) return null
    const current = simulateFlight(route, { mode: flightMode })
    if (current.ok) {
      return { kind: 'ok' as const, sim: current, mode: flightMode }
    }
    const passableMode = findPassableFlightMode(route, flightMode)
    if (passableMode) {
      return { kind: 'switchable' as const, sim: current, passableMode }
    }
    return { kind: 'fail' as const, sim: current }
  }, [route, flightMode, preview.ok])

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

  const clearMissionKey = () => {
    setKey('')
    setKeyExpiresAt(null)
    keyExpiryHandledRef.current = false
  }

  const showMissionKey = (missionKey: string) => {
    keyExpiryHandledRef.current = false
    setKey(missionKey)
    setKeyExpiresAt(Date.now() + KEY_VISIBILITY_MS)
  }

  const resetGameState = () => {
    setRoute([])
    clearMissionKey()
    setIsSubmitting(false)
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setCrashPoint(null)
    setPendingResult(null)
    flightVerdictRef.current = null
    flightRouteRef.current = []
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightMode('normal')
  }

  const finishAttempt = async (statusMessage: string, token: string | null) => {
    resetGameState()
    setActivationToken(null)
    setActivationExpiresAt(null)
    setStatus(statusMessage)
    if (!token) return
    try {
      await apiPost<{ ok: boolean }>('/api/end-attempt', { token })
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (!activationExpiresAt || activationExpiresAt > activationNow) {
      expiryHandledRef.current = false
      return
    }
    if (expiryHandledRef.current) return
    expiryHandledRef.current = true
    const token = activationTokenRef.current
    void finishAttempt('Время попытки истекло. Ключ сброшен. Введите код активации снова.', token)
  }, [activationExpiresAt, activationNow])

  useEffect(() => {
    if (!keyExpiresAt || keyExpiresAt > activationNow) {
      if (!keyExpiresAt) keyExpiryHandledRef.current = false
      return
    }
    if (keyExpiryHandledRef.current) return
    keyExpiryHandledRef.current = true
    const token = activationTokenRef.current
    void finishAttempt('Время на ключ истекло. Введите код активации снова.', token)
  }, [keyExpiresAt, activationNow])

  const activateAttempt = async () => {
    setActivationError('')
    setIsActivating(true)
    try {
      const payload = await apiPost<ActivationResponse>('/api/activate', { code: activationInput })
      if (!payload.ok || !payload.token || !payload.expiresAt) {
        setActivationError(payload.message ?? 'Активация не удалась.')
        return
      }
      expiryHandledRef.current = false
      setActivationToken(payload.token)
      setActivationExpiresAt(payload.expiresAt)
      setActivationInput('')
      resetGameState()
      setStatus('Попытка активирована. Можно запускать миссию.')
    } catch {
      setActivationError('Ошибка сети при активации. Запустите API сервер или electron:dev.')
    } finally {
      setIsActivating(false)
    }
  }

  const endAttempt = async () => {
    await finishAttempt('Попытка завершена. Введите код активации снова.', activationToken)
  }

  const addRoutePoint = (pointValue: LatLng) => {
    if (isRouteEditingLocked) return
    const candidate = [...route, pointValue]
    const blockedMessage = blockedByObstacle(candidate)
    if (blockedMessage) {
      setStatus(blockedMessage)
      return
    }
    setRoute(candidate)
    setStatus('Точка добавлена. Продолжайте маршрут.')
    clearMissionKey()
  }

  const undoLastPoint = () => {
    if (route.length === 0) return
    setRoute((prev) => prev.slice(0, -1))
    setStatus('Последняя точка удалена.')
    clearMissionKey()
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setCrashPoint(null)
    setPendingResult(null)
    flightVerdictRef.current = null
    flightRouteRef.current = []
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightMode('normal')
  }

  const undoLastPointRef = useRef(undoLastPoint)
  undoLastPointRef.current = undoLastPoint

  useEffect(() => {
    if (!isActivated) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return

      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      if (isRouteEditingLocked || route.length === 0) return

      event.preventDefault()
      undoLastPointRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActivated, isRouteEditingLocked, route.length])

  const clearRoute = () => {
    setRoute([])
    setStatus('Маршрут очищен.')
    clearMissionKey()
    setIsFlying(false)
    setFlightPath([])
    setFlightIndex(0)
    setCrashPoint(null)
    setPendingResult(null)
    flightVerdictRef.current = null
    flightRouteRef.current = []
    setBatteryLeftKm(missionRules.batteryCapacityKm)
    setElapsedMin(0)
    setRechargeCount(0)
    setFlightMode('normal')
  }

  const beginFlightAnimation = (routePoints: LatLng[], mode: FlightMode) => {
    const simulation = simulateFlight(routePoints, { mode })
    const sampledPath =
      simulation.frames.length > 0
        ? simulation.frames.map((frame) => frame.position)
        : buildFlightPath(routePoints)
    if (sampledPath.length === 0) {
      setIsFlying(false)
      setFlightPath([])
      setFlightIndex(0)
      setPendingResult(null)
      setStatus('Не удалось построить траекторию полета.')
      return
    }
    setPendingResult(simulation)
    flightRouteRef.current = [...routePoints]
    setCrashPoint(null)
    const firstFrame = simulation.frames[0]
    setBatteryLeftKm(firstFrame?.batteryKm ?? missionRules.batteryCapacityKm)
    setElapsedMin(firstFrame?.elapsedMin ?? 0)
    setRechargeCount(0)
    setFlightPath(sampledPath)
    setFlightIndex(0)
    setIsFlying(true)
  }

  const requestMissionKey = async (): Promise<boolean> => {
    const token = activationTokenRef.current
    const routePoints = flightRouteRef.current
    if (!token || routePoints.length < 2) return false

    try {
      const payload = await apiPost<ApiResult>('/api/validate-route', {
        coordinates: routePoints,
        mode: flightModeRef.current,
        token,
      })
      flightVerdictRef.current = {
        ok: payload.ok,
        message: payload.message,
        key: payload.key,
      }
      if (payload.ok && payload.key) {
        showMissionKey(payload.key)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const claimMissionKeyAfterFlight = async (): Promise<boolean> => {
    const token = activationTokenRef.current
    const routePoints = flightRouteRef.current
    if (!token || routePoints.length < 2) return false

    try {
      const payload = await apiPost<ApiResult>('/api/claim-mission-key', {
        coordinates: routePoints,
        token,
      })
      flightVerdictRef.current = {
        ok: payload.ok,
        message: payload.message,
        key: payload.key,
      }
      if (payload.ok && payload.key) {
        showMissionKey(payload.key)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const grantKeyAfterLanding = async (): Promise<boolean> => {
    if (flightVerdictRef.current?.ok && flightVerdictRef.current.key) {
      showMissionKey(flightVerdictRef.current.key)
      return true
    }
    if (await requestMissionKey()) return true
    return claimMissionKeyAfterFlight()
  }

  const submitRoute = async () => {
    clearMissionKey()
    if (isFlying || isSubmitting) return
    if (!isActivated || !activationToken) {
      setStatus('Сначала активируйте попытку кодом доступа.')
      return
    }
    if (!preview.ok) {
      setStatus(preview.reason)
      return
    }

    const routeSnapshot = [...route]
    setIsSubmitting(true)
    setStatus('Проверка маршрута на сервере...')
    try {
      const payload = await apiPost<ApiResult>('/api/validate-route', {
        coordinates: routeSnapshot,
        mode: flightMode,
        token: activationToken,
      })

      flightVerdictRef.current = {
        ok: payload.ok,
        message: payload.message,
        key: payload.key,
      }

      const skipFlightAnimation =
        !payload.ok &&
        (payload.message.includes('Сессия активации') ||
          payload.message.includes('Слишком много попыток') ||
          payload.message.includes('Некорректный'))

      if (skipFlightAnimation) {
        setIsFlying(false)
        setFlightPath([])
        setFlightIndex(0)
        setPendingResult(null)
        clearMissionKey()
        setStatus(payload.message)
        return
      }

      beginFlightAnimation(routeSnapshot, flightMode)

      if (payload.ok) {
        setStatus(`Полет начат. ${payload.message}`)
      } else {
        clearMissionKey()
        setStatus(payload.message)
      }
    } catch {
      flightVerdictRef.current = null
      flightRouteRef.current = []
      setIsFlying(false)
      setFlightPath([])
      setFlightIndex(0)
      setPendingResult(null)
      setStatus('Ошибка сети. Проверьте API сервер.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const setModeDuringFlight = (nextMode: FlightMode) => {
    if (nextMode === flightMode) return
    if (!isFlying || !pendingResult || flightRouteRef.current.length < 2) {
      setFlightMode(nextMode)
      return
    }

    const currentFrame = pendingResult.frames[flightIndex]
    if (!currentFrame) {
      setFlightMode(nextMode)
      return
    }

    const merged = continueFlightWithMode(flightRouteRef.current, pendingResult.frames, flightIndex, nextMode)
    setPendingResult(merged)
    setFlightPath(merged.frames.map((frame) => frame.position))
    setBatteryLeftKm(currentFrame.batteryKm)
    setElapsedMin(currentFrame.elapsedMin)
    setRechargeCount(countRechargesInFrames(merged.frames.slice(0, flightIndex + 1)))
    setFlightMode(nextMode)

    if (currentFrame.phase === 'charging') {
      setStatus(
        `Режим: ${modeLabel[nextMode]}. Зарядка завершена (${currentFrame.batteryKm.toFixed(1)} → ${missionRules.batteryCapacityKm} км), полет продолжается.`,
      )
    } else {
      setStatus(`Режим переключен: ${modeLabel[nextMode]}. Траектория пересчитана с текущей точки.`)
    }
  }

  const interruptCharging = () => {
    if (!pendingResult || !isChargingNow || flightRouteRef.current.length < 2) return

    const interrupted = interruptChargingAt(
      flightRouteRef.current,
      pendingResult.frames,
      flightIndex,
      flightMode,
    )
    if (!interrupted) return

    const currentFrame = interrupted.frames[flightIndex]
    if (!currentFrame) return

    setPendingResult(interrupted)
    setFlightPath(interrupted.frames.map((frame) => frame.position))
    setBatteryLeftKm(currentFrame.batteryKm)
    setElapsedMin(currentFrame.elapsedMin)
    setRechargeCount(countRechargesInFrames(interrupted.frames.slice(0, flightIndex + 1)))

    setStatus('Зарядка прервана вручную. Полет продолжается с текущим зарядом.')
  }

  const pickFlightMode = (nextMode: FlightMode) => {
    if (isFlying) setModeDuringFlight(nextMode)
    else setFlightMode(nextMode)
  }

  const batteryLeftKmRef = useRef(batteryLeftKm)
  batteryLeftKmRef.current = batteryLeftKm

  useEffect(() => {
    if (!isFlying || flightPath.length === 0) return
    const sim = pendingResult
    if (!sim) return

    const finishFlight = () => {
      setIsFlying(false)
      setRechargeCount(sim.rechargeCount)
      const last = sim.frames[sim.frames.length - 1]
      const finalElapsed = last?.elapsedMin ?? 0
      const landedOk =
        batteryLeftKmRef.current > 0 && finalElapsed <= missionRules.missionTimeLimitMin

      if (!landedOk) {
        if (last && (last.batteryKm <= 0 || sim.reason.includes('упал') || sim.reason.includes('сбит'))) {
          setCrashPoint(last.position)
        }
        if (batteryLeftKmRef.current <= 0) {
          setStatus('Дрон упал: батарея разрядилась до 0%.')
        } else if (finalElapsed > missionRules.missionTimeLimitMin) {
          setStatus(`Груз не доставлен: дрон не успел в лимит ${missionRules.missionTimeLimitMin} мин.`)
        } else {
          setStatus(sim.reason)
        }
        return
      }

      const baseStatus = `Дрон долетел до Сургута. Зарядок: ${sim.rechargeCount}, время: ${finalElapsed.toFixed(1)} мин.`

      setStatus(`${baseStatus} Проверка ключа на сервере...`)

      void grantKeyAfterLanding().then((granted) => {
        if (granted) {
          setStatus(`${baseStatus} Ключ миссии получен.`)
          return
        }
        const reason = flightVerdictRef.current?.message ?? 'Сервер не подтвердил маршрут.'
        setStatus(`${baseStatus} Ключ не выдан: ${reason}`)
      })
    }

    const next = flightIndex + 1
    if (next >= flightPath.length) {
      const holdMs = 280
      const timer = window.setTimeout(finishFlight, holdMs)
      return () => window.clearTimeout(timer)
    }

    const currentElapsed = sim.frames[flightIndex]?.elapsedMin ?? 0
    const nextElapsed = sim.frames[next]?.elapsedMin ?? currentElapsed
    const deltaMin = Math.max(0.05, nextElapsed - currentElapsed)
    const delayMs = Math.max(12, Math.min(900, deltaMin * 220))

    const timer = window.setTimeout(() => {
      const nextFrame = sim.frames[next]
      if (!nextFrame) return

      setBatteryLeftKm(nextFrame.batteryKm)
      setElapsedMin(nextFrame.elapsedMin)

      if (nextFrame.batteryKm <= 0) {
        setIsFlying(false)
        setCrashPoint(nextFrame.position)
        setStatus(sim.reason)
        return
      }

      setFlightIndex(next)
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [isFlying, flightPath, pendingResult, flightIndex])

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
              <MdVpnKey className="btn-icon" aria-hidden />
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
        <h1>Планировщик полета БПЛА: Ханты-Мансийск - Сургут</h1>
        <p>
          Постройте маршрут кликами: старт в Ханты-Мансийске, финиш в Сургуте, без пересечений с
          бесполетными зонами, домами и тайгой.
        </p>
      </header>

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
        {flightPreview && (
          <p
            className={
              flightPreview.kind === 'fail' ? 'error' : 'ok'
            }
          >
            {flightPreview.kind === 'ok' &&
              `Симуляция (${modeLabel[flightMode]}): долетит, зарядок ~${flightPreview.sim.rechargeCount}, ~${flightPreview.sim.elapsedMin.toFixed(0)} мин. Режим в полёте можно менять.`}
            {flightPreview.kind === 'switchable' &&
              `В режиме «${modeLabel[flightMode]}» тяжело, но маршрут проходим (например, «${modeLabel[flightPreview.passableMode]}»). В полёте режим можно менять.`}
            {flightPreview.kind === 'fail' &&
              `Симуляция: ${flightPreview.sim.reason} Добавьте зарядки ⚡ или смените режим в полёте.`}
          </p>
        )}
        <p>{status}</p>
        <div className="actions">
          {!isFlying && (
            <button type="button" onClick={undoLastPoint} disabled={route.length === 0}>
              <MdUndo className="btn-icon" aria-hidden />
              Удалить последнюю точку
            </button>
          )}
          {!isFlying && (
            <button type="button" onClick={clearRoute} disabled={route.length === 0}>
              <MdDeleteSweep className="btn-icon" aria-hidden />
              Очистить маршрут
            </button>
          )}
          <button type="button" onClick={endAttempt}>
            <MdStopCircle className="btn-icon" aria-hidden />
            Закончить попытку
          </button>
          <button type="button" onClick={submitRoute} disabled={route.length < 2 || isSubmitting || isFlying}>
            <MdFlightTakeoff className="btn-icon" aria-hidden />
            {isSubmitting ? 'Проверка...' : 'Запуск проверки'}
          </button>
          <button
            type="button"
            onClick={() => pickFlightMode('slow')}
            disabled={isFlying && !pendingResult}
            className={`mode-btn ${flightMode === 'slow' ? 'active active-slow' : ''}`}
          >
            <TbClock className="btn-icon" aria-hidden />
            Медленный
          </button>
          <button
            type="button"
            onClick={() => pickFlightMode('normal')}
            disabled={isFlying && !pendingResult}
            className={`mode-btn ${flightMode === 'normal' ? 'active active-normal' : ''}`}
          >
            <TbPlane className="btn-icon" aria-hidden />
            Нормальный
          </button>
          <button
            type="button"
            onClick={() => pickFlightMode('sport')}
            disabled={isFlying && !pendingResult}
            className={`mode-btn ${flightMode === 'sport' ? 'active active-sport' : ''}`}
          >
            <TbRocket className="btn-icon" aria-hidden />
            Спорт
          </button>
          {isFlying && (
            <button type="button" onClick={interruptCharging} disabled={!isChargingNow} className="charge-stop-btn">
              <TbPlugOff className="btn-icon" aria-hidden />
              Прервать зарядку
            </button>
          )}
        </div>
        {key && (
          <div className="key-box">
            <div className="key-box-row">
              <span>Ключ миссии:</span>
              <code>{key}</code>
            </div>
            <p className="key-timer">
              Ключ исчезнет через 00:{keySecondsLeft.toString().padStart(2, '0')} — затем попытка завершится, потребуется новый код
            </p>
          </div>
        )}
      </section>

      <section className={`map-wrap${isRouteEditingLocked ? ' map-locked' : ''}`}>
        <MapContainer center={yugraMapCenter} zoom={8} className="map cartoon-map" attributionControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickCapture onPoint={addRoutePoint} disabled={isRouteEditingLocked} />

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
          {isFlying && currentFrame && (
            <DroneMarker position={currentFrame.position} icon={isChargingNow ? chargingDroneIcon : droneIcon} />
          )}
          {crashPoint && <Marker position={crashPoint} icon={L.divIcon({
            className: 'crash-icon',
            html: '<div>💥</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })} />}
        </MapContainer>
      </section>
    </main>
  )
}

export default App
