import type { ILevel } from '../types/game'

export const LEVELS: ILevel[] = [
  {
    id: 1,
    title: 'База',
    description: 'Долетите до точки в 5 метрах вперед.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: -5 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -8, y: -1, z: -12 },
      max: { x: 8, y: 8, z: 4 },
    },
    obstacles: [],
  },
  {
    id: 2,
    title: 'Обход препятствия',
    description: 'Поднимитесь, пролетите над стеной и спуститесь обратно.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: -5 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -8, y: -1, z: -12 },
      max: { x: 8, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'wall-1',
        position: { x: 0, y: 1.5, z: -2.5 },
        size: { x: 5, y: 3, z: 0.6 },
      },
    ],
  },
  {
    id: 3,
    title: 'Точное приземление',
    description: 'Доберитесь до платформы по диагонали.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 2, y: 0, z: -3 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -8, y: -1, z: -12 },
      max: { x: 8, y: 8, z: 4 },
    },
    obstacles: [],
  },
  {
    id: 4,
    title: 'Нижняя полка',
    description: 'Снизу перекрыто, поднимитесь и пролетите вперед.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 2, z: -6 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -9, y: -1, z: -16 },
      max: { x: 9, y: 9, z: 4 },
    },
    obstacles: [
      {
        id: 'floor-block-4',
        position: { x: 0, y: -0.4, z: -3 },
        size: { x: 8, y: 1.2, z: 3 },
      },
    ],
  },
  {
    id: 5,
    title: 'Верхняя полка',
    description: 'Сверху ограничение: держитесь ниже и летите к цели.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: -7 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -9, y: -1, z: -18 },
      max: { x: 9, y: 9, z: 4 },
    },
    obstacles: [
      {
        id: 'ceiling-block-5',
        position: { x: 0, y: 2.7, z: -3.5 },
        size: { x: 8, y: 3, z: 4 },
      },
    ],
  },
  {
    id: 6,
    title: 'Коридор между плитами',
    description: 'Пролетите между верхним и нижним ограничением.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 1, z: -8 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -10, y: -1, z: -20 },
      max: { x: 10, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'floor-6',
        position: { x: 0, y: -0.5, z: -4.5 },
        size: { x: 9, y: 1, z: 8 },
      },
      {
        id: 'ceiling-6',
        position: { x: 0, y: 3, z: -4.5 },
        size: { x: 9, y: 3, z: 8 },
      },
    ],
  },
  {
    id: 7,
    title: 'Точки справа',
    description: 'Цель смещена вправо, облетите центральную стену.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 4, y: 0, z: -8 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -10, y: -1, z: -20 },
      max: { x: 10, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'center-wall-7',
        position: { x: 0, y: 1.2, z: -5 },
        size: { x: 1.2, y: 2.4, z: 3.5 },
      },
    ],
  },
  {
    id: 8,
    title: 'Зигзаг между стенками',
    description: 'Две стены в шахматном порядке, цель слева.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: -4, y: 0, z: -9 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -11, y: -1, z: -22 },
      max: { x: 11, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'wall-r-8',
        position: { x: 2.4, y: 1.2, z: -4.5 },
        size: { x: 1.2, y: 2.4, z: 3.2 },
      },
      {
        id: 'wall-l-8',
        position: { x: -2.4, y: 1.2, z: -7.2 },
        size: { x: 1.2, y: 2.4, z: 3.2 },
      },
    ],
  },
  {
    id: 9,
    title: 'Дальняя точка',
    description: 'Точка далеко справа, обойдите три блока.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: 5, y: 0, z: -11 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -12, y: -1, z: -25 },
      max: { x: 12, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'block-l-9',
        position: { x: -2.8, y: 1.2, z: -4.5 },
        size: { x: 1.6, y: 2.4, z: 2.8 },
      },
      {
        id: 'block-c-9',
        position: { x: 0.5, y: 1.2, z: -7.2 },
        size: { x: 1.6, y: 2.4, z: 2.8 },
      },
      {
        id: 'block-r-9',
        position: { x: 3.2, y: 1.2, z: -9.4 },
        size: { x: 1.6, y: 2.4, z: 2.8 },
      },
    ],
  },
  {
    id: 10,
    title: 'Финальный зигзаг',
    description: 'Разные точки и стены, нужен точный маневр.',
    start: { x: 0, y: 0, z: 0 },
    target: { x: -5, y: 0, z: -12 },
    targetRadius: 0.8,
    bounds: {
      min: { x: -12, y: -1, z: -26 },
      max: { x: 12, y: 10, z: 4 },
    },
    obstacles: [
      {
        id: 'wall-a-10',
        position: { x: 2.8, y: 1.2, z: -4.2 },
        size: { x: 1.4, y: 2.4, z: 3.2 },
      },
      {
        id: 'wall-b-10',
        position: { x: -0.5, y: 1.2, z: -7.1 },
        size: { x: 1.4, y: 2.4, z: 3.2 },
      },
      {
        id: 'wall-c-10',
        position: { x: -3.6, y: 1.2, z: -9.8 },
        size: { x: 1.4, y: 2.4, z: 3.2 },
      },
      {
        id: 'wall-d-10',
        position: { x: -1.5, y: 1.2, z: -11.3 },
        size: { x: 1.4, y: 2.4, z: 2.2 },
      },
    ],
  },
]

export const SECRET_CODE = 'DDR-fQP6FW'
