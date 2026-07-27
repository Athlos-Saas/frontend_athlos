import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const NODE_COUNT = 48;
const MAX_EDGE_DISTANCE = 2.6;
const MAX_EDGES_PER_NODE = 3;
const PULSE_CYCLE_S = 3;

const NODE_BASE_COLOR = new THREE.Color('#60a5fa');
const NODE_ACTIVE_COLOR = new THREE.Color('#eff6ff');
const NODE_ACTIVE_DURATION_S = 0.6;
const NODE_ACTIVE_SCALE = 2.6;
/** Retraso con el que "se contagia" la activación a los vecinos directos (1 salto) — simula una señal propagándose por la red. */
const NEIGHBOR_PROPAGATION_DELAY_S = 0.12;
const CLICK_BURST_DURATION_S = 0.6;

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

function buildAdjacency(edges: [number, number][]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const add = (a: number, b: number) => {
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(b);
  };
  for (const [a, b] of edges) {
    add(a, b);
    add(b, a);
  }
  return map;
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

/**
 * Nodo interactivo — lee `activeNodesRef` (índice → instante en el que
 * debería empezar a "activarse", en `clock.elapsedTime`) cada frame para
 * decidir su escala/color, sin re-renderizar React por click (mutación de
 * un ref compartido, mismo criterio que `EnergyPulse`). Un click en la red
 * marca el nodo más cercano con el instante actual, y sus vecinos directos
 * con un instante ligeramente posterior — así la activación "se contagia"
 * un salto en vez de iluminar un solo punto aislado.
 */
function NetworkNode({
  position,
  index,
  activeNodesRef,
}: {
  position: THREE.Vector3;
  index: number;
  activeNodesRef: MutableRefObject<Map<number, number>>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const triggerTime = activeNodesRef.current.get(index);
    let boost = 0;
    if (triggerTime !== undefined) {
      const age = clock.elapsedTime - triggerTime;
      if (age >= NODE_ACTIVE_DURATION_S) {
        activeNodesRef.current.delete(index);
      } else if (age >= 0) {
        boost = 1 - age / NODE_ACTIVE_DURATION_S;
      }
    }

    mesh.scale.setScalar(1 + boost * (NODE_ACTIVE_SCALE - 1));
    material.opacity = 0.85 + boost * 0.15;
    material.color.lerpColors(NODE_BASE_COLOR, NODE_ACTIVE_COLOR, boost);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshBasicMaterial ref={materialRef} color={NODE_BASE_COLOR} transparent opacity={0.85} />
    </mesh>
  );
}

/** Onda expansiva que aparece en el punto de la red más cercano al click y se desvanece — feedback inmediato de que el click "hizo algo". */
function ClickBurst({ position, onDone }: { position: THREE.Vector3; onDone: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const t = (clock.elapsedTime - startRef.current) / CLICK_BURST_DURATION_S;
    if (t >= 1) {
      onDone();
      return;
    }
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    mesh.scale.setScalar(0.1 + t * 1.6);
    material.opacity = (1 - t) * 0.8;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.14, 12, 12]} />
      <meshBasicMaterial ref={materialRef} color="#eff6ff" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

interface Burst {
  id: number;
  position: THREE.Vector3;
}

function Scene({ parallax, isActive }: { parallax: { x: number; y: number }; isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() => generateNodes(NODE_COUNT), []);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);
  const adjacency = useMemo(() => buildAdjacency(edges), [edges]);
  const pulsingEdges = useMemo(() => edges.filter((_, i) => i % 5 === 0), [edges]);

  const activeNodesRef = useRef<Map<number, number>>(new Map());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextBurstId = useRef(0);
  const clock = useThree((state) => state.clock);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y += delta * (isActive ? 0.22 : 0.05);
    group.rotation.x += (parallax.y * 0.15 - group.rotation.x) * 0.02;
    group.rotation.z += (-parallax.x * 0.1 - group.rotation.z) * 0.02;
  });

  const handleCatcherClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const group = groupRef.current;
    if (!group) return;

    const localPoint = group.worldToLocal(event.point.clone());
    let nearestIndex = 0;
    let nearestDistSq = Infinity;
    nodes.forEach((nodePosition, index) => {
      const distSq = nodePosition.distanceToSquared(localPoint);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestIndex = index;
      }
    });

    const now = clock.elapsedTime;
    const active = activeNodesRef.current;
    active.set(nearestIndex, now);
    for (const neighborIndex of adjacency.get(nearestIndex) ?? []) {
      active.set(neighborIndex, now + NEIGHBOR_PROPAGATION_DELAY_S);
    }

    const id = nextBurstId.current;
    nextBurstId.current += 1;
    setBursts((current) => [...current, { id, position: nodes[nearestIndex] }]);
  };

  return (
    <>
      {/* Plano invisible que cubre todo el frustum — no rota con la red (por eso vive fuera del group) para que siempre sea clickeable sin importar el ángulo actual. El punto de click se convierte a espacio local del group para compararlo contra las posiciones (fijas) de los nodos. */}
      <mesh position={[0, 0, -3]} onClick={handleCatcherClick}>
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={groupRef}>
        {nodes.map((position, index) => (
          <NetworkNode key={index} position={position} index={index} activeNodesRef={activeNodesRef} />
        ))}
        {edges.map(([a, b], index) => (
          <Line key={index} points={[nodes[a], nodes[b]]} color="#3b82f6" transparent opacity={0.14} lineWidth={1} />
        ))}
        {pulsingEdges.map(([a, b], index) => (
          <EnergyPulse key={index} start={nodes[a]} end={nodes[b]} delay={index * 0.7} />
        ))}
        {bursts.map((burst) => (
          <ClickBurst
            key={burst.id}
            position={burst.position}
            onDone={() => setBursts((current) => current.filter((b) => b.id !== burst.id))}
          />
        ))}
      </group>
    </>
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
 * Interactiva: un click activa el nodo más cercano (y sus vecinos directos,
 * con un pequeño retraso) más una onda expansiva en el punto — el wrapper
 * en `Login.tsx` ya no bloquea eventos de puntero para permitir esto.
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
