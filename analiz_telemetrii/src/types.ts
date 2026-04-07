/** Строка телеметрии после парсинга CSV (см. ТЗ + lat/lon для геоподсказки). */
export type TelemetryRow = {
  time: number
  height: number
  speed: number
  battery: number
  voltage: number
  /** Широта, ° (WGS-84) */
  lat: number
  /** Долгота, ° */
  lon: number
}
