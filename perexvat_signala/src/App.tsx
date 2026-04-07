import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TARGET_FREQ = 145
const TARGET_CHANNEL = 23
const TARGET_GAIN = 75
const TOLERANCE = 5

const FREQ_RANGE = { min: 100, max: 200 }
const CHANNEL_RANGE = { min: 1, max: 50 }
const GAIN_RANGE = { min: 0, max: 100 }

const OBFUSCATED_COORDS = {
  lat: 'NjEuMDA=',
  lon: 'NjkuMDA=',
}

const ACCESS_KEY = 'YUGRA-SIGNAL-2024'
const ACTIVATION_HASH = 49346375253
const SESSION_DURATION_SECONDS = 20 * 60

const decodeCoordinate = (value: string) => Number(atob(value))
const hashCode = (value: string) =>
  value.split('').reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0)

type KnobProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  unit?: string
  className?: string
}

function Knob({ label, value, min, max, onChange, unit, className }: KnobProps) {
  const percent = ((value - min) / (max - min)) * 100
  const rotation = -130 + percent * 2.6

  return (
    <label className={`knob-control ${className ?? ''}`.trim()}>
      <span className="knob-label">{label}</span>
      <span className="knob-shell">
        <span className="knob-dial" style={{ transform: `rotate(${rotation}deg)` }}>
          <span className="knob-marker" />
        </span>
        <span className="knob-value">
          {value}
          {unit ?? ''}
        </span>
      </span>
      <input
        className="knob-range"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function App() {
  const [activationInput, setActivationInput] = useState('')
  const [activationError, setActivationError] = useState('')
  const [isActivated, setIsActivated] = useState(false)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(
    SESSION_DURATION_SECONDS,
  )
  const [frequency, setFrequency] = useState(120)
  const [channel, setChannel] = useState(8)
  const [gain, setGain] = useState(30)
  const [latInput, setLatInput] = useState('')
  const [lonInput, setLonInput] = useState('')
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(10)
  const [linkMode, setLinkMode] = useState<'scan' | 'track' | 'relay' | 'guard'>(
    'scan',
  )
  const [bandwidth, setBandwidth] = useState(42)

  const targetLat = useMemo(() => decodeCoordinate(OBFUSCATED_COORDS.lat), [])
  const targetLon = useMemo(() => decodeCoordinate(OBFUSCATED_COORDS.lon), [])

  const resetRound = () => {
    setFrequency(120)
    setChannel(8)
    setGain(30)
    setBandwidth(42)
    setLinkMode('scan')
    setLatInput('')
    setLonInput('')
    setMessage('')
    setIsSuccess(false)
    setSecondsLeft(10)
  }

  const endAttempt = () => {
    resetRound()
    setActivationInput('')
    setActivationError('')
    setIsActivated(false)
    setSessionSecondsLeft(SESSION_DURATION_SECONDS)
  }

  const noiseLevel = useMemo(() => {
    const freqDeviation = Math.abs(frequency - TARGET_FREQ)
    const channelDeviation = Math.abs(channel - TARGET_CHANNEL)
    const gainDeviation = Math.abs(gain - TARGET_GAIN)

    const maxBeyondTolerance =
      Math.max(
        0,
        freqDeviation - TOLERANCE,
        channelDeviation - TOLERANCE,
        gainDeviation - TOLERANCE,
      ) * 10

    return Math.min(100, Math.round(maxBeyondTolerance))
  }, [frequency, channel, gain])

  const isSignalLocked = noiseLevel === 0
  const isFrequencyAligned = Math.abs(frequency - TARGET_FREQ) <= TOLERANCE
  const signalStrength = 100 - noiseLevel

  const validateTwoDecimals = (value: string) =>
    /^-?\d+\.\d{2}$/.test(value.trim())

  const formatSessionTime = (seconds: number) => {
    const minutesPart = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const secondsPart = (seconds % 60).toString().padStart(2, '0')
    return `${minutesPart}:${secondsPart}`
  }

  const handleActivate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hashCode(activationInput.trim()) === ACTIVATION_HASH) {
      setActivationError('')
      setIsActivated(true)
      setSessionSecondsLeft(SESSION_DURATION_SECONDS)
      resetRound()
      return
    }
    setActivationError('Неверный код активации.')
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSignalLocked) {
      setMessage('Нет сигнала. Сначала настройте радиомикшер.')
      return
    }

    if (!validateTwoDecimals(latInput) || !validateTwoDecimals(lonInput)) {
      resetRound()
      return
    }

    const parsedLat = Number(latInput)
    const parsedLon = Number(lonInput)

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      resetRound()
      return
    }

    const isLatValid = Math.abs(parsedLat - targetLat) <= 0.01
    const isLonValid = Math.abs(parsedLon - targetLon) <= 0.01

    if (isLatValid && isLonValid) {
      setIsSuccess(true)
      setMessage('')
      return
    }

    resetRound()
  }

  useEffect(() => {
    if (!isSuccess) {
      return
    }

    setSecondsLeft(10)
    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId)
              resetRound()
          return 10
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isSuccess])

  useEffect(() => {
    if (!isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId)
          endAttempt()
          return SESSION_DURATION_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isActivated])

  if (!isActivated) {
    return (
      <main className="mixer-app">
        <section className="activation-panel">
          <h1>Активация станции</h1>
          <p>Введите код активации для начала попытки.</p>
          <form onSubmit={handleActivate}>
            <input
              type="password"
              value={activationInput}
              onChange={(event) => setActivationInput(event.target.value)}
              placeholder="Код активации"
            />
            <button type="submit">Активировать</button>
          </form>
          {activationError && <p className="message">{activationError}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className={`mixer-app ${isSignalLocked ? 'locked' : ''}`}>
      <section className="panel">
        <div className="session-bar">
          <span>Время попытки: {formatSessionTime(sessionSecondsLeft)}</span>
          <button type="button" onClick={endAttempt}>
            Закончить попытку
          </button>
        </div>
        <div className="controls">
          <h2>Радиомикшер · SmartMixer</h2>
          <div className="mixer-chassis">
            <Knob
              label="FREQUENCY"
              value={frequency}
              min={FREQ_RANGE.min}
              max={FREQ_RANGE.max}
              unit=" MHz"
              onChange={setFrequency}
              className="knob-freq"
            />
            <div className="mixer-display">
              <p>RF LINK MONITOR</p>
              <div className="display-grid">
                <span>FREQ</span>
                <strong>{frequency} MHz</strong>
                <span>CHANNEL</span>
                <strong>{channel}</strong>
                <span>GAIN</span>
                <strong>{gain}%</strong>
              </div>
            </div>
            <Knob
              label="CHANNEL"
              value={channel}
              min={CHANNEL_RANGE.min}
              max={CHANNEL_RANGE.max}
              onChange={setChannel}
              className="knob-channel"
            />
            <div className="mixer-buttons">
              <button
                type="button"
                className={linkMode === 'scan' ? 'active' : ''}
                onClick={() => setLinkMode('scan')}
              >
                SCAN
              </button>
              <button
                type="button"
                className={linkMode === 'track' ? 'active' : ''}
                onClick={() => setLinkMode('track')}
              >
                TRACK
              </button>
              <button
                type="button"
                className={linkMode === 'relay' ? 'active' : ''}
                onClick={() => setLinkMode('relay')}
              >
                RELAY
              </button>
              <button
                type="button"
                className={linkMode === 'guard' ? 'active' : ''}
                onClick={() => setLinkMode('guard')}
              >
                GUARD
              </button>
            </div>
            <Knob
              label="GAIN"
              value={gain}
              min={GAIN_RANGE.min}
              max={GAIN_RANGE.max}
              unit="%"
              onChange={setGain}
              className="knob-gain"
            />
            <Knob
              label="BANDWIDTH"
              value={bandwidth}
              min={0}
              max={100}
              unit="%"
              onChange={setBandwidth}
              className="knob-bandwidth"
            />
          </div>
        </div>

        <section className="signal-stage">
          <div className="stage-content">
            <div className="hud-row">
              <p className="status">СТАНЦИЯ №5 · РАДИОМИКШЕР</p>
              <span className={`lock-pill ${isSignalLocked ? 'live' : ''}`}>
                {isSignalLocked ? 'LINK SECURED' : 'SIGNAL UNSTABLE'}
              </span>
            </div>
            <h1>{isSignalLocked ? 'КАНАЛ ВОССТАНОВЛЕН' : 'ПОИСК СИГНАЛА...'}</h1>
          </div>
          <div
            className="noise-layer"
            aria-hidden="true"
            style={{ opacity: noiseLevel / 100 }}
          />
        </section>

        <div className="signal-meter">
          <div className="meter-header">
            <span>Signal Strength</span>
            <strong className={isSignalLocked ? 'ok' : ''}>
              {isSignalLocked ? 'LOCKED' : `${signalStrength}%`}
            </strong>
          </div>
          <div className="meter-bar">
            <div style={{ width: `${signalStrength}%` }} />
          </div>
        </div>

        {!isSignalLocked ? (
          <div className="blocked-task">
            <p>Текст задания недоступен.</p>
            <p>Настройте частоту, канал и усиление для очистки сигнала.</p>
          </div>
        ) : (
          <article className="task">
            <p className="attention">ВНИМАНИЕ: КАНАЛ ВОССТАНОВЛЕН</p>
            <p>
              Для получения ключа доступа подтвердите свое местоположение.
              Введите координаты здания, в котором вы сейчас находитесь.
            </p>
            <p>Требования:</p>
            <ul>
              <li>Формат: десятичные градусы (DD).</li>
              <li>Точность: ровно 2 знака после запятой.</li>
              <li>Пример: 55.75, 37.61</li>
            </ul>
          </article>
        )}

        {!isSuccess && isFrequencyAligned ? (
          <form className="coords-form" onSubmit={handleSubmit}>
            <h2>Проверка координат</h2>
            <div className="inputs">
              <label>
                <span>Широта (Lat)</span>
                <input
                  type="text"
                  placeholder={isSignalLocked ? '00.00' : 'Нет сигнала'}
                  value={latInput}
                  disabled={!isSignalLocked}
                  onChange={(event) => setLatInput(event.target.value)}
                />
              </label>
              <label>
                <span>Долгота (Lon)</span>
                <input
                  type="text"
                  placeholder={isSignalLocked ? '00.00' : 'Нет сигнала'}
                  value={lonInput}
                  disabled={!isSignalLocked}
                  onChange={(event) => setLonInput(event.target.value)}
                />
              </label>
            </div>
            <button type="submit" disabled={!isSignalLocked}>
              Отправить координаты
            </button>
            {message && <p className="message">{message}</p>}
          </form>
        ) : null}
      </section>
      {isSuccess && (
        <div className="code-modal-backdrop" role="dialog" aria-modal="true">
          <section className="code-modal">
            <h2>Координаты подтверждены</h2>
            <p>Ключ доступа:</p>
            <p className="key">{ACCESS_KEY}</p>
            <p className="modal-hint">
              Окно закроется через {secondsLeft} сек.
            </p>
            <button type="button" onClick={resetRound}>
              Закрыть
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
