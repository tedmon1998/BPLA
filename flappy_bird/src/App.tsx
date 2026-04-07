import { useEffect, useMemo, useState } from 'react'
import { GiDeliveryDrone } from 'react-icons/gi'
import './App.css'

type BuildingPair = {
  id: number
  x: number
  gapTop: number
  passed: boolean
}

const GAME_WIDTH = 860
const GAME_HEIGHT = 560
const DRONE_X = 180
const DRONE_SIZE = 42
const GRAVITY = 0.5
const FLAP_POWER = -8.4
const BUILDING_WIDTH = 92
const GAP_HEIGHT = 175
const BUILDING_SPEED = 3.4
const BUILDING_SPAWN_MS = 1500
const DELIVERY_TARGET = 12
const AUTO_RESTART_AFTER_MS = 10000
const ACTIVATION_CODE = '2584830'
const ATTEMPT_TIME_SECONDS = 20 * 60

const randomGapTop = (): number => {
  const min = 90
  const max = GAME_HEIGHT - GAP_HEIGHT - 90
  return Math.floor(Math.random() * (max - min) + min)
}

function App() {
  const [droneY, setDroneY] = useState(GAME_HEIGHT / 2 - DRONE_SIZE / 2)
  const [velocity, setVelocity] = useState(0)
  const [buildings, setBuildings] = useState<BuildingPair[]>([])
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [restartCountdown, setRestartCountdown] = useState(
    AUTO_RESTART_AFTER_MS / 1000,
  )
  const [activationInput, setActivationInput] = useState('')
  const [activationError, setActivationError] = useState('')
  const [activated, setActivated] = useState(false)
  const [attemptSecondsLeft, setAttemptSecondsLeft] = useState(
    ATTEMPT_TIME_SECONDS,
  )

  useEffect(() => {
    if (!activated || !started || gameOver || delivered) {
      return
    }

    const tick = window.setInterval(() => {
      setVelocity((prev) => prev + GRAVITY)
      setDroneY((prev) => prev + velocity)
    }, 20)

    return () => window.clearInterval(tick)
  }, [activated, started, gameOver, delivered, velocity])

  useEffect(() => {
    if (!activated || !started || gameOver || delivered) {
      return
    }

    const spawner = window.setInterval(() => {
      setBuildings((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          x: GAME_WIDTH,
          gapTop: randomGapTop(),
          passed: false,
        },
      ])
    }, BUILDING_SPAWN_MS)

    return () => window.clearInterval(spawner)
  }, [activated, started, gameOver, delivered])

  useEffect(() => {
    if (!activated || !started || gameOver || delivered) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuildings((prev) =>
      prev
        .map((item) => ({ ...item, x: item.x - BUILDING_SPEED }))
        .filter((item) => item.x + BUILDING_WIDTH > -10),
    )
  }, [droneY, activated, started, gameOver, delivered])

  useEffect(() => {
    if (!activated || !started || gameOver || delivered) {
      return
    }

    if (droneY < 0 || droneY + DRONE_SIZE > GAME_HEIGHT) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGameOver(true)
      return
    }

    setBuildings((prev) =>
      prev.map((item) => {
        const inXRange =
          DRONE_X + DRONE_SIZE > item.x && DRONE_X < item.x + BUILDING_WIDTH
        const hitsTop = droneY < item.gapTop
        const hitsBottom = droneY + DRONE_SIZE > item.gapTop + GAP_HEIGHT

        if (inXRange && (hitsTop || hitsBottom)) {
          setGameOver(true)
          return item
        }

        const justPassed = !item.passed && item.x + BUILDING_WIDTH < DRONE_X
        if (justPassed) {
          setScore((prevScore) => prevScore + 1)
          return { ...item, passed: true }
        }

        return item
      }),
    )
  }, [droneY, activated, started, gameOver, delivered])

  useEffect(() => {
    if (activated && score >= DELIVERY_TARGET) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelivered(true)
    }
  }, [score, activated])

  const flap = (): void => {
    if (!activated) {
      return
    }
    if (!started) {
      setStarted(true)
    }
    if (gameOver || delivered) {
      return
    }
    setVelocity(FLAP_POWER)
  }

  const restart = (): void => {
    setDroneY(GAME_HEIGHT / 2 - DRONE_SIZE / 2)
    setVelocity(0)
    setBuildings([])
    setScore(0)
    setGameOver(false)
    setDelivered(false)
    setStarted(false)
    setRestartCountdown(AUTO_RESTART_AFTER_MS / 1000)
  }

  const lockAttempt = (): void => {
    restart()
    setActivated(false)
    setActivationInput('')
    setActivationError('')
    setAttemptSecondsLeft(ATTEMPT_TIME_SECONDS)
  }

  const activateAttempt = (): void => {
    if (activationInput.trim() !== ACTIVATION_CODE) {
      setActivationError('Неверный код активации')
      return
    }
    setActivationError('')
    setActivated(true)
    restart()
    setAttemptSecondsLeft(ATTEMPT_TIME_SECONDS)
  }

  useEffect(() => {
    if (!delivered) {
      return
    }

    const autoRestartTimer = window.setTimeout(() => {
      restart()
    }, AUTO_RESTART_AFTER_MS)

    return () => window.clearTimeout(autoRestartTimer)
  }, [delivered])

  useEffect(() => {
    if (!activated) {
      return
    }

    const sessionTimer = window.setInterval(() => {
      setAttemptSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(sessionTimer)
          lockAttempt()
          return ATTEMPT_TIME_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(sessionTimer)
  }, [activated])

  useEffect(() => {
    if (!delivered) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestartCountdown(AUTO_RESTART_AFTER_MS / 1000)
    const countdownTimer = window.setInterval(() => {
      setRestartCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearInterval(countdownTimer)
  }, [delivered])

  const statusText = useMemo(() => {
    if (!activated) return 'Введите код активации, чтобы начать'
    if (!started) return 'Нажми Space или кликни, чтобы взлететь'
    if (gameOver) return 'Дрон столкнулся. Попробуй еще раз'
    if (delivered) return 'Еда доставлена. Миссия выполнена'
    return 'Проведи дрон между зданиями'
  }, [activated, started, gameOver, delivered])

  const sessionTimeText = useMemo(() => {
    const minutes = String(Math.floor(attemptSecondsLeft / 60)).padStart(2, '0')
    const seconds = String(attemptSecondsLeft % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }, [attemptSecondsLeft])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        event.preventDefault()
        flap()
      }
      if (event.code === 'KeyR' && activated && (gameOver || delivered)) {
        restart()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <main className="page">
      <h1>Drone Flappy Delivery</h1>
      <p className="subtitle">
        Дрон должен пролететь между зданиями и доставить еду главному герою.
      </p>

      <div
        className={`game ${gameOver ? 'game-over' : ''} ${delivered ? 'delivered' : ''}`}
        onClick={flap}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') flap()
        }}
      >
        {!activated && (
          <div className="activation-overlay">
            <h2>Активация попытки</h2>
            <p>Введите код активации, чтобы разблокировать игру.</p>
            <input
              type="password"
              value={activationInput}
              onChange={(event) => {
                setActivationInput(event.target.value)
                if (activationError) setActivationError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  activateAttempt()
                }
              }}
              placeholder="Код активации"
            />
            {activationError && <p className="activation-error">{activationError}</p>}
            <button
              onClick={(event) => {
                event.stopPropagation()
                activateAttempt()
              }}
            >
              Активировать
            </button>
          </div>
        )}

        <div className="skyline" />
        <div className="hero">
          <div className="hero-avatar">🧍</div>
          <div className="hero-food">🍱</div>
        </div>

        {buildings.map((item) => (
          <div key={item.id}>
            <div
              className="building top"
              style={{
                left: item.x,
                width: BUILDING_WIDTH,
                height: item.gapTop,
              }}
            />
            <div
              className="building bottom"
              style={{
                left: item.x,
                width: BUILDING_WIDTH,
                top: item.gapTop + GAP_HEIGHT,
                height: GAME_HEIGHT - (item.gapTop + GAP_HEIGHT),
              }}
            />
          </div>
        ))}

        <div
          className="drone"
          style={{
            left: DRONE_X,
            top: droneY,
            width: DRONE_SIZE,
            height: DRONE_SIZE,
            transform: `rotate(${Math.max(-25, Math.min(45, velocity * 4))}deg)`,
          }}
        >
          <GiDeliveryDrone className="drone-icon" />
        </div>

        <div className="hud">
          <span>Счет: {score}</span>
          <span>Цель: {DELIVERY_TARGET}</span>
          <span>Время: {sessionTimeText}</span>
        </div>

        <div className="status">{statusText}</div>

        {(gameOver || delivered) && (
          <div className="overlay">
            {delivered ? (
              <>
                <h2>Доставка выполнена</h2>
                <p>Главный герой передал дрону код:</p>
                <code>FLB-4542K</code>
                <p>Новая игра через: {restartCountdown} сек.</p>
              </>
            ) : (
              <>
                <h2>Миссия провалена</h2>
                <p>Дрон не смог долететь до героя.</p>
              </>
            )}
            <button
              onClick={(event) => {
                event.stopPropagation()
                restart()
              }}
            >
              {delivered ? 'Закрыть' : 'Сыграть снова'}
            </button>
          </div>
        )}
      </div>
      <div className="actions">
        <button
          className="finish-btn"
          onClick={() => {
            lockAttempt()
          }}
          disabled={!activated}
        >
          Закончить попытку
        </button>
      </div>
      <p className="controls">Управление: Space/клик - взлет, R - рестарт</p>
    </main>
  )
}

export default App
