import { useCallback, useRef } from 'react'
import type { MouseHandlerDataParam } from 'recharts/types/synchronisation/types'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { nearestRowByTime } from '../lib/nearestPoint'
import type { TelemetryRow } from '../types'

function FullRowTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: TelemetryRow }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const r = payload[0].payload
  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #374151',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div>
        <strong>time</strong>: {r.time} с
      </div>
      <div>
        <strong>height</strong>: {r.height.toFixed(2)} м
      </div>
      <div>
        <strong>speed</strong>: {r.speed.toFixed(2)} м/с
      </div>
      <div>
        <strong>battery</strong>: {r.battery.toFixed(2)} %
      </div>
      <div>
        <strong>voltage</strong>: {r.voltage.toFixed(2)} В
      </div>
      <div>
        <strong>lat</strong>: {r.lat.toFixed(5)}°
      </div>
      <div>
        <strong>lon</strong>: {r.lon.toFixed(5)}°
      </div>
    </div>
  )
}

type Props = {
  data: TelemetryRow[]
  syncId: string
  busy: boolean
  onChartClick: (nearestPoint: TelemetryRow) => void
}

export function TelemetryCharts({
  data,
  syncId,
  busy,
  onChartClick,
}: Props) {
  const pointerRef = useRef<MouseHandlerDataParam | null>(null)

  const handleMouseMove = useCallback((state: MouseHandlerDataParam) => {
    pointerRef.current = state
  }, [])

  const resolveClick = useCallback(
    (state: MouseHandlerDataParam) => {
      const idxFrom = (v: MouseHandlerDataParam['activeTooltipIndex']) =>
        typeof v === 'number' ? v : undefined

      let idx = idxFrom(state.activeTooltipIndex)
      if (idx === undefined && pointerRef.current) {
        idx = idxFrom(pointerRef.current.activeTooltipIndex)
      }

      if (idx !== undefined && data[idx]) {
        onChartClick(data[idx])
        return
      }

      if (typeof state.activeLabel === 'number') {
        onChartClick(nearestRowByTime(data, state.activeLabel))
        return
      }
      if (typeof state.activeLabel === 'string') {
        const t = Number(state.activeLabel)
        if (Number.isFinite(t)) onChartClick(nearestRowByTime(data, t))
      }
    },
    [data, onChartClick],
  )

  return (
    <section className="telemetry-charts" aria-busy={busy}>
      <div className="flight-app__chartBlock">
        <h2>Высота и скорость</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data}
            syncId={syncId}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onClick={resolveClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              label={{ value: 'time, с', position: 'insideBottom', offset: -4, fontSize: 11 }}
            />
            <YAxis
              yAxisId="h"
              tick={{ fontSize: 11 }}
              label={{ value: 'height, м', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <YAxis
              yAxisId="sp"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{ value: 'speed, м/с', angle: 90, position: 'insideRight', fontSize: 11 }}
            />
            <Tooltip content={FullRowTooltip} />
            <Legend />
            <Line
              yAxisId="h"
              type="monotone"
              dataKey="height"
              name="Высота"
              stroke="#38bdf8"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              yAxisId="sp"
              type="monotone"
              dataKey="speed"
              name="Скорость"
              stroke="#a78bfa"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flight-app__chartBlock">
        <h2>Напряжение и заряд</h2>
        <p className="flight-app__hint">
          Клик по области графика выбирает ближайшую по времени точку; в подсказке —
          все поля строки CSV.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            syncId={syncId}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onClick={resolveClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              label={{ value: 'time, с', position: 'insideBottom', offset: -4, fontSize: 11 }}
            />
            <YAxis
              yAxisId="v"
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
              label={{ value: 'voltage, В', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <YAxis
              yAxisId="bt"
              orientation="right"
              tick={{ fontSize: 11 }}
              domain={[0, 100]}
              label={{ value: 'battery, %', angle: 90, position: 'insideRight', fontSize: 11 }}
            />
            <Tooltip content={FullRowTooltip} />
            <Legend />
            <Line
              yAxisId="v"
              type="monotone"
              dataKey="voltage"
              name="Напряжение"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="bt"
              type="monotone"
              dataKey="battery"
              name="Заряд"
              stroke="#34d399"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
