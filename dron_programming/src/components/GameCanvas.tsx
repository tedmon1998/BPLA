import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import type { Group } from 'three'
import { Vector3 as ThreeVector3 } from 'three'
import { useGame } from '../context/useGame'
import styles from './GameCanvas.module.css'

function DroneModel({ target }: { target: { x: number; y: number; z: number } }) {
  const groupRef = useRef<Group>(null)
  const targetVector = useMemo(
    () => new ThreeVector3(target.x, target.y + 0.4, target.z),
    [target.x, target.y, target.z],
  )

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return
    }
    groupRef.current.position.lerp(targetVector, Math.min(1, delta * 8))
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.35, 0.8]} />
        <meshStandardMaterial color="#7b9cff" />
      </mesh>
      {[
        [0.45, 0.2, 0.45],
        [0.45, 0.2, -0.45],
        [-0.45, 0.2, 0.45],
        [-0.45, 0.2, -0.45],
      ].map(([x, y, z], index) => (
        <mesh key={index} position={[x, y, z]}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
          <meshStandardMaterial color="#dce4ff" />
        </mesh>
      ))}
    </group>
  )
}

export function GameCanvas() {
  const { currentLevel, droneTargetPosition } = useGame()

  return (
    <div className={styles.canvasWrapper}>
      <Canvas camera={{ position: [8, 8, 8], fov: 55 }} shadows>
        <color attach="background" args={['#0d1220']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[5, 10, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.8}
          cellColor="#2f3b5c"
          sectionSize={5}
          sectionColor="#55638f"
          position={[0, 0, 0]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111a2f" />
        </mesh>

        <mesh position={[currentLevel.start.x, currentLevel.start.y + 0.02, currentLevel.start.z]}>
          <cylinderGeometry args={[0.7, 0.7, 0.05, 24]} />
          <meshStandardMaterial color="#1ecb6b" />
        </mesh>

        <mesh position={[currentLevel.target.x, currentLevel.target.y + 0.3, currentLevel.target.z]}>
          <cylinderGeometry args={[currentLevel.targetRadius, currentLevel.targetRadius, 0.12, 24]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>

        {currentLevel.obstacles.map((obstacle) => (
          <mesh
            key={obstacle.id}
            position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[obstacle.size.x, obstacle.size.y, obstacle.size.z]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        ))}

        <DroneModel target={droneTargetPosition} />
        <OrbitControls enablePan enableZoom maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  )
}
