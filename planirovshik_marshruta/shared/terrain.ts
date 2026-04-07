export type LatLng = [number, number]

export type CircleZone = {
  id: string
  center: LatLng
  radiusMeters: number
  kind: 'no-fly' | 'charging' | 'tree' | 'wind'
  label: string
  speedMultiplier?: number
}

export const yugraMapCenter: LatLng = [61.13, 71.2]

export const launchZone: CircleZone = {
  id: 'launch-zone',
  center: [61.0045, 69.02],
  radiusMeters: 3500,
  kind: 'charging',
  label: 'Ханты-Мансийск: зона вылета',
}

export const landingZone: CircleZone = {
  id: 'landing-zone',
  center: [61.254, 73.3962],
  radiusMeters: 3500,
  kind: 'charging',
  label: 'Сургут: зона посадки',
}

export const noFlyZones: CircleZone[] = [
  {
    id: 'nfz-1',
    center: [61.187, 71.1],
    radiusMeters: 12000,
    kind: 'no-fly',
    label: 'Бесполетная зона: заказник A',
  },
  {
    id: 'nfz-2',
    center: [61.045, 71.95],
    radiusMeters: 9000,
    kind: 'no-fly',
    label: 'Бесполетная зона: радар B',
  },
  {
    id: 'nfz-3',
    center: [61.223, 72.61],
    radiusMeters: 11000,
    kind: 'no-fly',
    label: 'Бесполетная зона: объект C',
  },
  {
    id: 'nfz-4',
    center: [61.075, 70.72],
    radiusMeters: 9200,
    kind: 'no-fly',
    label: 'Бесполетная зона: объект D',
  },
  {
    id: 'nfz-5',
    center: [61.17, 71.23],
    radiusMeters: 8600,
    kind: 'no-fly',
    label: 'Бесполетная зона: объект E',
  },
  {
    id: 'nfz-6',
    center: [61.208, 72.36],
    radiusMeters: 8800,
    kind: 'no-fly',
    label: 'Бесполетная зона: объект F',
  },
  {
    id: 'nfz-7',
    center: [61.02, 72.86],
    radiusMeters: 8400,
    kind: 'no-fly',
    label: 'Бесполетная зона: объект G',
  },
]

export const staticObstacles: CircleZone[] = [
  {
    id: 't-1',
    center: [61.136, 70.88],
    radiusMeters: 6000,
    kind: 'tree',
    label: 'Тайга: высокий ельник 1',
  },
  {
    id: 't-2',
    center: [61.06, 72.4],
    radiusMeters: 5200,
    kind: 'tree',
    label: 'Тайга: высокий ельник 2',
  },
  {
    id: 't-3',
    center: [61.242, 72.93],
    radiusMeters: 5400,
    kind: 'tree',
    label: 'Тайга: высокий ельник 3',
  },
]

export const chargingStations: CircleZone[] = [
  {
    id: 'c-1',
    center: [61.082, 70.08],
    radiusMeters: 3000,
    kind: 'charging',
    label: 'Зарядная станция Север-1',
  },
  {
    id: 'c-2',
    center: [61.168, 71.46],
    radiusMeters: 3000,
    kind: 'charging',
    label: 'Зарядная станция Таежная',
  },
  {
    id: 'c-3',
    center: [61.225, 72.74],
    radiusMeters: 3200,
    kind: 'charging',
    label: 'Зарядная станция Восток',
  },
  {
    id: 'c-4',
    center: [61.03, 69.62],
    radiusMeters: 2800,
    kind: 'charging',
    label: 'Зарядная станция Лесная',
  },
  {
    id: 'c-5',
    center: [61.105, 70.68],
    radiusMeters: 2600,
    kind: 'charging',
    label: 'Зарядная станция Транзит-1',
  },
  {
    id: 'c-6',
    center: [61.162, 71.96],
    radiusMeters: 2900,
    kind: 'charging',
    label: 'Зарядная станция Транзит-2',
  },
  {
    id: 'c-7',
    center: [61.238, 73.1],
    radiusMeters: 3100,
    kind: 'charging',
    label: 'Зарядная станция Финал',
  },
]

export const windZones: CircleZone[] = [
  {
    id: 'w-1',
    center: [61.04, 69.58],
    radiusMeters: 7200,
    kind: 'wind',
    speedMultiplier: 0.75,
    label: 'Сильный ветер W1',
  },
  {
    id: 'w-2',
    center: [61.108, 69.98],
    radiusMeters: 6800,
    kind: 'wind',
    speedMultiplier: 0.7,
    label: 'Сильный ветер W2',
  },
  {
    id: 'w-3',
    center: [61.15, 70.41],
    radiusMeters: 7000,
    kind: 'wind',
    speedMultiplier: 0.65,
    label: 'Шквал W3',
  },
  {
    id: 'w-4',
    center: [61.09, 70.95],
    radiusMeters: 7600,
    kind: 'wind',
    speedMultiplier: 0.72,
    label: 'Боковой ветер W4',
  },
  {
    id: 'w-5',
    center: [61.03, 71.38],
    radiusMeters: 8400,
    kind: 'wind',
    speedMultiplier: 0.62,
    label: 'Порывы W5',
  },
  {
    id: 'w-6',
    center: [61.19, 71.9],
    radiusMeters: 6900,
    kind: 'wind',
    speedMultiplier: 0.78,
    label: 'Сильный ветер W6',
  },
  {
    id: 'w-7',
    center: [61.22, 72.19],
    radiusMeters: 6600,
    kind: 'wind',
    speedMultiplier: 0.66,
    label: 'Шквал W7',
  },
  {
    id: 'w-8',
    center: [61.18, 72.5],
    radiusMeters: 7800,
    kind: 'wind',
    speedMultiplier: 0.73,
    label: 'Порывы W8',
  },
  {
    id: 'w-9',
    center: [61.13, 72.88],
    radiusMeters: 7100,
    kind: 'wind',
    speedMultiplier: 0.69,
    label: 'Сильный ветер W9',
  },
  {
    id: 'w-10',
    center: [61.25, 73.16],
    radiusMeters: 7200,
    kind: 'wind',
    speedMultiplier: 0.74,
    label: 'Сильный ветер W10',
  },
  {
    id: 'w-11',
    center: [61.067, 69.29],
    radiusMeters: 7400,
    kind: 'wind',
    speedMultiplier: 0.71,
    label: 'Сильный ветер W11',
  },
  {
    id: 'w-12',
    center: [61.129, 69.74],
    radiusMeters: 7200,
    kind: 'wind',
    speedMultiplier: 0.68,
    label: 'Сильный ветер W12',
  },
  {
    id: 'w-13',
    center: [61.184, 70.14],
    radiusMeters: 6900,
    kind: 'wind',
    speedMultiplier: 0.67,
    label: 'Порывы W13',
  },
  {
    id: 'w-14',
    center: [61.224, 70.62],
    radiusMeters: 7700,
    kind: 'wind',
    speedMultiplier: 0.7,
    label: 'Шквал W14',
  },
  {
    id: 'w-15',
    center: [61.042, 71.08],
    radiusMeters: 8200,
    kind: 'wind',
    speedMultiplier: 0.63,
    label: 'Порывы W15',
  },
  {
    id: 'w-16',
    center: [61.152, 71.44],
    radiusMeters: 7800,
    kind: 'wind',
    speedMultiplier: 0.65,
    label: 'Шквал W16',
  },
  {
    id: 'w-17',
    center: [61.236, 71.82],
    radiusMeters: 7000,
    kind: 'wind',
    speedMultiplier: 0.76,
    label: 'Сильный ветер W17',
  },
  {
    id: 'w-18',
    center: [61.074, 72.23],
    radiusMeters: 6800,
    kind: 'wind',
    speedMultiplier: 0.72,
    label: 'Сильный ветер W18',
  },
  {
    id: 'w-19',
    center: [61.166, 72.68],
    radiusMeters: 7400,
    kind: 'wind',
    speedMultiplier: 0.69,
    label: 'Шквал W19',
  },
  {
    id: 'w-20',
    center: [61.202, 73.04],
    radiusMeters: 7100,
    kind: 'wind',
    speedMultiplier: 0.73,
    label: 'Сильный ветер W20',
  },
]

export const validDistanceRangeKm = {
  min: 250,
  max: 290,
}

export const missionRules = {
  baseSpeedKmh: 92,
  batteryCapacityKm: 120,
  missionTimeLimitMin: 220,
  chargingMinutes: 14,
  simulationStepKm: 2.1,
  autoChargeThresholdKm: 38,
}

export const missionKey = 'ROUTE-108'
