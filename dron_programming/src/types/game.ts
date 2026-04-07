export type CommandName = 'forward' | 'up' | 'down' | 'left' | 'right' | 'hover'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface ICommand {
  type: CommandName
  value?: number
  raw: string
}

export interface Obstacle {
  id: string
  position: Vector3
  size: Vector3
}

export interface LevelBounds {
  min: Vector3
  max: Vector3
}

export interface ILevel {
  id: number
  title: string
  description: string
  start: Vector3
  target: Vector3
  targetRadius: number
  bounds: LevelBounds
  obstacles: Obstacle[]
}

export type RunOutcome = 'success' | 'error' | 'idle'
