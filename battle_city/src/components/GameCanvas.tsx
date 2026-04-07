import { useEffect, useRef } from 'react'
import { AI_SPAWN, DRONE_SPAWN, FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../data/map'
import { useGameStore } from '../store/gameStore'
import type { AimAngle, PlayerId } from '../types/game'
import spritesPng from '../assets/sprites.png'

type Vec = { x: number; y: number }
type Bullet = {
  id: number
  owner: PlayerId
  x: number
  y: number
  vx: number
  vy: number
  ricochetsLeft: number
  pierce: boolean
}
type PowerType = 'double_shot' | 'ricochet' | 'mine' | 'health' | 'pierce'
type PowerItem = { id: number; type: PowerType; x: number; y: number }
type Mine = { id: number; owner: PlayerId; x: number; y: number }
type PlayerBuff = { doubleShotUntil: number; ricochetShots: number; mineCharges: number; pierceShots: number }
type PlayerBuffs = Record<PlayerId, PlayerBuff>
type TempWall = { id: number; tx: number; ty: number; createdAtMs: number }

const PLAYER_RADIUS = 12
const BULLET_RADIUS = 4
const PLAYER_SPEED = 130
const BULLET_SPEED = 290
const SHOT_COOLDOWN_MS = 300
const MAX_BULLETS_PER_PLAYER = 2
const POWERUP_COUNT = 5
const MAX_POWERUPS = 7
const MAX_TEMP_WALLS = 12
const WALL_APPEAR_MS = 2500

const BUFF_SPAWN_MIN_MS = 4500
const BUFF_SPAWN_MAX_MS = 9000
const WALL_SPAWN_MIN_MS = 6000
const WALL_SPAWN_MAX_MS = 12000

const hitsSolid = (x: number, y: number, radius: number): boolean => {
  const map = useGameStore.getState().map
  const points = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ]

  for (const point of points) {
    const tx = Math.floor(point.x / TILE_SIZE)
    const ty = Math.floor(point.y / TILE_SIZE)
    if (tx < 0 || ty < 0 || ty >= map.length || tx >= map[0].length) return true
    if (map[ty][tx] === 1) return true
  }

  return false
}

const circleHit = (a: Vec, b: Vec, r: number): boolean => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy <= r * r
}

const initialBuffs = (): PlayerBuffs => ({
  ai: { doubleShotUntil: 0, ricochetShots: 0, mineCharges: 0, pierceShots: 0 },
  drone: { doubleShotUntil: 0, ricochetShots: 0, mineCharges: 0, pierceShots: 0 },
})

const randomFreePoint = (): Vec => {
  for (let i = 0; i < 200; i += 1) {
    const x = TILE_SIZE * 1.5 + Math.random() * (FIELD_WIDTH - TILE_SIZE * 3)
    const y = TILE_SIZE * 1.5 + Math.random() * (FIELD_HEIGHT - TILE_SIZE * 3)
    if (!hitsSolid(x, y, PLAYER_RADIUS + 2)) return { x, y }
  }
  return { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 }
}

const randomPowerType = (): PowerType => {
  // Weighted so rare buffs still appear visibly.
  const roll = Math.random()
  if (roll < 0.24) return 'double_shot'
  if (roll < 0.44) return 'ricochet'
  if (roll < 0.62) return 'mine'
  if (roll < 0.80) return 'health'
  return 'pierce'
}

const buildPowerItems = (): PowerItem[] => {
  // Guarantee at least one of each "important" buff in initial set so you can see/test them.
  const guaranteed: PowerType[] = ['double_shot', 'ricochet', 'mine', 'health', 'pierce']
  const items: PowerItem[] = []
  for (let i = 0; i < POWERUP_COUNT; i += 1) {
    const point = randomFreePoint()
    const type = guaranteed[i] ?? randomPowerType()
    items.push({ id: i + 1, type, x: point.x, y: point.y })
  }
  return items
}

const quantizeAngleTo8 = (angle: number): number => {
  const step = Math.PI / 4
  return Math.round(angle / step) * step
}

const getTempWallTilesHit = (x: number, y: number, radius: number): { tx: number; ty: number }[] => {
  const points = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ]
  const tiles: { tx: number; ty: number }[] = []
  for (const p of points) {
    const tx = Math.floor(p.x / TILE_SIZE)
    const ty = Math.floor(p.y / TILE_SIZE)
    if (!tiles.some((t) => t.tx === tx && t.ty === ty)) tiles.push({ tx, ty })
  }
  return tiles
}

type SpriteKey = 'drone' | 'robot'

const drawSprite = (
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number },
  key: SpriteKey,
  x: number,
  y: number,
  angle: AimAngle,
) => {
  // Image is 1024x768: left is drone, right is robot.
  const nw = typeof img.naturalWidth === 'number' ? img.naturalWidth : (img as HTMLCanvasElement).width
  const nh = typeof img.naturalHeight === 'number' ? img.naturalHeight : (img as HTMLCanvasElement).height
  const sw = nw / 2
  const sh = nh
  const sx = key === 'drone' ? 0 : sw
  const sy = 0

  // Draw scaled to ~tile-ish size
  const dw = 46
  const dh = 46

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

const drawAimIndicator = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: AimAngle,
  color: string,
) => {
  const sx = x + Math.cos(angle) * 8
  const sy = y + Math.sin(angle) * 8
  const ex = x + Math.cos(angle) * 26
  const ey = y + Math.sin(angle) * 26

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()

  // Arrow head
  ctx.fillStyle = color
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(
    ex + Math.cos(angle + Math.PI * 0.8) * 6,
    ey + Math.sin(angle + Math.PI * 0.8) * 6,
  )
  ctx.lineTo(
    ex + Math.cos(angle - Math.PI * 0.8) * 6,
    ey + Math.sin(angle - Math.PI * 0.8) * 6,
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

const drawSoldier = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: AimAngle) => {
  ctx.save()

  // Shadow under the soldier
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 3, PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()

  const ang = angle

  // Torso
  ctx.fillStyle = '#63f5b0'
  ctx.strokeStyle = 'rgba(99,245,176,0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(x, y + 1, PLAYER_RADIUS * 0.85, PLAYER_RADIUS * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Vest / inner panel
  ctx.fillStyle = 'rgba(6,14,32,0.32)'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, PLAYER_RADIUS * 0.45, PLAYER_RADIUS * 0.52, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head
  ctx.fillStyle = 'rgba(255, 226, 197, 0.95)'
  ctx.strokeStyle = 'rgba(6,14,32,0.25)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y - PLAYER_RADIUS * 0.85, PLAYER_RADIUS * 0.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Helmet
  ctx.fillStyle = 'rgba(6,14,32,0.35)'
  ctx.beginPath()
  ctx.arc(x, y - PLAYER_RADIUS * 0.92, PLAYER_RADIUS * 0.48, Math.PI, 0)
  ctx.fill()

  // Arms (simple shoulder pads)
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.beginPath()
  ctx.arc(x - PLAYER_RADIUS * 0.7, y - PLAYER_RADIUS * 0.05, PLAYER_RADIUS * 0.22, 0, Math.PI * 2)
  ctx.arc(x + PLAYER_RADIUS * 0.7, y - PLAYER_RADIUS * 0.05, PLAYER_RADIUS * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // Weapon (barrel points in direction)
  const bx = x + Math.cos(ang) * (PLAYER_RADIUS * 0.55)
  const by = y + Math.sin(ang) * (PLAYER_RADIUS * 0.55)
  const ex = x + Math.cos(ang) * (PLAYER_RADIUS * 1.35)
  const ey = y + Math.sin(ang) * (PLAYER_RADIUS * 1.35)
  ctx.strokeStyle = 'rgba(6,14,32,0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(ex, ey)
  ctx.stroke()

  // Muzzle highlight
  ctx.fillStyle = 'rgba(255, 222, 89, 0.95)'
  ctx.beginPath()
  ctx.arc(ex, ey, 2.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

const drawDrone = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: AimAngle) => {
  ctx.save()

  // Shadow under the drone
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 3, PLAYER_RADIUS * 0.95, PLAYER_RADIUS * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()

  const size = PLAYER_RADIUS * 1.8
  const ang = angle

  // Outer rotor glow
  ctx.strokeStyle = 'rgba(108,181,255,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, PLAYER_RADIUS * 1.05, 0, Math.PI * 2)
  ctx.stroke()

  // Central body
  ctx.fillStyle = '#6cb5ff'
  ctx.strokeStyle = 'rgba(108,181,255,0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Arms cross
  ctx.strokeStyle = 'rgba(6,14,32,0.45)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x - size * 0.42, y)
  ctx.lineTo(x - size * 0.18, y)
  ctx.moveTo(x + size * 0.18, y)
  ctx.lineTo(x + size * 0.42, y)
  ctx.moveTo(x, y - size * 0.42)
  ctx.lineTo(x, y - size * 0.18)
  ctx.moveTo(x, y + size * 0.18)
  ctx.lineTo(x, y + size * 0.42)
  ctx.stroke()

  // Inner ring
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, size * 0.32, 0, Math.PI * 2)
  ctx.stroke()

  // Weapon turret (barrel points to movement direction)
  ctx.fillStyle = 'rgba(6,14,32,0.55)'
  ctx.beginPath()
  ctx.arc(x, y, PLAYER_RADIUS * 0.23, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(108,181,255,0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, PLAYER_RADIUS * 0.33, 0, Math.PI * 2)
  ctx.stroke()

  const barrelStart = {
    x: x + Math.cos(ang) * (PLAYER_RADIUS * 0.35),
    y: y + Math.sin(ang) * (PLAYER_RADIUS * 0.35),
  }
  const barrelEnd = {
    x: x + Math.cos(ang) * (PLAYER_RADIUS * 1.32),
    y: y + Math.sin(ang) * (PLAYER_RADIUS * 1.32),
  }

  // Barrel body
  ctx.strokeStyle = 'rgba(6,14,32,0.75)'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(barrelStart.x, barrelStart.y)
  ctx.lineTo(barrelEnd.x, barrelEnd.y)
  ctx.stroke()

  // Barrel glow outline (makes it clearly a weapon)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(barrelStart.x, barrelStart.y)
  ctx.lineTo(barrelEnd.x, barrelEnd.y)
  ctx.stroke()

  // Muzzle flash
  ctx.fillStyle = 'rgba(170, 220, 255, 0.95)'
  ctx.beginPath()
  ctx.arc(barrelEnd.x, barrelEnd.y, 2.6, 0, Math.PI * 2)
  ctx.fill()

  // Tiny rotor blades
  const bladeOffsets: Vec[] = [
    { x: 0, y: -size * 0.55 },
    { x: size * 0.55, y: 0 },
    { x: 0, y: size * 0.55 },
    { x: -size * 0.55, y: 0 },
  ]
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  for (const o of bladeOffsets) {
    ctx.beginPath()
    ctx.moveTo(x + o.x - 3, y + o.y)
    ctx.lineTo(x + o.x + 3, y + o.y)
    ctx.moveTo(x + o.x, y + o.y - 3)
    ctx.lineTo(x + o.x, y + o.y + 3)
    ctx.stroke()
  }

  ctx.restore()
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const spritesRef = useRef<HTMLImageElement | null>(null)
  const spritesProcessedRef = useRef<HTMLCanvasElement | null>(null)
  const pressedRef = useRef(new Set<string>())
  const bulletsRef = useRef<Bullet[]>([])
  const itemsRef = useRef<PowerItem[]>([])
  const minesRef = useRef<Mine[]>([])
  const tempWallsRef = useRef<TempWall[]>([])
  const buffsRef = useRef<PlayerBuffs>(initialBuffs())
  const bulletIdRef = useRef(1)
  const entityIdRef = useRef(1000)
  const lastShotRef = useRef<Record<PlayerId, number>>({ ai: 0, drone: 0 })
  const nextBuffSpawnAtMsRef = useRef<number>(0)
  const nextWallSpawnAtMsRef = useRef<number>(0)
  const lastTickRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const gameState = useGameStore((s) => s.gameState)
  const roundResetToken = useGameStore((s) => s.roundResetToken)

  useEffect(() => {
    const img = new Image()
    img.src = spritesPng
    spritesRef.current = img

    const onLoad = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) return

      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return
      octx.drawImage(img, 0, 0)

      const imageData = octx.getImageData(0, 0, w, h)
      const data = imageData.data
      // Make near-black pixels transparent (remove background).
      // Threshold tuned for current sprite sheet.
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (r < 18 && g < 18 && b < 18) {
          data[i + 3] = 0
        }
      }
      octx.putImageData(imageData, 0, 0)
      spritesProcessedRef.current = off
    }

    img.addEventListener('load', onLoad)
    return () => img.removeEventListener('load', onLoad)
  }, [])

  useEffect(() => {
    if (gameState !== 'start') return
    bulletsRef.current = []
    minesRef.current = []
    itemsRef.current = []
    tempWallsRef.current = []
    buffsRef.current = initialBuffs()
    lastShotRef.current = { ai: 0, drone: 0 }
  }, [gameState])

  useEffect(() => {
    if (gameState === 'start') return
    const store = useGameStore.getState()
    store.setPosition('ai', AI_SPAWN.x, AI_SPAWN.y)
    store.setPosition('drone', DRONE_SPAWN.x, DRONE_SPAWN.y)
    store.setAimAngle('ai', 0)
    store.setAimAngle('drone', Math.PI)
    bulletsRef.current = []
    minesRef.current = []
    itemsRef.current = buildPowerItems()
    tempWallsRef.current = []
    buffsRef.current = initialBuffs()
    nextBuffSpawnAtMsRef.current = Date.now() + 2500
    nextWallSpawnAtMsRef.current = Date.now() + 4000
  }, [roundResetToken, gameState])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      pressedRef.current.add(event.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault()
      }
    }
    const up = (event: KeyboardEvent) => {
      pressedRef.current.delete(event.code)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = (time: number) => {
      const store = useGameStore.getState()
      const dt = Math.min((time - (lastTickRef.current || time)) / 1000, 0.05)
      lastTickRef.current = time
      const keys = pressedRef.current

      if (store.gameState === 'playing') {
        const hitsDynamicWall = (x: number, y: number, radius: number): boolean => {
          // treat temp walls as solid tiles
          const points = [
            { x: x - radius, y: y - radius },
            { x: x + radius, y: y - radius },
            { x: x - radius, y: y + radius },
            { x: x + radius, y: y + radius },
          ]
          for (const p of points) {
            const tx = Math.floor(p.x / TILE_SIZE)
            const ty = Math.floor(p.y / TILE_SIZE)
            if (tempWallsRef.current.some((w) => w.tx === tx && w.ty === ty)) return true
          }
          return false
        }

        const hitsAnyWall = (x: number, y: number, radius: number): boolean => {
          return hitsSolid(x, y, radius) || hitsDynamicWall(x, y, radius)
        }

        const movePlayer8 = (
          player: PlayerId,
          upKey: string,
          downKey: string,
          leftKey: string,
          rightKey: string,
        ) => {
          let dx = 0
          let dy = 0
          if (keys.has(leftKey)) dx -= 1
          if (keys.has(rightKey)) dx += 1
          if (keys.has(upKey)) dy -= 1
          if (keys.has(downKey)) dy += 1
          if (dx === 0 && dy === 0) return

          const len = Math.hypot(dx, dy) || 1
          dx /= len
          dy /= len

          const from = store.positions[player]
          const nx = from.x + dx * PLAYER_SPEED * dt
          const ny = from.y + dy * PLAYER_SPEED * dt
          if (!hitsAnyWall(nx, ny, PLAYER_RADIUS)) {
            store.setPosition(player, nx, ny)
          }

          const aim = quantizeAngleTo8(Math.atan2(dy, dx))
          store.setAimAngle(player, aim)
        }

        movePlayer8('ai', 'KeyW', 'KeyS', 'KeyA', 'KeyD')
        movePlayer8('drone', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')

        // Spawn random buffs and temporary walls over time (not too frequent)
        const nowMs = Date.now()
        if (nowMs >= nextBuffSpawnAtMsRef.current && itemsRef.current.length < MAX_POWERUPS) {
          const p = randomFreePoint()
          itemsRef.current.push({ id: entityIdRef.current++, type: randomPowerType(), x: p.x, y: p.y })
          nextBuffSpawnAtMsRef.current =
            nowMs + (BUFF_SPAWN_MIN_MS + Math.random() * (BUFF_SPAWN_MAX_MS - BUFF_SPAWN_MIN_MS))
        }

        if (nowMs >= nextWallSpawnAtMsRef.current && tempWallsRef.current.length < MAX_TEMP_WALLS) {
          // find random empty tile
          for (let i = 0; i < 250; i += 1) {
            const tx = 1 + Math.floor(Math.random() * (FIELD_WIDTH / TILE_SIZE - 2))
            const ty = 1 + Math.floor(Math.random() * (FIELD_HEIGHT / TILE_SIZE - 2))
            if (useGameStore.getState().map[ty][tx] === 1) continue
            if (tempWallsRef.current.some((w) => w.tx === tx && w.ty === ty)) continue
            // avoid spawning directly on players
            const cx = tx * TILE_SIZE + TILE_SIZE / 2
            const cy = ty * TILE_SIZE + TILE_SIZE / 2
            const aiPos = store.positions.ai
            const drPos = store.positions.drone
            if (circleHit({ x: cx, y: cy }, aiPos, TILE_SIZE * 1.3)) continue
            if (circleHit({ x: cx, y: cy }, drPos, TILE_SIZE * 1.3)) continue
            tempWallsRef.current.push({
              id: entityIdRef.current++,
              tx,
              ty,
              createdAtMs: nowMs,
            })
            break
          }
          nextWallSpawnAtMsRef.current =
            nowMs + (WALL_SPAWN_MIN_MS + Math.random() * (WALL_SPAWN_MAX_MS - WALL_SPAWN_MIN_MS))
        }

        const tryShoot = (player: PlayerId, code: string) => {
          if (!keys.has(code)) return
          const now = performance.now()
          const activeCount = bulletsRef.current.filter((b) => b.owner === player).length
          const cooldownReady = now - lastShotRef.current[player] >= SHOT_COOLDOWN_MS
          if (activeCount >= MAX_BULLETS_PER_PLAYER || !cooldownReady) return

          const pos = useGameStore.getState().positions[player]
          const angle = useGameStore.getState().aimAngles[player]
          const buffs = buffsRef.current[player]
          const ricochetShots = buffs.ricochetShots > 0 ? 1 : 0
          if (buffs.ricochetShots > 0) {
            buffsRef.current[player] = { ...buffs, ricochetShots: buffs.ricochetShots - 1 }
          }
          const pierce = buffs.pierceShots > 0
          if (buffs.pierceShots > 0) {
            buffsRef.current[player] = { ...buffsRef.current[player], pierceShots: buffs.pierceShots - 1 }
          }

          const spawnBullet = (offset: Vec) => {
            const vx = Math.cos(angle) * BULLET_SPEED
            const vy = Math.sin(angle) * BULLET_SPEED
            bulletsRef.current.push({
              id: bulletIdRef.current++,
              owner: player,
              x: pos.x + offset.x,
              y: pos.y + offset.y,
              vx,
              vy,
              ricochetsLeft: ricochetShots,
              pierce,
            })
          }

          const nowMs = Date.now()
          const hasDoubleShot = buffs.doubleShotUntil > nowMs
          if (hasDoubleShot) {
            const ax = Math.cos(angle)
            const ay = Math.sin(angle)
            if (Math.abs(ay) > Math.abs(ax)) {
              spawnBullet({ x: -5, y: 0 })
              spawnBullet({ x: 5, y: 0 })
            } else {
              spawnBullet({ x: 0, y: -5 })
              spawnBullet({ x: 0, y: 5 })
            }
          } else {
            spawnBullet({ x: 0, y: 0 })
          }

          if (buffs.mineCharges > 0) {
            minesRef.current.push({
              id: entityIdRef.current++,
              owner: player,
              x: pos.x,
              y: pos.y,
            })
            buffsRef.current[player] = {
              ...buffsRef.current[player],
              mineCharges: buffsRef.current[player].mineCharges - 1,
            }
          }

          lastShotRef.current[player] = now
        }

        tryShoot('ai', 'Space')
        tryShoot('drone', 'Enter')
        tryShoot('drone', 'Numpad0')

        const nextBullets: Bullet[] = []
        let hasTriggeredQuestion = false

        // Collect random power-ups
        const aiPos = useGameStore.getState().positions.ai
        const dronePos = useGameStore.getState().positions.drone
        itemsRef.current = itemsRef.current.filter((item) => {
          const aiCollect = circleHit(item, aiPos, PLAYER_RADIUS + 8)
          const droneCollect = circleHit(item, dronePos, PLAYER_RADIUS + 8)
          if (!aiCollect && !droneCollect) return true

          const collector: PlayerId = aiCollect ? 'ai' : 'drone'
          const store = useGameStore.getState()
          const buff = buffsRef.current[collector]
          if (item.type === 'double_shot') {
            buffsRef.current[collector] = { ...buff, doubleShotUntil: Date.now() + 10000 }
          } else if (item.type === 'ricochet') {
            buffsRef.current[collector] = { ...buff, ricochetShots: buff.ricochetShots + 4 }
          } else if (item.type === 'mine') {
            buffsRef.current[collector] = { ...buff, mineCharges: buff.mineCharges + 2 }
          } else if (item.type === 'pierce') {
            // One-shot pierce: applies to the next shot only.
            buffsRef.current[collector] = { ...buff, pierceShots: buff.pierceShots + 1 }
          } else {
            store.heal(collector, 1)
          }

          return false
        })

        // Mines explode on enemy contact: count as a hit (lethal hit triggers question in store).
        const nextMines: Mine[] = []
        for (const mine of minesRef.current) {
          const enemy: PlayerId = mine.owner === 'ai' ? 'drone' : 'ai'
          const enemyPos = useGameStore.getState().positions[enemy]
          const exploded = circleHit(mine, enemyPos, PLAYER_RADIUS + 6)
          if (exploded) {
            useGameStore.getState().takeHit(enemy)
            hasTriggeredQuestion = useGameStore.getState().gameState === 'paused_question' || hasTriggeredQuestion
            continue
          }
          if (!exploded) nextMines.push(mine)
        }
        minesRef.current = hasTriggeredQuestion ? [] : nextMines

        for (const bullet of bulletsRef.current) {
          const moved = {
            ...bullet,
            x: bullet.x + bullet.vx * dt,
            y: bullet.y + bullet.vy * dt,
          }

          // Always remove bullets that leave the field (prevents "stuck" bullets blocking shooting).
          if (moved.x < -20 || moved.y < -20 || moved.x > FIELD_WIDTH + 20 || moved.y > FIELD_HEIGHT + 20) {
            continue
          }

          const collide = hitsAnyWall(moved.x, moved.y, BULLET_RADIUS)
          if (collide) {
            if (bullet.pierce) {
              // Pierce buff: bullets pass through walls (inside map) without breaking them.
              nextBullets.push(moved)
              continue
            }
            // One-hit destructible temp walls
            const hitTiles = getTempWallTilesHit(moved.x, moved.y, BULLET_RADIUS)
            const before = tempWallsRef.current.length
            tempWallsRef.current = tempWallsRef.current.filter(
              (w) => !hitTiles.some((t) => t.tx === w.tx && t.ty === w.ty),
            )
            const destroyedTempWall = before !== tempWallsRef.current.length

            if (!destroyedTempWall && bullet.ricochetsLeft > 0) {
              // Reflect on axes based on which component collides
              const testX = hitsAnyWall(moved.x, bullet.y, BULLET_RADIUS)
              const testY = hitsAnyWall(bullet.x, moved.y, BULLET_RADIUS)
              let nvx = bullet.vx
              let nvy = bullet.vy
              if (testX) nvx = -nvx
              if (testY) nvy = -nvy
              if (!testX && !testY) {
                // fallback
                nvx = -nvx
                nvy = -nvy
              }
              nextBullets.push({ ...bullet, vx: nvx, vy: nvy, ricochetsLeft: bullet.ricochetsLeft - 1 })
            }
            continue
          }

          const target: PlayerId = bullet.owner === 'ai' ? 'drone' : 'ai'
          const targetPos = useGameStore.getState().positions[target]
          const hitTarget = circleHit(moved, targetPos, PLAYER_RADIUS + BULLET_RADIUS)
          if (hitTarget && !hasTriggeredQuestion) {
            useGameStore.getState().takeHit(target)
            hasTriggeredQuestion = useGameStore.getState().gameState === 'paused_question'
            continue
          }

          if (!hitTarget) {
            nextBullets.push(moved)
          }
        }

        bulletsRef.current = hasTriggeredQuestion ? [] : nextBullets
      }

      const latest = useGameStore.getState()
      ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)
      const map = latest.map
      for (let y = 0; y < map.length; y += 1) {
        for (let x = 0; x < map[y].length; x += 1) {
          ctx.fillStyle = map[y][x] === 1 ? '#2b2f4a' : '#111522'
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          ctx.strokeStyle = '#1f2438'
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }

      const ai = latest.positions.ai
      const drone = latest.positions.drone
      const aiAim = latest.aimAngles.ai
      const droneAim = latest.aimAngles.drone
      const sprites = spritesProcessedRef.current ?? spritesRef.current
      if (sprites && 'complete' in sprites ? sprites.complete : true) {
        // drawSprite expects HTMLImageElement; but Canvas also supports CanvasImageSource.
        // We cast here since drawSprite uses drawImage which accepts both.
        drawSprite(ctx, sprites as unknown as HTMLImageElement, 'robot', ai.x, ai.y, aiAim)
        drawSprite(ctx, sprites as unknown as HTMLImageElement, 'drone', drone.x, drone.y, droneAim)
      } else {
        // fallback until image loaded
        drawSoldier(ctx, ai.x, ai.y, aiAim)
        drawDrone(ctx, drone.x, drone.y, droneAim)
      }

      // Aim indicators (make direction of shooting obvious)
      drawAimIndicator(ctx, ai.x, ai.y, aiAim, 'rgba(99,245,176,1)')
      drawAimIndicator(ctx, drone.x, drone.y, droneAim, 'rgba(108,181,255,1)')

      // Power-ups
      for (const item of itemsRef.current) {
        // icon-like tile with glyph
        let bg = 'rgba(247,181,0,0.22)'
        let fg = '#ffd56a'
        let glyph = '2×'
        if (item.type === 'ricochet') {
          bg = 'rgba(155,107,255,0.22)'
          fg = '#d7c2ff'
          glyph = '↺'
        } else if (item.type === 'mine') {
          bg = 'rgba(255,93,122,0.22)'
          fg = '#ffc1cd'
          glyph = '✚'
        } else if (item.type === 'health') {
          bg = 'rgba(99,245,176,0.16)'
          fg = '#caffea'
          glyph = '❤+'
        } else if (item.type === 'pierce') {
          bg = 'rgba(108, 181, 255, 0.16)'
          fg = '#cfe2ff'
          glyph = '⇄'
        }
        ctx.fillStyle = bg
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(item.x - 10, item.y - 9, 20, 18, 5)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = fg
        ctx.font = '900 12px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(glyph, item.x, item.y + 0.5)
      }

      // Mines
      for (const mine of minesRef.current) {
        ctx.fillStyle = mine.owner === 'ai' ? '#7cf7c3' : '#8cc8ff'
        ctx.beginPath()
        ctx.arc(mine.x, mine.y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#0c1225'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(mine.x - 6, mine.y)
        ctx.lineTo(mine.x + 6, mine.y)
        ctx.moveTo(mine.x, mine.y - 6)
        ctx.lineTo(mine.x, mine.y + 6)
        ctx.stroke()
      }

      // Temporary walls (destructible in 1 hit, expire)
      const nowMs = Date.now()
      for (const wall of tempWallsRef.current) {
        const x = wall.tx * TILE_SIZE
        const y = wall.ty * TILE_SIZE
        const t = Math.max(0, Math.min(1, (nowMs - wall.createdAtMs) / WALL_APPEAR_MS))
        // "appear" effect only: wall stays until destroyed
        const alpha = Math.min(1, 0.25 + t * 0.75)
        ctx.fillStyle = `rgba(140, 179, 255, ${0.20 * alpha})`
        ctx.strokeStyle = `rgba(207, 226, 255, ${0.35 * alpha})`
        ctx.lineWidth = 2
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        ctx.fillStyle = `rgba(207, 226, 255, ${0.6 * alpha})`
        ctx.font = '900 10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('▦', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 0.5)
      }

      ctx.fillStyle = '#ffde59'
      for (const bullet of bulletsRef.current) {
        ctx.fillStyle = bullet.pierce ? '#cfe2ff' : '#ffde59'
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
      if (latest.gameState === 'paused_question') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  return (
    <div className="canvas-wrap" style={{ width: FIELD_WIDTH }}>
      <canvas ref={canvasRef} width={FIELD_WIDTH} height={FIELD_HEIGHT} />
    </div>
  )
}
