import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Stylised charging scene.
 *
 * There is no licensed production car model in this repository, so the vehicle
 * is deliberately low-poly and presented as an illustration rather than a
 * specific model. Geometry is procedural, which keeps the scene self-contained
 * and avoids remote assets or texture downloads.
 */

const BODY = '#3d4a51';
const GLASS = '#0d171c';
const LIME = '#c6ff00';

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tyre: a torus reads as a round tyre from the three-quarter view. */}
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.245, 0.115, 18, 36]} />
        <meshStandardMaterial color="#0a0d0f" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Rim */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.2, 24]} />
        <meshStandardMaterial color="#88949a" metalness={0.95} roughness={0.22} envMapIntensity={1.6} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.22, 16]} />
        <meshStandardMaterial color="#2b3439" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Lime brake caliper, a small brand detail */}
      <mesh position={[0.02, 0.11, 0.08]}>
        <boxGeometry args={[0.08, 0.07, 0.04]} />
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Car() {
  /** Side profile of the lower body, extruded across the car's width. */
  const bodyShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.18, 0.38);
    shape.lineTo(2.1, 0.38);
    shape.quadraticCurveTo(2.3, 0.42, 2.26, 0.64); // nose
    shape.lineTo(1.26, 0.82); // bonnet
    shape.lineTo(0.94, 0.94); // base of windscreen
    shape.quadraticCurveTo(-0.2, 1.0, -1.62, 0.98); // shoulder line
    shape.lineTo(-2.02, 0.9);
    shape.quadraticCurveTo(-2.22, 0.84, -2.18, 0.62); // tail
    shape.lineTo(-2.18, 0.38);
    return shape;
  }, []);

  /** Glasshouse: a fastback silhouette sitting on the shoulder line. */
  const cabinShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.98, 0.93);
    shape.lineTo(0.42, 1.35);
    shape.quadraticCurveTo(-0.15, 1.42, -0.82, 1.36);
    shape.lineTo(-1.66, 0.96);
    shape.lineTo(0.98, 0.93);
    return shape;
  }, []);

  const extrude = {
    depth: 1.66,
    bevelEnabled: true,
    bevelSize: 0.055,
    bevelThickness: 0.055,
    bevelSegments: 3,
    curveSegments: 20,
  } as const;

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0, -0.83]} castShadow receiveShadow>
        <extrudeGeometry args={[bodyShape, extrude]} />
        <meshStandardMaterial
          color={BODY}
          metalness={0.55}
          roughness={0.3}
          envMapIntensity={1.5}
        />
      </mesh>

      <mesh position={[0, 0, -0.74]} castShadow>
        <extrudeGeometry args={[cabinShape, { ...extrude, depth: 1.48 }]} />
        <meshStandardMaterial
          color={GLASS}
          metalness={0.85}
          roughness={0.12}
          envMapIntensity={1.8}
        />
      </mesh>

      {/* Roof spine keeps the glasshouse from reading as one black block */}
      <mesh position={[-0.2, 1.4, 0]} rotation={[0, 0, -0.04]}>
        <boxGeometry args={[1.02, 0.025, 1.36]} />
        <meshStandardMaterial color={BODY} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Full-width light bars */}
      <mesh position={[2.255, 0.67, 0]}>
        <boxGeometry args={[0.045, 0.055, 1.38]} />
        <meshStandardMaterial color="#eaf6ff" emissive="#cfe9ff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-2.185, 0.76, 0]}>
        <boxGeometry args={[0.04, 0.05, 1.34]} />
        <meshStandardMaterial color="#ff5a5a" emissive="#ff3b3b" emissiveIntensity={1.4} />
      </mesh>

      {/* Lime sill accent, tying the model to the product palette */}
      <mesh position={[0, 0.44, 0.865]}>
        <boxGeometry args={[3.2, 0.028, 0.02]} />
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[0, 0.44, -0.865]}>
        <boxGeometry args={[3.2, 0.028, 0.02]} />
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={1.1} />
      </mesh>

      {/* Side mirrors */}
      <mesh position={[0.7, 1.0, 0.9]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color={BODY} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.7, 1.0, -0.9]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color={BODY} metalness={0.6} roughness={0.3} />
      </mesh>

      <Wheel position={[1.38, 0.36, 0.845]} />
      <Wheel position={[1.38, 0.36, -0.845]} />
      <Wheel position={[-1.34, 0.36, 0.845]} />
      <Wheel position={[-1.34, 0.36, -0.845]} />

      {/* Charge port flap, lifted, on the front quarter */}
      <mesh position={[1.32, 0.8, 0.875]} rotation={[0.55, 0, 0]}>
        <boxGeometry args={[0.3, 0.24, 0.025]} />
        <meshStandardMaterial color="#2c363b" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Charger({ charging }: { charging: boolean }) {
  return (
    <group position={[3.12, 0, 1.22]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.58, 1.76, 0.4]} />
        <meshStandardMaterial color="#242d32" metalness={0.55} roughness={0.38} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 1.31, 0.205]}>
        <boxGeometry args={[0.38, 0.32, 0.015]} />
        <meshStandardMaterial
          color={charging ? LIME : '#101619'}
          emissive={LIME}
          emissiveIntensity={charging ? 1.1 : 0.04}
        />
      </mesh>
      {/* Charge-level bars below the screen */}
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[-0.1 + index * 0.1, 1.07, 0.21]}>
          <boxGeometry args={[0.06, 0.11, 0.012]} />
          <meshStandardMaterial
            color={charging ? LIME : '#1b2327'}
            emissive={LIME}
            emissiveIntensity={charging ? 1.2 : 0.02}
          />
        </mesh>
      ))}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[0.66, 0.07, 0.48]} />
        <meshStandardMaterial color="#323d42" metalness={0.7} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.86, 0.08, 0.64]} />
        <meshStandardMaterial color="#0f1416" metalness={0.35} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Cable({ charging, animate }: { charging: boolean; animate: boolean }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.12, 1.02, 1.43),
        new THREE.Vector3(2.9, 0.32, 1.72),
        new THREE.Vector3(2.2, 0.14, 1.58),
        new THREE.Vector3(1.62, 0.46, 1.18),
        new THREE.Vector3(1.32, 0.78, 0.94),
      ]),
    [],
  );

  const pulse = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = charging && animate ? (clock.getElapsedTime() * 0.16) % 1 : 0.12;
    pulse.current.position.copy(curve.getPoint(t));
    pulse.current.visible = charging;
  });

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[curve, 64, 0.045, 10, false]} />
        <meshStandardMaterial color="#0d1214" roughness={0.72} metalness={0.2} />
      </mesh>
      {/* Connector head at the car end */}
      <mesh position={[1.32, 0.79, 0.95]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.15, 0.19, 0.13]} />
        <meshStandardMaterial color="#3a454b" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh ref={pulse}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={2.6} />
      </mesh>
    </group>
  );
}

/** Wider field of view on portrait canvases so the whole car stays in frame. */
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const nextFov = size.width / size.height < 1.35 ? 52 : 38;
    if (perspective.fov !== nextFov) {
      perspective.fov = nextFov;
      perspective.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  return null;
}

function Scene({
  charging,
  autoRotate,
  animate,
}: {
  charging: boolean;
  autoRotate: boolean;
  animate: boolean;
}) {
  return (
    <>
      <color attach="background" args={['#050708']} />
      <fog attach="fog" args={['#050708', 10, 22]} />

      {/* Local studio lighting. The environment is rendered from these light
          cards at mount, so metallic paint has real reflections to pick up
          without downloading an HDR file. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 5.5, -4.5]}
          scale={[8, 3, 1]}
          target={[0, 0.7, 0]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[-5, 2.4, 4]}
          scale={[3.5, 4, 1]}
          target={[0, 0.7, 0]}
          color="#9fb6c4"
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[4.5, 3, 3]}
          scale={[2.5, 2.5, 1]}
          target={[0, 0.7, 0]}
          color="#ffffff"
        />
        <Lightformer
          form="ring"
          intensity={1.4}
          position={[2.8, 1.1, 1.6]}
          scale={1.6}
          target={[0, 0.7, 0]}
          color={LIME}
        />
      </Environment>

      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#dcecff', '#050708', 0.6]} />
      <directionalLight
        position={[4.5, 7, 3.5]}
        intensity={2.1}
        color="#e8f4ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.85} color="#9fb6c4" />
      <pointLight
        position={[1.6, 1.2, 1.9]}
        intensity={charging ? 1.2 : 0.3}
        distance={4}
        color={LIME}
      />

      {/* Studio floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial
          color="#090c0e"
          roughness={0.52}
          metalness={0.2}
          envMapIntensity={0.4}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[4.4, 4.46, 96]} />
        <meshBasicMaterial color="#1c2327" />
      </mesh>

      <ResponsiveCamera />
      <Car />
      <Charger charging={charging} />
      <Cable charging={charging} animate={animate} />

      <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={12} blur={2.4} far={4} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minDistance={4.6}
        maxDistance={10}
        minPolarAngle={0.7}
        maxPolarAngle={1.42}
        target={[0, 0.72, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
      />
    </>
  );
}

export default function ChargingScene({
  charging,
  autoRotate = false,
  animate = true,
}: {
  charging: boolean;
  autoRotate?: boolean;
  animate?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows="percentage"
      camera={{ position: [5.95, 2.4, 6.85], fov: 38 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.2;
      }}
      aria-label="Illustrative 3D electric car connected to a charging point"
      role="img"
    >
      <Scene charging={charging} autoRotate={autoRotate} animate={animate} />
    </Canvas>
  );
}
