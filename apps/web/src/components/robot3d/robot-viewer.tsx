"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Grid, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { Catalog, RobotSpec } from "@roboforge/spec";
import { layoutRobot, type PlacedPart, type PlacedWheel } from "./layout";

export interface RobotViewerProps {
  spec: RobotSpec;
  catalog: Catalog;
  dark?: boolean;
  autoRotate?: boolean;
  spinWheels?: boolean;
  showSensors?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Error/warning severity per component id — tints parts with problems. */
  severity?: Record<string, "error" | "warning" | "info" | undefined>;
  interactive?: boolean;
  cameraDistance?: number;
}

const ACCENT = "#1e6bff";
const HOVER = "#ffb800";

function Part({ p, selected, hovered, sev, onHover, onSelect }: { p: PlacedPart; selected: boolean; hovered: boolean; sev?: string; onHover: (id: string | null) => void; onSelect?: (id: string) => void }) {
  const [x, y, z] = p.position;
  const [sx, sy, sz] = p.size;
  const ring = selected ? ACCENT : hovered ? HOVER : sev === "error" ? "#f43f5e" : sev === "warning" ? "#f59e0b" : null;
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(p.id);
    },
    onPointerOut: () => onHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect?.(p.id);
    },
  };
  const body = (color: string, rough = 0.6, metal = 0.1) => <meshStandardMaterial color={ring ?? color} roughness={rough} metalness={metal} emissive={ring ?? "#000"} emissiveIntensity={ring ? 0.25 : 0} />;

  let model: React.ReactNode;
  switch (p.shape) {
    case "controller":
      model = (
        <group>
          <RoundedBox args={[sx, 0.003, sz]} radius={0.001} castShadow>{body("#1f2937", 0.5)}</RoundedBox>
          <mesh position={[sx * 0.18, 0.004, 0]} castShadow><boxGeometry args={[sx * 0.32, 0.004, sz * 0.62]} />{body("#cbd5e1", 0.25, 0.8)}</mesh>
          <mesh position={[-sx * 0.2, 0.003, 0]}><boxGeometry args={[0.009, 0.004, 0.007]} />{body("#9ca3af", 0.3, 0.7)}</mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0.0035, (s * sz) / 2.3]}><boxGeometry args={[sx * 0.9, 0.004, 0.0025]} />{body("#111827")}</mesh>
          ))}
          <mesh position={[-sx * 0.38, 0.004, sz * 0.25]}><sphereGeometry args={[0.0018, 12, 12]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} /></mesh>
        </group>
      );
      break;
    case "driver":
    case "board":
    case "transceiver":
    case "imu":
      model = (
        <group>
          <RoundedBox args={[sx, 0.0025, sz]} radius={0.001} castShadow>{body(p.shape === "driver" ? "#b91c1c" : p.shape === "imu" ? "#1d4ed8" : p.shape === "transceiver" ? "#0f766e" : "#15803d")}</RoundedBox>
          <mesh position={[0, 0.003, 0]} castShadow><boxGeometry args={[sx * 0.35, 0.002, sz * 0.35]} />{body("#111827", 0.4)}</mesh>
        </group>
      );
      break;
    case "regulator":
      model = (
        <group>
          <RoundedBox args={[sx, 0.002, sz]} radius={0.001} castShadow>{body("#1e40af")}</RoundedBox>
          <mesh position={[-sx * 0.15, 0.006, 0]} castShadow><cylinderGeometry args={[0.006, 0.006, 0.01, 20]} />{body("#0f172a", 0.3, 0.5)}</mesh>
          <mesh position={[sx * 0.22, 0.004, 0]} castShadow><boxGeometry args={[0.009, 0.007, 0.009]} />{body("#3b82f6", 0.4)}</mesh>
        </group>
      );
      break;
    case "battery":
      model = (
        <group>
          <RoundedBox args={[sx, sy, sz]} radius={0.004} smoothness={3} castShadow>{body("#334155", 0.35, 0.2)}</RoundedBox>
          <mesh position={[0, 0, sz / 2 + 0.0002]}><planeGeometry args={[sx * 0.7, sy * 0.55]} /><meshStandardMaterial color="#facc15" /></mesh>
          <mesh position={[0, 0, -sz / 2 - 0.0002]} rotation={[0, Math.PI, 0]}><planeGeometry args={[sx * 0.7, sy * 0.55]} /><meshStandardMaterial color="#facc15" /></mesh>
        </group>
      );
      break;
    case "tof":
    case "ir":
      model = (
        <group>
          <RoundedBox args={[0.003, sy, sz]} radius={0.001} castShadow>{body(p.shape === "ir" ? "#0f172a" : "#6d28d9")}</RoundedBox>
          <mesh position={[0.003, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.0025, 0.0025, 0.003, 16]} />{body("#0b1020", 0.1, 0.4)}</mesh>
        </group>
      );
      break;
    case "sonar":
      model = (
        <group>
          <RoundedBox args={[0.003, sy, sz]} radius={0.001} castShadow>{body("#1d4ed8")}</RoundedBox>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.007, 0, (s * sz) / 4]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.012, 24]} />{body("#d1d5db", 0.25, 0.8)}</mesh>
          ))}
        </group>
      );
      break;
    case "lidar":
      model = <LidarModel sx={sx} sy={sy} body={body} />;
      break;
    case "estop":
      model = (
        <group>
          <mesh castShadow position={[0, -sy / 4, 0]}><cylinderGeometry args={[sx / 2, sx / 2, sy / 2, 28]} />{body("#facc15", 0.5)}</mesh>
          <mesh castShadow position={[0, sy / 5, 0]}><cylinderGeometry args={[sx / 2.6, sx / 2.3, sy / 3, 28]} />{body("#dc2626", 0.35)}</mesh>
        </group>
      );
      break;
    case "servo":
      model = <RoundedBox args={[sx, sy, sz]} radius={0.002} castShadow>{body("#2563eb", 0.4)}</RoundedBox>;
      break;
    default:
      model = <RoundedBox args={[sx, sy, sz]} radius={0.002} castShadow>{body("#64748b")}</RoundedBox>;
  }
  return (
    <group position={[x, y, z]} rotation={[0, p.yaw, 0]} {...handlers}>
      {model}
      {hovered && (
        <Html center position={[0, sy + 0.02, 0]} distanceFactor={0.6} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg border border-border bg-panel px-2 py-1 text-[11px] shadow-lg">
            <div className="font-mono font-semibold text-fg">{p.name}</div>
            <div className="text-muted">{p.title}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function LidarModel({ sx, sy, body }: { sx: number; sy: number; body: (c: string, r?: number, m?: number) => React.ReactNode }) {
  const head = useRef<Group>(null);
  useFrame((_, dt) => {
    if (head.current) head.current.rotation.y += dt * 3;
  });
  return (
    <group>
      <mesh castShadow position={[0, -sy / 4, 0]}><cylinderGeometry args={[sx / 2, sx / 2, sy / 2, 32]} />{body("#111827", 0.4)}</mesh>
      <group ref={head} position={[0, sy / 5, 0]}>
        <mesh castShadow><cylinderGeometry args={[sx / 2.6, sx / 2.6, sy / 2.4, 32]} />{body("#1f2937", 0.3, 0.4)}</mesh>
        <mesh position={[sx / 2.6, 0, 0]}><boxGeometry args={[0.004, sy / 5, 0.014]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} /></mesh>
      </group>
    </group>
  );
}

function Wheel({ w, spin, selected, hovered, onHover, onSelect }: { w: PlacedWheel; spin: boolean; selected: boolean; hovered: boolean; onHover: (id: string | null) => void; onSelect?: (id: string) => void }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.z -= dt * 4;
  });
  const hub = selected ? ACCENT : hovered ? HOVER : "#e5e7eb";
  const outward = w.side === "left" ? -1 : 1;
  return (
    <group
      position={w.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(w.id);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(w.id);
      }}
    >
      <group ref={ref}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w.radius, w.radius, 0.024, 40]} />
          <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, outward * 0.0125]}>
          <cylinderGeometry args={[w.radius * 0.62, w.radius * 0.62, 0.002, 6]} />
          <meshStandardMaterial color={hub} roughness={0.35} metalness={0.6} emissive={selected || hovered ? hub : "#000"} emissiveIntensity={0.3} />
        </mesh>
      </group>
      {/* gear motor body behind the wheel */}
      <mesh position={[0, 0, -outward * 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.035, 20]} />
        <meshStandardMaterial color="#d4a017" roughness={0.3} metalness={0.7} />
      </mesh>
      {hovered && (
        <Html center position={[0, w.radius + 0.02, 0]} distanceFactor={0.6} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg border border-border bg-panel px-2 py-1 text-[11px] font-mono font-semibold text-fg shadow-lg">{w.name}</div>
        </Html>
      )}
    </group>
  );
}

function SenseCone({ position, yaw, range }: { position: [number, number, number]; yaw: number; range: number }) {
  const mat = useRef<MeshBasicMaterial>(null);
  const mesh = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.8) % 1;
    if (mat.current) mat.current.opacity = 0.22 * (1 - t);
    if (mesh.current) mesh.current.scale.setScalar(0.3 + t * 0.7);
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh ref={mesh} position={[range / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[range * 0.28, range, 32, 1, true]} />
        <meshBasicMaterial ref={mat} color={ACCENT} transparent opacity={0.2} depthWrite={false} side={2} />
      </mesh>
    </group>
  );
}

function RobotScene(props: RobotViewerProps) {
  const layout = useMemo(() => layoutRobot(props.spec, props.catalog), [props.spec, props.catalog]);
  const [hover, setHover] = useState<string | null>(null);
  const [cl, ch, cw] = layout.chassis.size;
  return (
    <group onPointerMissed={() => props.onSelect?.(null)}>
      <RoundedBox args={[cl, ch, cw]} radius={0.012} smoothness={4} position={layout.chassis.center} castShadow receiveShadow>
        <meshStandardMaterial color={props.dark ? "#e8edf7" : "#ffffff"} roughness={0.45} metalness={0.05} />
      </RoundedBox>
      {/* accent stripe */}
      <mesh position={[0, layout.deckY + 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cl * 0.92, cw * 0.86]} />
        <meshStandardMaterial color={props.dark ? "#c7d0e2" : "#e6ebf3"} roughness={0.8} />
      </mesh>
      <mesh position={[cl / 2 - 0.0005, layout.chassis.center[1], 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cw * 0.9, ch * 0.4]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.4} />
      </mesh>
      {layout.casters.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <sphereGeometry args={[0.012, 20, 20]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {layout.wheels.map((w) => (
        <Wheel key={w.id} w={w} spin={!!props.spinWheels} selected={props.selectedId === w.id} hovered={hover === w.id} onHover={setHover} onSelect={props.onSelect ?? undefined} />
      ))}
      {layout.parts.map((p) => (
        <Part key={p.id} p={p} selected={props.selectedId === p.id} hovered={hover === p.id} sev={props.severity?.[p.id]} onHover={setHover} onSelect={props.onSelect ?? undefined} />
      ))}
      {props.showSensors !== false && layout.senseCones.map((c) => <SenseCone key={c.id} {...c} />)}
    </group>
  );
}

/**
 * Keeps the whole robot in view: picks a camera distance from the robot's size and the viewport's
 * aspect ratio (narrow panels need to back off), preserving the current viewing direction.
 */
function AutoFrame({ radius, base }: { radius: number; base?: number }) {
  const { camera, size, controls } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const bucket = Math.round(aspect * 10);
  useEffect(() => {
    const fov = (38 * Math.PI) / 180;
    const fit = radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2);
    const dist = Math.max(base ?? 0, fit * 1.05);
    const target = (controls as unknown as { target?: { x: number; y: number; z: number } } | null)?.target ?? { x: 0, y: 0.04, z: 0 };
    const dir = camera.position.clone().sub(target as never);
    if (dir.lengthSq() < 1e-6) dir.set(0.8, 0.55, 0.8);
    dir.normalize().multiplyScalar(dist);
    camera.position.set(target.x + dir.x, target.y + dir.y, target.z + dir.z);
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, radius, base, controls]);
  return null;
}

/** Interactive 3D preview of the robot described by the spec. */
export default function RobotViewer(props: RobotViewerProps) {
  const d = props.cameraDistance ?? 0.55;
  const radius = useMemo(() => {
    const l = layoutRobot(props.spec, props.catalog);
    const [x, y, z] = l.chassis.size;
    return Math.max(0.12, Math.hypot(x, y + 0.08, z) / 2 + 0.03);
  }, [props.spec, props.catalog]);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [d * 0.8, d * 0.55, d * 0.8], fov: 38, near: 0.01, far: 20 }} style={{ touchAction: "none" }}>
      <hemisphereLight args={[props.dark ? "#dce6ff" : "#ffffff", props.dark ? "#0a1124" : "#dfe6f2", 0.95]} />
      <directionalLight position={[0.6, 1.2, 0.5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-near={0.1} shadow-camera-far={4} shadow-camera-left={-0.5} shadow-camera-right={0.5} shadow-camera-top={0.5} shadow-camera-bottom={-0.5} />
      <directionalLight position={[-0.8, 0.4, -0.6]} intensity={0.5} color={props.dark ? "#4d8bff" : "#cfe0ff"} />
      <AutoFrame radius={radius} base={props.cameraDistance} />
      <RobotScene {...props} />
      <ContactShadows position={[0, 0.0005, 0]} opacity={props.dark ? 0.6 : 0.35} scale={1.2} blur={2.4} far={0.3} />
      <Grid
        position={[0, 0, 0]}
        args={[4, 4]}
        cellSize={0.02}
        cellThickness={0.6}
        sectionSize={0.1}
        sectionThickness={1}
        cellColor={props.dark ? "#1c2849" : "#dfe5ef"}
        sectionColor={props.dark ? "#2e3d68" : "#c3cddd"}
        fadeDistance={1.6}
        fadeStrength={1.5}
        infiniteGrid
      />
      <OrbitControls
        makeDefault
        enablePan={props.interactive !== false}
        enableZoom={props.interactive !== false}
        autoRotate={!!props.autoRotate}
        autoRotateSpeed={1.2}
        minDistance={0.2}
        maxDistance={2}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.04, 0]}
      />
    </Canvas>
  );
}
