import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Trail, Stars } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

/* ── Stylised paper-airplane ── */
function Airplane({ offset = 0 }: { offset?: number }) {
  const ref = useRef<THREE.Group>(null!);

  const bodyGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-0.35, -0.12);
    shape.lineTo(-0.7, 0.05);
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-0.25, 0.45);
    shape.lineTo(-0.55, 0.05);
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.35 + offset;
    // figure-8-ish path
    ref.current.position.x = Math.sin(t) * 3.5;
    ref.current.position.z = Math.cos(t * 2) * 1.5;
    ref.current.position.y = Math.sin(t * 1.5) * 0.8 + 0.5;
    // banking
    ref.current.rotation.z = -Math.cos(t) * 0.35;
    ref.current.rotation.y = -t + Math.PI / 2;
    ref.current.rotation.x = Math.sin(t * 1.5) * 0.15;
  });

  return (
    <group ref={ref} scale={0.7}>
      <Trail
        width={1.2}
        length={8}
        decay={1.5}
        color={"#60a5fa"}
        attenuation={(w) => w * w}
      >
        <group>
          {/* body */}
          <mesh geometry={bodyGeo}>
            <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
          </mesh>
          {/* top wing */}
          <mesh geometry={wingGeo} position={[0, 0.02, 0]}>
            <meshStandardMaterial color="#93c5fd" side={THREE.DoubleSide} />
          </mesh>
          {/* bottom wing (mirror) */}
          <mesh geometry={wingGeo} position={[0, -0.02, 0]} scale={[1, -1, 1]}>
            <meshStandardMaterial color="#93c5fd" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Trail>
    </group>
  );
}

/* ── Cloud puff ── */
function Cloud({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={1.2} floatIntensity={0.4} rotationIntensity={0.1}>
      <group position={position}>
        {[
          [0, 0, 0],
          [0.3, 0.15, 0.1],
          [-0.25, 0.1, -0.1],
          [0.15, -0.1, 0.15],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.25 + i * 0.04, 12, 12]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.35}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

/* ── Scene ── */
export default function HeroScene() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <Stars
          radius={50}
          depth={30}
          count={200}
          factor={2}
          saturation={0}
          fade
          speed={0.5}
        />

        <Airplane offset={0} />
        <Airplane offset={Math.PI} />

        <Cloud position={[-3, 1.5, -2]} />
        <Cloud position={[3.5, 0.8, -3]} />
        <Cloud position={[0, 2, -4]} />
        <Cloud position={[-2, -0.5, -1.5]} />
      </Canvas>
    </div>
  );
}
