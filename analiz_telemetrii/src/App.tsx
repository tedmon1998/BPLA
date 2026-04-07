import { useCallback, useEffect, useState } from 'react'
import { TelemetryCharts } from './components/TelemetryCharts'
import {
  activateAttempt,
  ensureBootstrap,
  finishAttempt,
  getAttemptStatus,
  resetBootstrap,
  verifyClick,
} from './api'
import { loadDefaultTelemetryCsv, parseTelemetryCsvString } from './parseTelemetry'
import type { TelemetryRow } from './types'
import './App.css'

/** Без координат и названий стран — только нейтральные справочники. */
const LINK_OSM_SEARCH = 'https://www.openstreetmap.org/search'
const LINK_ISO_WIKI = 'https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2'

const errText: Record<string, string> = {
  rate_limited: 'Слишком много попыток. Подождите минуту.',
  session_required: 'Сессия устарела. Обновите страницу.',
  invalid_token: 'Сессия недействительна. Обновите страницу.',
  too_fast: 'Подождите пару секунд после загрузки и попробуйте снова.',
  bad_country: 'Укажите код страны: две латинские буквы (ISO 3166-1 alpha-2).',
  wrong_time: 'Код страны принят, но выбран неверный момент аномалии. Попробуйте другой клик.',
  wrong_country: 'Момент аномалии выбран верно, но код страны неверный.',
  wrong_both: 'Неверны и момент аномалии, и код страны.',
  activation_required: 'Сначала активируйте попытку.',
}

const ROUND_SECONDS = 10

export default function App() {
  const [rows, setRows] = useState<TelemetryRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [modal, setModal] = useState<{ code: string; leftSec: number } | null>(null)
  const [countryIso2, setCountryIso2] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [attemptActive, setAttemptActive] = useState(false)
  const [attemptLeftSec, setAttemptLeftSec] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadDefaultTelemetryCsv()
      .then((text) => {
        if (cancelled) return
        setRows(parseTelemetryCsvString(text))
      })
      .catch(() => {
        if (!cancelled) setLoadError('Не удалось получить телеметрию. Обновите страницу.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const syncAttemptStatus = useCallback(async () => {
    try {
      const s = await getAttemptStatus()
      setAttemptActive(s.active)
      setAttemptLeftSec(s.remainingSec)
      if (s.active) {
        ensureBootstrap().catch(() => {
          setHint(
            'Не удалось связаться с сервером проверки. Запустите npm run dev или npm run start.',
          )
        })
      }
      if (!s.active) {
        setCountryIso2('')
        resetBootstrap()
      }
    } catch {
      setHint('Не удалось получить статус попытки. Проверьте сервер.')
    }
  }, [])

  useEffect(() => {
    void syncAttemptStatus()
  }, [syncAttemptStatus])

  useEffect(() => {
    if (!attemptActive) return
    if (attemptLeftSec <= 0) {
      setAttemptActive(false)
      setCountryIso2('')
      setHint('Время попытки истекло. Введите код активации снова.')
      resetBootstrap()
      return
    }
    const id = window.setTimeout(() => {
      setAttemptLeftSec((v) => Math.max(0, v - 1))
    }, 1000)
    return () => window.clearTimeout(id)
  }, [attemptActive, attemptLeftSec])

  const onActivate = useCallback(async () => {
    setHint(null)
    setBusy(true)
    try {
      const r = await activateAttempt(activationCode)
      if (!r.ok) {
        if (r.error === 'server_misconfigured') {
          setHint('Ошибка конфигурации сервера активации (.env).')
        } else if (r.error === 'rate_limited') {
          setHint('Слишком много попыток. Подождите минуту.')
        } else {
          setHint('Неверный код активации.')
        }
        return
      }
      setActivationCode('')
      setAttemptActive(true)
      setAttemptLeftSec(r.remainingSec)
      await ensureBootstrap()
    } catch {
      setHint('Ошибка активации. Проверьте сервер.')
    } finally {
      setBusy(false)
    }
  }, [activationCode])

  const onFinishAttempt = useCallback(async () => {
    await finishAttempt()
    setAttemptActive(false)
    setAttemptLeftSec(0)
    setCountryIso2('')
    setActivationCode('')
    setHint('Попытка завершена. Для новой попытки введите код активации.')
  }, [])

  const onChartPoint = useCallback(
    async (point: TelemetryRow) => {
      if (!attemptActive) {
        setHint('Сначала активируйте попытку.')
        return
      }
      setHint(null)
      const c = countryIso2.trim()
      if (c.length < 2) {
        setHint(errText.bad_country)
        return
      }
      setBusy(true)
      try {
        const res = await verifyClick(point.time, c)
        if (res.ok) {
          setModal({ code: res.code, leftSec: ROUND_SECONDS })
          return
        }
        const key = res.error && res.error in errText ? res.error : ''
        if (key) setHint(errText[key])
        else setHint('Неверная попытка. Проверьте и время аномалии, и код страны.')
      } finally {
        setBusy(false)
      }
    },
    [attemptActive, countryIso2],
  )

  const closeModal = useCallback(() => {
    setModal(null)
    resetBootstrap()
    setCountryIso2('')
    setHint('Раунд завершён. Задание перезапущено.')
  }, [])

  useEffect(() => {
    if (!modal) return
    if (modal.leftSec <= 0) {
      closeModal()
      return
    }
    const id = window.setTimeout(() => {
      setModal((prev) =>
        prev ? { ...prev, leftSec: Math.max(0, prev.leftSec - 1) } : prev,
      )
    }, 1000)
    return () => window.clearTimeout(id)
  }, [modal, closeModal])

  return (
    <div className="flight-app">
      {!attemptActive && (
        <div className="flight-app__authOnly">
          <div className="flight-app__authCard">
            <h1>Активация попытки</h1>
            <p className="flight-app__lead">
              До ввода кода активации интерфейс задания полностью заблокирован.
            </p>
            <label className="flight-app__countryLabel" htmlFor="activation-code">
              Код активации
            </label>
            <div className="flight-app__activationRow">
              <input
                id="activation-code"
                className="flight-app__countryInput"
                type="password"
                autoComplete="off"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Введите код"
              />
              <button
                type="button"
                className="flight-app__btn"
                onClick={onActivate}
                disabled={busy || activationCode.trim().length === 0}
              >
                Активировать
              </button>
            </div>
            {hint && <p className="flight-app__toast">{hint}</p>}
          </div>
        </div>
      )}
      <div className={attemptActive ? '' : 'flight-app__blurred'}>
      <header className="flight-app__header">
        <h1>Анализ телеметрии дрона</h1>
        <p className="flight-app__lead">
          В логе есть время, высота, скорость, заряд, напряжение, а также{' '}
          <strong>lat</strong> и <strong>lon</strong> (градусы WGS‑84). Нужно найти{' '}
          <strong>единственную критическую аномалию питания</strong>, взять из подсказки
          координаты именно в этой точке, по карте определить, <strong>в какой стране</strong>{' '}
          произошло событие, и ввести код страны в формате ISO2. Затем кликните по графику в
          момент этой аномалии для проверки.
        </p>
        <div className="flight-app__countryPanel">
          <div className="flight-app__attemptBar">
            <span>
              Время попытки:{' '}
              {attemptActive
                ? `${Math.floor(attemptLeftSec / 60)
                    .toString()
                    .padStart(2, '0')}:${(attemptLeftSec % 60)
                    .toString()
                    .padStart(2, '0')}`
                : 'не активна'}
            </span>
            {attemptActive && (
              <button
                type="button"
                className="flight-app__btn flight-app__btnWarn"
                onClick={onFinishAttempt}
              >
                Закончить попытку
              </button>
            )}
          </div>
          <label className="flight-app__countryLabel" htmlFor="country-iso">
            Код страны (ISO 3166-1 alpha-2)
          </label>
          <input
            id="country-iso"
            className="flight-app__countryInput"
            type="text"
            autoComplete="off"
            maxLength={8}
            placeholder="две латинские буквы"
            value={countryIso2}
            onChange={(e) => setCountryIso2(e.target.value)}
            aria-describedby="country-hint"
            disabled={!attemptActive}
          />
          <p id="country-hint" className="flight-app__countryHint">
            Координаты смотрите во всплывающей подсказке на графике в точке аномалии. Карты
            без готовых координат:{' '}
            <a href={LINK_OSM_SEARCH} target="_blank" rel="noreferrer">
              поиск OpenStreetMap
            </a>
            {' · '}
            <a href={LINK_ISO_WIKI} target="_blank" rel="noreferrer">
              список кодов ISO2
            </a>
            .
          </p>
        </div>
      </header>

      {loadError && <p className="flight-app__error">{loadError}</p>}

      {!loadError && rows === null && (
        <p className="flight-app__loading" aria-live="polite">
          Загрузка телеметрии…
        </p>
      )}

      {rows && rows.length > 0 && attemptActive && (
        <>
          <TelemetryCharts
            data={rows}
            syncId="flight"
            busy={busy}
            onChartClick={onChartPoint}
          />
          {hint && <p className="flight-app__toast">{hint}</p>}
        </>
      )}

      {modal && (
        <div className="flight-app__modalRoot" role="presentation" onClick={closeModal}>
          <div
            className="flight-app__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reward-title">Результат</h2>
            <p className="flight-app__code">{modal.code}</p>
            <p className="flight-app__countdown">
              Новый раунд начнётся через {modal.leftSec} сек.
            </p>
            <button type="button" className="flight-app__btn" onClick={closeModal}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
