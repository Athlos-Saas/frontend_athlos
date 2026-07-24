import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useBounds } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export type Model3DFormat = 'glb' | 'gltf' | 'obj' | 'fbx';

export interface Player3DViewerHandle {
  resetView: () => void;
}

function GltfModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

function ObjModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} />;
}

function FbxModel({ url }: { url: string }) {
  const obj = useLoader(FBXLoader, url);
  return <primitive object={obj} />;
}

/** Un componente por formato para no llamar hooks condicionalmente — `format` decide cuál se monta. */
function ModelContent({ url, format }: { url: string; format: Model3DFormat }) {
  if (format === 'obj') return <ObjModel url={url} />;
  if (format === 'fbx') return <FbxModel url={url} />;
  return <GltfModel url={url} />;
}

function BoundsApiBridge({ apiRef }: { apiRef: React.MutableRefObject<ReturnType<typeof useBounds> | null> }) {
  const api = useBounds();
  useEffect(() => {
    apiRef.current = api;
    api.refresh().fit();
  }, [api]);
  return null;
}

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface Player3DViewerProps {
  url: string;
  format: Model3DFormat;
  autoRotate: boolean;
  /** Callback en vez de ref: este componente se carga vía React.lazy() (three.js pesa demasiado para ir en el bundle principal) y los refs no atraviesan React.lazy. */
  onReady?: (handle: Player3DViewerHandle) => void;
}

/**
 * Visor 3D en memoria del navegador (recibe una blob: URL local) — no
 * persiste nada en Supabase porque no existe un bucket de Storage para
 * modelos 3D todavía (ver gap en la ficha). Sirve para previsualizar cómo se
 * vería un GLB/GLTF/OBJ/FBX del jugador. USDZ no se soporta: es un formato
 * propietario de Apple que three.js no puede renderizar.
 *
 * Se importa siempre vía React.lazy desde PlayerMedia.tsx: three.js + drei
 * pesan ~600kB y solo deben bajar cuando alguien realmente sube un modelo.
 */
function Player3DViewer({ url, format, autoRotate, onReady }: Player3DViewerProps) {
  const boundsApiRef = useRef<ReturnType<typeof useBounds> | null>(null);

  useEffect(() => {
    onReady?.({ resetView: () => boundsApiRef.current?.refresh().fit() });
  }, [onReady]);

  return (
    <ModelErrorBoundary
      fallback={
        <div className="flex size-full items-center justify-center p-4 text-center text-xs text-danger">
          No se pudo cargar el modelo 3D. Verifica que el archivo sea un .glb/.gltf/.obj/.fbx válido.
        </div>
      }
    >
      <Canvas camera={{ fov: 45, position: [0, 0, 3] }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <directionalLight position={[-3, -2, -4]} intensity={0.3} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <BoundsApiBridge apiRef={boundsApiRef} />
            <Center>
              <ModelContent url={url} format={format} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls autoRotate={autoRotate} autoRotateSpeed={2.5} enableDamping makeDefault />
      </Canvas>
    </ModelErrorBoundary>
  );
}

export default Player3DViewer;
