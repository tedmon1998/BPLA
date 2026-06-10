import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const FREQ_RANGE = { min: 100, max: 200 }
const CHANNEL_RANGE = { min: 1, max: 50 }
const GAIN_RANGE = { min: 0, max: 100 }

const TARGET_LIMITS = {
  frequency: { min: 112, max: 188 },
  channel: { min: 7, max: 44 },
  gain: { min: 18, max: 92 },
  bandwidth: { min: 12, max: 88 },
  tolerance: { min: 3, max: 6 },
}

const OBFUSCATED_COORDS = {
  lat: 'NjEuMDA=',
  lon: 'NjkuMDA=',
}

const ACCESS_KEY = 'YUGRA-SIGNAL-2024'
const ACTIVATION_HASH = 49346375253
const SESSION_DURATION_SECONDS = 20 * 60

const STR = {
  activationError:
    '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438.',
  noSignal:
    '\u041d\u0435\u0442 \u0441\u0438\u0433\u043d\u0430\u043b\u0430. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0440\u0430\u0434\u0438\u043e\u043c\u0438\u043a\u0448\u0435\u0440.',
  activationTitle: '\u0410\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u044f \u0441\u0442\u0430\u043d\u0446\u0438\u0438',
  activationHint:
    '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0434\u043b\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u043f\u044b\u0442\u043a\u0438.',
  activationPlaceholder: '\u041a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438',
  activate: '\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  sessionTime: '\u0412\u0440\u0435\u043c\u044f \u043f\u043e\u043f\u044b\u0442\u043a\u0438:',
  endAttempt: '\u0417\u0430\u043a\u043e\u043d\u0447\u0438\u0442\u044c \u043f\u043e\u043f\u044b\u0442\u043a\u0443',
  mixerTitle: '\u0420\u0430\u0434\u0438\u043e\u043c\u0438\u043a\u0448\u0435\u0440 \u00b7 SmartMixer',
  stationStatus:
    '\u0421\u0422\u0410\u041d\u0426\u0418\u042f \u21165 \u00b7 \u0420\u0410\u0414\u0418\u041e\u041c\u0418\u041a\u0428\u0415\u0420',
  channelRestored: '\u041a\u0410\u041d\u0410\u041b \u0412\u041e\u0421\u0421\u0422\u0410\u041d\u041e\u0412\u041b\u0415\u041d',
  searching: '\u041f\u041e\u0418\u0421\u041a \u0421\u0418\u0413\u041d\u0410\u041b\u0410...',
  taskBlocked:
    '\u0417\u0430\u0434\u0430\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0440\u0430\u0434\u0438\u043e\u043c\u0438\u043a\u0448\u0435\u0440, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b \u0442\u043e\u0447\u043a\u0438 \u043a\u043e\u043d\u0444\u043b\u044e\u044d\u043d\u0446\u0438\u0438.',
  tuneHint:
    '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0447\u0430\u0441\u0442\u043e\u0442\u0443, \u043a\u0430\u043d\u0430\u043b, \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u0435 \u0438 \u043f\u043e\u043b\u043e\u0441\u0443 \u0434\u043b\u044f \u043e\u0447\u0438\u0441\u0442\u043a\u0438 \u0441\u0438\u0433\u043d\u0430\u043b\u0430.',
  attention: '\u0412\u041d\u0418\u041c\u0410\u041d\u0418\u0415: \u041a\u0410\u041d\u0410\u041b \u0412\u041e\u0421\u0421\u0422\u0410\u041d\u041e\u0412\u041b\u0415\u041d',
  taskBody1:
    '\u0414\u043b\u044f \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f \u043a\u043b\u044e\u0447\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043d\u0430\u0439\u0434\u0438\u0442\u0435 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0443\u044e \u0442\u043e\u0447\u043a\u0443 \u043a\u043e\u043d\u0444\u043b\u044e\u044d\u043d\u0446\u0438\u0438.',
  taskBody2:
    '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0435\u0451 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b \u0432 \u043f\u043e\u043b\u044f \u043d\u0438\u0436\u0435.',
  requirements: '\u0422\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f:',
  reqFormat:
    '\u0424\u043e\u0440\u043c\u0430\u0442: \u0434\u0435\u0441\u044f\u0442\u0438\u0447\u043d\u044b\u0435 \u0433\u0440\u0430\u0434\u0443\u0441\u044b (DD).',
  reqPrecision:
    '\u0422\u043e\u0447\u043d\u043e\u0441\u0442\u044c: \u0440\u043e\u0432\u043d\u043e 2 \u0437\u043d\u0430\u043a\u0430 \u043f\u043e\u0441\u043b\u0435 \u0437\u0430\u043f\u044f\u0442\u043e\u0439.',
  reqExample: '\u041f\u0440\u0438\u043c\u0435\u0440: 55.75, 37.61',
  coordsCheck: '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442',
  lat: '\u0428\u0438\u0440\u043e\u0442\u0430 (Lat)',
  lon: '\u0414\u043e\u043b\u0433\u043e\u0442\u0430 (Lon)',
  noSignalShort: '\u041d\u0435\u0442 \u0441\u0438\u0433\u043d\u0430\u043b\u0430',
  submitCoords: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b',
  coordsConfirmed: '\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u044b',
  accessKey: '\u041a\u043b\u044e\u0447 \u0434\u043e\u0441\u0442\u0443\u043f\u0430:',
  modalCloseIn: '\u041e\u043a\u043d\u043e \u0437\u0430\u043a\u0440\u043e\u0435\u0442\u0441\u044f \u0447\u0435\u0440\u0435\u0437',
  seconds: '\u0441\u0435\u043a.',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  tuningTitle: '\u0414\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
  freqOk: '\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0432 \u043d\u043e\u0440\u043c\u0435',
  freqClose: '\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0431\u043b\u0438\u0437\u043a\u043e',
  freqFar: '\u0427\u0430\u0441\u0442\u043e\u0442\u0430 \u0434\u0430\u043b\u0435\u043a\u043e',
  channelOk: '\u041a\u0430\u043d\u0430\u043b \u0441\u0442\u0430\u0431\u0438\u043b\u0435\u043d',
  channelBad: '\u041a\u0430\u043d\u0430\u043b \u043d\u0435\u0441\u0442\u0430\u0431\u0438\u043b\u0435\u043d',
  gainOk: '\u0423\u0441\u0438\u043b\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e',
  gainBad: '\u0423\u0441\u0438\u043b\u0435\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e',
  bandwidthOk:
    '\u041f\u043e\u043b\u043e\u0441\u0430 \u043f\u0440\u0438\u043d\u044f\u0442\u0430',
  bandwidthClose:
    '\u041f\u043e\u043b\u043e\u0441\u0430 \u0431\u043b\u0438\u0437\u043a\u043e',
  bandwidthFar:
    '\u041f\u043e\u043b\u043e\u0441\u0430 \u0448\u0443\u043c\u0438\u0442',
} as const

const decodeCoordinate = (value: string) => Number(atob(value))
const hashCode = (value: string) =>
  value.split('').reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0)

type HintLevel = 'ok' | 'warn' | 'bad'

type TuningHint = {
  id: 'frequency' | 'channel' | 'gain' | 'bandwidth'
  label: string
  text: string
  level: HintLevel
}

type MixerId = TuningHint['id']

type TargetProfile = {
  frequency: number
  channel: number
  gain: number
  bandwidth: number
  tolerance: number
}

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const createTargetProfile = (): TargetProfile => ({
  frequency: randomInt(TARGET_LIMITS.frequency.min, TARGET_LIMITS.frequency.max),
  channel: randomInt(TARGET_LIMITS.channel.min, TARGET_LIMITS.channel.max),
  gain: randomInt(TARGET_LIMITS.gain.min, TARGET_LIMITS.gain.max),
  bandwidth: randomInt(TARGET_LIMITS.bandwidth.min, TARGET_LIMITS.bandwidth.max),
  tolerance: randomInt(TARGET_LIMITS.tolerance.min, TARGET_LIMITS.tolerance.max),
})

const getFrequencyHint = (deviation: number, tolerance: number): TuningHint => {
  if (deviation <= tolerance) {
    return { id: 'frequency', label: 'FREQUENCY', text: STR.freqOk, level: 'ok' }
  }
  if (deviation <= tolerance * 2) {
    return {
      id: 'frequency',
      label: 'FREQUENCY',
      text: STR.freqClose,
      level: 'warn',
    }
  }
  return { id: 'frequency', label: 'FREQUENCY', text: STR.freqFar, level: 'bad' }
}

const getChannelHint = (deviation: number, tolerance: number): TuningHint => {
  if (deviation <= tolerance) {
    return { id: 'channel', label: 'CHANNEL', text: STR.channelOk, level: 'ok' }
  }
  return { id: 'channel', label: 'CHANNEL', text: STR.channelBad, level: 'bad' }
}

const getGainHint = (deviation: number, tolerance: number): TuningHint => {
  if (deviation <= tolerance) {
    return { id: 'gain', label: 'GAIN', text: STR.gainOk, level: 'ok' }
  }
  return { id: 'gain', label: 'GAIN', text: STR.gainBad, level: 'bad' }
}

const getBandwidthHint = (deviation: number, tolerance: number): TuningHint => {
  if (deviation <= tolerance) {
    return {
      id: 'bandwidth',
      label: 'BANDWIDTH',
      text: STR.bandwidthOk,
      level: 'ok',
    }
  }
  if (deviation <= tolerance * 2) {
    return {
      id: 'bandwidth',
      label: 'BANDWIDTH',
      text: STR.bandwidthClose,
      level: 'warn',
    }
  }
  return {
    id: 'bandwidth',
    label: 'BANDWIDTH',
    text: STR.bandwidthFar,
    level: 'bad',
  }
}

const deviationToNoise = (deviation: number, span: number) =>
  Math.min(100, Math.round((deviation / span) * 100))

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
  const handleRangeInput = (event: React.FormEvent<HTMLInputElement>) => {
    onChange(Number(event.currentTarget.value))
  }

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
        onInput={handleRangeInput}
        onChange={handleRangeInput}
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
  const [targetProfile, setTargetProfile] = useState(createTargetProfile)

  const targetLat = useMemo(() => decodeCoordinate(OBFUSCATED_COORDS.lat), [])
  const targetLon = useMemo(() => decodeCoordinate(OBFUSCATED_COORDS.lon), [])

  const resetRound = useCallback(() => {
    setTargetProfile(createTargetProfile())
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
  }, [])

  const endAttempt = useCallback(() => {
    resetRound()
    setActivationInput('')
    setActivationError('')
    setIsActivated(false)
    setSessionSecondsLeft(SESSION_DURATION_SECONDS)
  }, [resetRound])

  const signalDiagnostics = useMemo(() => {
    const freqDeviation = Math.abs(frequency - targetProfile.frequency)
    const channelDeviation = Math.abs(channel - targetProfile.channel)
    const gainDeviation = Math.abs(gain - targetProfile.gain)
    const bandwidthDeviation = Math.abs(bandwidth - targetProfile.bandwidth)

    const tolerance = targetProfile.tolerance
    const isSignalLocked =
      freqDeviation <= tolerance &&
      channelDeviation <= tolerance &&
      gainDeviation <= tolerance &&
      bandwidthDeviation <= tolerance

    const noiseLevel = isSignalLocked
      ? 0
      : Math.round(
          Math.max(
            deviationToNoise(freqDeviation, 42),
            deviationToNoise(channelDeviation, 14),
            deviationToNoise(gainDeviation, 28),
            deviationToNoise(bandwidthDeviation, 28),
          ),
        )

    return {
      freqDeviation,
      channelDeviation,
      gainDeviation,
      bandwidthDeviation,
      noiseLevel,
      isSignalLocked,
      tuningHints: [
        getFrequencyHint(freqDeviation, targetProfile.tolerance),
        getChannelHint(channelDeviation, targetProfile.tolerance),
        getGainHint(gainDeviation, targetProfile.tolerance),
        getBandwidthHint(bandwidthDeviation, targetProfile.tolerance),
      ],
    }
  }, [frequency, channel, gain, bandwidth, targetProfile])

  const { noiseLevel, isSignalLocked, tuningHints } = signalDiagnostics
  const isFrequencyAligned =
    Math.abs(frequency - targetProfile.frequency) <= targetProfile.tolerance
  const signalStrength = 100 - noiseLevel
  const noiseOpacity = 0.1 + (noiseLevel / 100) * 0.9
  const noiseSpeed = `${Math.max(0.04, 0.32 - (noiseLevel / 100) * 0.26)}s`

  const updateMixer = (id: MixerId, value: number) => {
    if (id === 'frequency') {
      setFrequency(value)
      return
    }
    if (id === 'channel') {
      setChannel(value)
      return
    }
    if (id === 'gain') {
      setGain(value)
      return
    }
    setBandwidth(value)
  }

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
    setActivationError(STR.activationError)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSignalLocked) {
      setMessage(STR.noSignal)
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
      setSecondsLeft(10)
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
  }, [isSuccess, resetRound])

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
  }, [isActivated, endAttempt])

  if (!isActivated) {
    return (
      <main className="mixer-app">
        <section className="activation-panel">
          <h1>{STR.activationTitle}</h1>
          <p>{STR.activationHint}</p>
          <form onSubmit={handleActivate}>
            <input
              type="password"
              value={activationInput}
              onChange={(event) => setActivationInput(event.target.value)}
              placeholder={STR.activationPlaceholder}
            />
            <button type="submit">{STR.activate}</button>
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
          <span>
            {STR.sessionTime} {formatSessionTime(sessionSecondsLeft)}
          </span>
          <button type="button" onClick={endAttempt}>
            {STR.endAttempt}
          </button>
        </div>
        <div className="controls">
          <h2>{STR.mixerTitle}</h2>
          <div className="mixer-chassis">
            <Knob
              label="FREQUENCY"
              value={frequency}
              min={FREQ_RANGE.min}
              max={FREQ_RANGE.max}
              unit=" MHz"
              onChange={(value) => updateMixer('frequency', value)}
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
                <span>BW</span>
                <strong>{bandwidth}%</strong>
              </div>
            </div>
            <Knob
              label="CHANNEL"
              value={channel}
              min={CHANNEL_RANGE.min}
              max={CHANNEL_RANGE.max}
              onChange={(value) => updateMixer('channel', value)}
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
              onChange={(value) => updateMixer('gain', value)}
              className="knob-gain"
            />
            <Knob
              label="BANDWIDTH"
              value={bandwidth}
              min={0}
              max={100}
              unit="%"
              onChange={(value) => updateMixer('bandwidth', value)}
              className="knob-bandwidth"
            />
          </div>
        </div>

        <section
          className={`signal-stage ${isSignalLocked ? 'signal-stage-locked' : ''}`}
          style={
            {
              '--noise-level': noiseLevel,
              '--noise-opacity': noiseOpacity,
              '--noise-speed': noiseSpeed,
            } as React.CSSProperties
          }
        >
          <div className="stage-content">
            <div className="hud-row">
              <p className="status">{STR.stationStatus}</p>
              <span className={`lock-pill ${isSignalLocked ? 'live' : ''}`}>
                {isSignalLocked ? 'LINK SECURED' : 'SIGNAL UNSTABLE'}
              </span>
            </div>
            <h1>{isSignalLocked ? STR.channelRestored : STR.searching}</h1>
          </div>
          <div className="noise-layer noise-layer-primary" aria-hidden="true" />
          <div className="noise-layer noise-layer-static" aria-hidden="true" />
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

        <div className="tuning-hints">
          <div className="tuning-hints-header">
            <span>{STR.tuningTitle}</span>
          </div>
          <div className="tuning-hints-grid">
            {tuningHints.map((hint) => (
              <div
                key={hint.id}
                className={`tuning-hint tuning-hint-${hint.level}`}
              >
                <span className="tuning-hint-label">{hint.label}</span>
                <span className="tuning-hint-text">{hint.text}</span>
              </div>
            ))}
          </div>
        </div>

        {!isSignalLocked ? (
          <div className="blocked-task">
            <p>{STR.taskBlocked}</p>
            <p>{STR.tuneHint}</p>
          </div>
        ) : (
          <article className="task">
            <p className="attention">{STR.attention}</p>
            <p>{STR.taskBody1}</p>
            <p>{STR.taskBody2}</p>
            <p>{STR.requirements}</p>
            <ul>
              <li>{STR.reqFormat}</li>
              <li>{STR.reqPrecision}</li>
              <li>{STR.reqExample}</li>
            </ul>
          </article>
        )}

        {!isSuccess && isFrequencyAligned ? (
          <form className="coords-form" onSubmit={handleSubmit}>
            <h2>{STR.coordsCheck}</h2>
            <div className="inputs">
              <label>
                <span>{STR.lat}</span>
                <input
                  type="text"
                  placeholder={isSignalLocked ? '00.00' : STR.noSignalShort}
                  value={latInput}
                  disabled={!isSignalLocked}
                  onChange={(event) => setLatInput(event.target.value)}
                />
              </label>
              <label>
                <span>{STR.lon}</span>
                <input
                  type="text"
                  placeholder={isSignalLocked ? '00.00' : STR.noSignalShort}
                  value={lonInput}
                  disabled={!isSignalLocked}
                  onChange={(event) => setLonInput(event.target.value)}
                />
              </label>
            </div>
            <button type="submit" disabled={!isSignalLocked}>
              {STR.submitCoords}
            </button>
            {message && <p className="message">{message}</p>}
          </form>
        ) : null}
      </section>
      {isSuccess && (
        <div className="code-modal-backdrop" role="dialog" aria-modal="true">
          <section className="code-modal">
            <h2>{STR.coordsConfirmed}</h2>
            <p>{STR.accessKey}</p>
            <p className="key">{ACCESS_KEY}</p>
            <p className="modal-hint">
              {STR.modalCloseIn} {secondsLeft} {STR.seconds}
            </p>
            <button type="button" onClick={resetRound}>
              {STR.close}
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
