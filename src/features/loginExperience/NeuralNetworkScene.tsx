import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const NODE_COUNT = 48;
const MAX_EDGE_DISTANCE = 2.6;
const MAX_EDGES_PER_NODE = 3;
const PULSE_CYCLE_S = 3;

function generateNodes(count: number): THREE.Vector3[] {
  return Array.from(
    { length: count },
    () => new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4),
  );
}

function buildEdges(nodes: THREE.Vector3[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    let countForNode = 0;
    for (let j = i + 1; j < nodes.length && countForNode < MAX_EDGES_PER_NODE; j += 1) {
      if (nodes[i].distanceTo(nodes[j]) < MAX_EDGE_DISTANCE) {
        edges.push([i, j]);
        countForNode += 1;
      }
    }
  }
  return edges;
}

/** Un pulso de "energía" viajando de un nodo a otro — como si la red disparara una activación. */
function EnergyPulse({ start, end, delay }: { start: THREE.Vector3; end: THREE.Vector3; delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = ((clock.elapsedTime + delay) % PULSE_CYCLE_S) / PULSE_CYCLE_S;
    meshRef.current.position.lerpVectors(start, end, t);
    materialRef.current.opacity = t < 0.04 || t > 0.94 ? 0 : 1;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial ref={materialRef} color="#bfdbfe" transparent opacity={0} />
    </mesh>
  );
}

function Scene({ parallax, isActive }: { parallax: { x: number; y: number }; isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() => generateNodes(NODE_COUNT), []);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);
  const pulsingEdges = useMemo(() => edges.filter((_, i) => i % 5 === 0), [edges]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y += delta * (isActive ? 0.22 : 0.05);
    group.rotation.x += (parallax.y * 0.15 - group.rotation.x) * 0.02;
    group.rotation.z += (-parallax.x * 0.1 - group.rotation.z) * 0.02;
  });

  return (
    <group ref={groupRef}>
      {nodes.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.85} />
        </mesh>
      ))}
      {edges.map(([a, b], index) => (
        <Line key={index} points={[nodes[a], nodes[b]]} color="#3b82f6" transparent opacity={0.14} lineWidth={1} />
      ))}
      {pulsingEdges.map(([a, b], index) => (
        <EnergyPulse key={index} start={nodes[a]} end={nodes[b]} delay={index * 0.7} />
      ))}
    </group>
  );
}

export interface NeuralNetworkSceneProps {
  parallax: { x: number; y: number };
  /** true mientras se está autenticando: acelera la rotación como señal de "la IA está procesando". */
  isActive?: boolean;
}

/**
 * Red neuronal en 3D real (capa 4 del brief) — nodos + conexiones con
 * profundidad genuina y pulsos de "energía" viajando entre ellos. Es la
 * única pieza de este feature que usa React Three Fiber (el resto es
 * canvas 2D / SVG / CSS): acá sí aporta algo que un canvas 2D no daría
 * igual de bien (nodos a distintas profundidades + tilt de cámara).
 * Se importa siempre vía `React.lazy` desde `Login.tsx` — mismo criterio
 * que `Player3DViewer.tsx` (three.js + drei pesan, no deben ir en el
 * bundle principal de una pantalla tan temprana como el login).
 */
export default function NeuralNetworkScene({ parallax, isActive = false }: NeuralNetworkSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 50, position: [0, 0, 7] }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <Scene parallax={parallax} isActive={isActive} />
    </Canvas>
  );
}
