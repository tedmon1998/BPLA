import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEVELS } from '../data/levels'
import type { ICommand, ILevel, RunOutcome, Vector3 } from '../types/game'

const STEP_DURATION_MS = 300
const HOVER_DURATION_MS = 1000
const ACTIVATION_CODE = '3918330'
const ACTIVATION_DURATION_SECONDS = 20 * 60

const EPSILON = 0.0001

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

const createLevelStartLog = (level: ILevel): string[] => [
  `Уровень ${level.id}: ${level.title}`,
  level.description,
]

const samePosition = (a: Vector3, b: Vector3): boolean =>
  Math.abs(a.x - b.x) < EPSILON &&
  Math.abs(a.y - b.y) < EPSILON &&
  Math.abs(a.z - b.z) < EPSILON

const distance = (a: Vector3, b: Vector3): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)

const inBounds = (position: Vector3, level: ILevel): boolean => {
  const { min, max } = level.bounds
  return (
    position.x >= min.x &&
    position.x <= max.x &&
    position.y >= min.y &&
    position.y <= max.y &&
    position.z >= min.z &&
    position.z <= max.z
  )
}

const collidesWithObstacle = (position: Vector3, level: ILevel): boolean =>
  level.obstacles.some((obstacle) => {
    const halfX = obstacle.size.x / 2
    const halfY = obstacle.size.y / 2
    const halfZ = obstacle.size.z / 2
    return (
      position.x >= obstacle.position.x - halfX &&
      position.x <= obstacle.position.x + halfX &&
      position.y >= obstacle.position.y - halfY &&
      position.y <= obstacle.position.y + halfY &&
      position.z >= obstacle.position.z - halfZ &&
      position.z <= obstacle.position.z + halfZ
    )
  })

const isHoverWithoutValue = (parts: string[]): boolean =>
  parts[0] === 'hover' && parts.length === 1

const parseCode = (code: string): { commands: ICommand[]; error?: string } => {
  const lines = code
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)

  if (lines.length === 0) {
    return { commands: [], error: 'Код пуст. Добавьте команды перед запуском.' }
  }

  const commands: ICommand[] = []
  for (const line of lines) {
    const parts = line.split(/\s+/)
    const [name, valueRaw] = parts
    if (!name) {
      continue
    }

    if (!['forward', 'up', 'down', 'left', 'right', 'hover'].includes(name)) {
      return { commands: [], error: `Unknown command '${name}'` }
    }

    if (isHoverWithoutValue(parts)) {
      commands.push({ type: 'hover', raw: line })
      continue
    }

    if (parts.length !== 2) {
      return { commands: [], error: `Неверный формат команды '${line}'` }
    }

    const value = Number(valueRaw)
    if (Number.isNaN(value)) {
      return { commands: [], error: `Аргумент команды '${line}' не является числом` }
    }

    commands.push({ type: name as ICommand['type'], value, raw: line })
  }

  return { commands }
}

const getNextPosition = (current: Vector3, command: ICommand): Vector3 => {
  if (command.type === 'hover') {
    return { ...current }
  }

  const value = command.value ?? 0
  switch (command.type) {
    case 'forward':
      return { ...current, z: current.z - value }
    case 'up':
      return { ...current, y: current.y + value }
    case 'down':
      return { ...current, y: current.y - value }
    case 'left':
      return { ...current, x: current.x - value }
    case 'right':
      return { ...current, x: current.x + value }
    default:
      return current
  }
}

const interpolatePosition = (from: Vector3, to: Vector3, t: number): Vector3 => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  z: from.z + (to.z - from.z) * t,
})

const validatePath = (
  from: Vector3,
  to: Vector3,
  level: ILevel,
): { ok: true } | { ok: false; reason: 'bounds' | 'obstacle' } => {
  const segmentLength = distance(from, to)
  if (segmentLength < EPSILON) {
    return { ok: true }
  }

  const sampleStep = 0.2
  const samplesCount = Math.max(1, Math.ceil(segmentLength / sampleStep))
  for (let i = 1; i <= samplesCount; i += 1) {
    const point = interpolatePosition(from, to, i / samplesCount)
    if (!inBounds(point, level)) {
      return { ok: false, reason: 'bounds' }
    }
    if (collidesWithObstacle(point, level)) {
      return { ok: false, reason: 'obstacle' }
    }
  }

  return { ok: true }
}

export interface GameEngineState {
  levels: ILevel[]
  currentLevelIndex: number
  currentLevel: ILevel
  code: string
  setCode: (value: string) => void
  logs: string[]
  isExecuting: boolean
  runOutcome: RunOutcome
  dronePosition: Vector3
  droneTargetPosition: Vector3
  isRewardOpen: boolean
  progress: number
  isActivated: boolean
  activationSecondsLeft: number
  runCode: () => Promise<void>
  resetCurrentLevel: () => void
  resetToFirstLevel: () => void
  closeRewardAndRestart: () => void
  activateSession: (code: string) => boolean
  endAttempt: () => void
}

export const useGameEngine = (): GameEngineState => {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0)
  const [code, setCode] = useState('')
  const [logs, setLogs] = useState<string[]>(createLevelStartLog(LEVELS[0]))
  const [isExecuting, setIsExecuting] = useState(false)
  const [runOutcome, setRunOutcome] = useState<RunOutcome>('idle')
  const [dronePosition, setDronePosition] = useState<Vector3>(LEVELS[0].start)
  const [droneTargetPosition, setDroneTargetPosition] = useState<Vector3>(LEVELS[0].start)
  const [isRewardOpen, setIsRewardOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isActivated, setIsActivated] = useState(false)
  const [activationSecondsLeft, setActivationSecondsLeft] = useState(0)
  const resetTimerRef = useRef<number | null>(null)
  const rewardTimerRef = useRef<number | null>(null)

  const currentLevel = useMemo(() => LEVELS[currentLevelIndex], [currentLevelIndex])

  const pushLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, message])
  }, [])

  const clearTimers = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    if (rewardTimerRef.current !== null) {
      window.clearTimeout(rewardTimerRef.current)
      rewardTimerRef.current = null
    }
  }, [])

  const resetToFirstLevel = useCallback(() => {
    clearTimers()
    const firstLevel = LEVELS[0]
    setCurrentLevelIndex(0)
    setProgress(0)
    setCode('')
    setIsExecuting(false)
    setRunOutcome('idle')
    setIsRewardOpen(false)
    setDronePosition(firstLevel.start)
    setDroneTargetPosition(firstLevel.start)
    setLogs(createLevelStartLog(firstLevel))
  }, [clearTimers])

  const endAttempt = useCallback(() => {
    setIsActivated(false)
    setActivationSecondsLeft(0)
    resetToFirstLevel()
  }, [resetToFirstLevel])

  const failMission = useCallback(
    (message: string) => {
      setIsExecuting(false)
      setRunOutcome('error')
      pushLog('Ошибка выполнения. Миссия провалена.')
      pushLog(message)
      pushLog('Перезапуск уровня 1 через 2 секунды...')

      resetTimerRef.current = window.setTimeout(() => {
        resetToFirstLevel()
      }, 2000)
    },
    [pushLog, resetToFirstLevel],
  )

  const moveToLevelStart = useCallback((level: ILevel) => {
    setDronePosition(level.start)
    setDroneTargetPosition(level.start)
  }, [])

  const resetCurrentLevel = useCallback(() => {
    const level = LEVELS[currentLevelIndex]
    setIsExecuting(false)
    setRunOutcome('idle')
    setLogs(createLevelStartLog(level))
    moveToLevelStart(level)
  }, [currentLevelIndex, moveToLevelStart])

  const closeRewardAndRestart = useCallback(() => {
    setIsRewardOpen(false)
    resetToFirstLevel()
  }, [resetToFirstLevel])

  const openRewardAndScheduleRestart = useCallback(() => {
    setIsRewardOpen(true)
    rewardTimerRef.current = window.setTimeout(() => {
      closeRewardAndRestart()
    }, 10000)
  }, [closeRewardAndRestart])

  const runCode = useCallback(async () => {
    if (isExecuting || isRewardOpen || !isActivated) {
      return
    }

    const levelAtStart = LEVELS[currentLevelIndex]
    const parsed = parseCode(code)
    if (parsed.error) {
      setRunOutcome('error')
      pushLog(parsed.error)
      return
    }

    const commands = parsed.commands
    setIsExecuting(true)
    setRunOutcome('idle')
    setLogs((prev) => [...prev, 'Запуск программы...'])

    let virtualPosition: Vector3 = levelAtStart.start
    if (!samePosition(dronePosition, levelAtStart.start)) {
      virtualPosition = levelAtStart.start
      setDroneTargetPosition(levelAtStart.start)
      setDronePosition(levelAtStart.start)
      await sleep(STEP_DURATION_MS)
    }

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]
      const next = getNextPosition(virtualPosition, command)
      pushLog(`Шаг ${index + 1}/${commands.length}: ${command.raw}`)

      const pathValidation = validatePath(virtualPosition, next, levelAtStart)
      if (!pathValidation.ok && pathValidation.reason === 'bounds') {
        failMission('Дрон вышел за пределы зоны действия.')
        return
      }
      if (!pathValidation.ok && pathValidation.reason === 'obstacle') {
        failMission('Дрон врезался в препятствие.')
        return
      }

      setDroneTargetPosition(next)
      await sleep(command.type === 'hover' ? HOVER_DURATION_MS : STEP_DURATION_MS)
      virtualPosition = next
      setDronePosition(next)
    }

    if (distance(virtualPosition, levelAtStart.target) <= levelAtStart.targetRadius) {
      const nextProgress = currentLevelIndex + 1
      setProgress(nextProgress)
      setRunOutcome('success')
      pushLog(`Уровень ${levelAtStart.id} пройден!`)
      setIsExecuting(false)

      if (currentLevelIndex === LEVELS.length - 1) {
        pushLog('Все уровни пройдены. Награда разблокирована.')
        openRewardAndScheduleRestart()
        return
      }

      const nextLevelIndex = currentLevelIndex + 1
      const nextLevel = LEVELS[nextLevelIndex]
      setCurrentLevelIndex(nextLevelIndex)
      setCode('')
      setLogs(createLevelStartLog(nextLevel))
      moveToLevelStart(nextLevel)
      setRunOutcome('idle')
      return
    }

    failMission('Программа завершена, но цель не достигнута.')
  }, [
    code,
    currentLevelIndex,
    dronePosition,
    failMission,
    isExecuting,
    isActivated,
    isRewardOpen,
    moveToLevelStart,
    openRewardAndScheduleRestart,
    pushLog,
  ])

  const activateSession = useCallback((code: string): boolean => {
    if (code.trim() !== ACTIVATION_CODE) {
      return false
    }
    setIsActivated(true)
    setActivationSecondsLeft(ACTIVATION_DURATION_SECONDS)
    return true
  }, [])

  useEffect(() => {
    if (!isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setActivationSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) {
          window.clearInterval(timerId)
          window.setTimeout(() => {
            endAttempt()
          }, 0)
        }
        return next
      })
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [endAttempt, isActivated])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    levels: LEVELS,
    currentLevelIndex,
    currentLevel,
    code,
    setCode,
    logs,
    isExecuting,
    runOutcome,
    dronePosition,
    droneTargetPosition,
    isRewardOpen,
    progress,
    isActivated,
    activationSecondsLeft,
    runCode,
    resetCurrentLevel,
    resetToFirstLevel,
    closeRewardAndRestart,
    activateSession,
    endAttempt,
  }
}
