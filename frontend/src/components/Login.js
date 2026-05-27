import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "framer-motion";
import Lenis from "lenis";
import * as THREE from "three";
import {
  Activity,
  Aperture,
  Fingerprint,
  Network,
  RadioReceiver,
  ScanSearch,
  ShieldCheck,
  Signal,
} from "lucide-react";
import "./Login.css";

const heroMotion = {
  target: 0,
  current: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
};

const easeReveal = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const buildAccretionField = (compact) => {
  const count = compact ? 220 : 420;
  const positions = [];
  const seeds = [];
  const innerRadius = compact ? 1.15 : 1.25;
  const outerRadius = compact ? 5.2 : 7.1;

  for (let index = 0; index < count; index += 1) {
    const lane = index % 11;
    const normalized = index / count;
    const shell = Math.pow(((index * 37) % 100) / 100, 1.6);
    const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, shell);
    const angle = normalized * Math.PI * 2 * (lane % 2 === 0 ? 2.1 : -1.55) + lane * 0.31;
    positions.push(radius, angle, lane);
    seeds.push((index * 0.61803398875) % 1);
  }

  return {
    positions: new Float32Array(positions),
    seeds: new Float32Array(seeds),
  };
};

const buildDebrisField = (compact) => {
  const count = compact ? 90 : 160;
  const positions = [];
  const seeds = [];

  for (let index = 0; index < count; index += 1) {
    const lane = index % 7;
    const angle = (index / count) * Math.PI * 2 * 1.4 + lane * 0.62;
    const radius = (compact ? 5.4 : 7.6) * (0.52 + ((index * 23) % 100) / 115);
    const y = (((index * 19) % 100) / 100 - 0.5) * (compact ? 3.2 : 4.4);
    positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.72);
    seeds.push((index * 0.41421356237) % 1);
  }

  return {
    positions: new Float32Array(positions),
    seeds: new Float32Array(seeds),
  };
};

const buildWarpField = (compact) => {
  const positions = [];
  const rings = compact ? 7 : 10;
  const segments = compact ? 96 : 144;
  const maxRadius = compact ? 7.4 : 10.4;

  for (let ring = 0; ring < rings; ring += 1) {
    const radius = maxRadius * (0.22 + ring / rings);
    for (let segment = 0; segment < segments; segment += 1) {
      const angleA = (segment / segments) * Math.PI * 2;
      const angleB = ((segment + 1) / segments) * Math.PI * 2;
      const warpA = 1 - 0.12 / Math.max(0.22, ring / rings + 0.14);
      const warpB = 1 - 0.12 / Math.max(0.22, ring / rings + 0.14);
      positions.push(
        Math.cos(angleA) * radius * warpA,
        -1.7 + Math.sin(angleA * 2) * 0.08,
        Math.sin(angleA) * radius * 0.42,
        Math.cos(angleB) * radius * warpB,
        -1.7 + Math.sin(angleB * 2) * 0.08,
        Math.sin(angleB) * radius * 0.42
      );
    }
  }

  return new Float32Array(positions);
};

const AccretionField = ({ compact, reducedMotion }) => {
  const material = useRef(null);
  const field = useMemo(() => buildAccretionField(compact), [compact]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSize: { value: compact ? 2.1 : 2.55 },
      uMotion: { value: reducedMotion ? 0.16 : 1 },
    }),
    [compact, reducedMotion]
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uProgress.value = heroMotion.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={field.positions} count={field.positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" array={field.seeds} count={field.seeds.length} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSeed;
          uniform float uTime;
          uniform float uProgress;
          uniform float uSize;
          uniform float uMotion;
          varying float vAlpha;

          void main() {
            float radius = position.x;
            float angle = position.y;
            float lane = position.z;
            float breath = sin(uTime * 0.42 + aSeed * 14.0) * 0.5 + 0.5;
            float scrollOpen = smoothstep(0.1, 0.78, uProgress);
            float direction = mod(lane, 2.0) < 1.0 ? 1.0 : -1.0;
            float orbital = angle + direction * uTime * (0.08 + lane * 0.004) * uMotion + scrollOpen * 0.38;
            float collapse = 1.0 - scrollOpen * 0.06 + sin(uTime * 0.18 + lane) * 0.012 * uMotion;
            vec3 point = vec3(
              cos(orbital) * radius * collapse,
              (aSeed - 0.5) * 0.42 + sin(orbital * 3.0 + uTime * 0.35) * 0.075 * uMotion,
              sin(orbital) * radius * (0.46 + lane * 0.012) * collapse
            );
            point.xz *= 1.0 + scrollOpen * 0.1;

            vec4 mv = modelViewMatrix * vec4(point, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp((uSize + breath * 1.1) * (34.0 / max(2.2, -mv.z)), 0.8, 4.6);
            vAlpha = (0.1 + breath * 0.24) * (1.0 - scrollOpen * 0.12);
          }
        `}
        fragmentShader={`
          varying float vAlpha;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            float radius = length(centered);
            if (radius > 0.5) discard;
            float glow = smoothstep(0.5, 0.05, radius);
            gl_FragColor = vec4(vec3(0.86), glow * vAlpha);
          }
        `}
      />
    </points>
  );
};

const DebrisField = ({ compact, reducedMotion }) => {
  const material = useRef(null);
  const field = useMemo(() => buildDebrisField(compact), [compact]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uMotion: { value: reducedMotion ? 0.12 : 1 },
    }),
    [reducedMotion]
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uProgress.value = heroMotion.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={field.positions} count={field.positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" array={field.seeds} count={field.seeds.length} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSeed;
          uniform float uTime;
          uniform float uProgress;
          uniform float uMotion;
          varying float vAlpha;

          void main() {
            vec3 point = position;
            float sweep = uTime * 0.018 * uMotion + uProgress * 0.2;
            mat2 spin = mat2(cos(sweep), -sin(sweep), sin(sweep), cos(sweep));
            point.xz = spin * point.xz;
            point.y += sin(uTime * 0.12 + aSeed * 10.0) * 0.16 * uMotion;
            vec4 mv = modelViewMatrix * vec4(point, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp((1.6 + aSeed * 1.6) * (28.0 / max(2.0, -mv.z)), 0.7, 3.2);
            vAlpha = (0.065 + aSeed * 0.11) * (1.0 - uProgress * 0.16);
          }
        `}
        fragmentShader={`
          varying float vAlpha;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            if (length(centered) > 0.5) discard;
            gl_FragColor = vec4(vec3(0.72), vAlpha);
          }
        `}
      />
    </points>
  );
};

const PhotonRing = ({ radius, tube, rotation, speed, opacity, compact, phase }) => {
  const ring = useRef(null);
  const material = useRef(null);

  useFrame(({ clock }) => {
    if (!ring.current || !material.current) return;
    const time = clock.elapsedTime;
    const progress = heroMotion.current;
    ring.current.rotation.x = rotation[0] + Math.sin(time * 0.08 + phase) * 0.018 + progress * 0.08;
    ring.current.rotation.y = rotation[1] + time * speed + progress * 0.4;
    ring.current.rotation.z = rotation[2] + Math.cos(time * 0.07 + phase) * 0.018;
    ring.current.scale.setScalar(1 + Math.sin(time * 0.13 + phase) * 0.009 + progress * 0.026);
    material.current.opacity = opacity + Math.sin(time * 0.18 + phase) * 0.014;
  });

  return (
    <mesh ref={ring} rotation={rotation}>
      <torusGeometry args={[radius, tube, compact ? 128 : 192, 12]} />
      <meshStandardMaterial
        ref={material}
        color="#e7eaee"
        emissive="#ffffff"
        emissiveIntensity={0.05}
        metalness={0.74}
        roughness={0.28}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

const Singularity = ({ compact }) => {
  const group = useRef(null);
  const glow = useRef(null);

  useFrame(({ clock }) => {
    if (!group.current || !glow.current) return;
    const time = clock.elapsedTime;
    const progress = heroMotion.current;
    group.current.rotation.z = time * 0.035 + progress * 0.22;
    group.current.scale.setScalar(1 + Math.sin(time * 0.22) * 0.012 + progress * 0.035);
    glow.current.opacity = 0.18 + Math.sin(time * 0.2) * 0.035;
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[compact ? 0.68 : 0.84, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[compact ? 0.82 : 1, compact ? 1.3 : 1.58, compact ? 128 : 192]} />
        <meshBasicMaterial ref={glow} color="#f4f6f8" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

const WarpField = ({ compact }) => {
  const field = useRef(null);
  const material = useRef(null);
  const positions = useMemo(() => buildWarpField(compact), [compact]);

  useFrame(({ clock }) => {
    if (!field.current || !material.current) return;
    const time = clock.elapsedTime;
    field.current.rotation.y = time * 0.01 + heroMotion.current * 0.18;
    field.current.rotation.x = -0.18 + Math.sin(time * 0.08) * 0.02;
    material.current.opacity = 0.045 + smoothstep(0.18, 0.88, heroMotion.current) * 0.035;
  });

  return (
    <lineSegments ref={field} position={[0, compact ? -0.42 : -0.56, -1.2]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial ref={material} color="#e4e8ee" transparent opacity={0.045} depthWrite={false} />
    </lineSegments>
  );
};

const EventHorizonShadow = ({ compact }) => {
  const mesh = useRef(null);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const time = clock.elapsedTime;
    mesh.current.rotation.z = time * -0.018;
    mesh.current.scale.setScalar(1 + Math.sin(time * 0.11) * 0.01);
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[compact ? 1.22 : 1.52, 96]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.96} depthWrite={false} />
    </mesh>
  );
};

const CameraRig = ({ compact, reducedMotion }) => {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const progressEase = reducedMotion ? 0.22 : 0.045;
    heroMotion.current = THREE.MathUtils.lerp(heroMotion.current, heroMotion.target, progressEase);
    heroMotion.velocity = THREE.MathUtils.lerp(heroMotion.velocity, 0, 0.055);

    const time = clock.elapsedTime;
    const progress = heroMotion.current;
    const pointerWeight = reducedMotion ? 0 : compact ? 0.22 : 0.38;
    const velocityLift = Math.min(0.72, Math.abs(heroMotion.velocity) * 0.012);
    const targetX = heroMotion.pointerX * pointerWeight + Math.sin(time * 0.055) * (compact ? 0.12 : 0.2);
    const targetY = heroMotion.pointerY * pointerWeight * 0.44 + 0.1 - progress * 0.26;
    const targetZ = (compact ? 10.3 : 11.5) - progress * (compact ? 1.05 : 1.85) + velocityLift;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, (progress - 0.5) * -0.035, 0.055);
    camera.fov = THREE.MathUtils.lerp(camera.fov, 41 + progress * 4, 0.04);
    camera.lookAt(0, progress * 0.1, -0.32);
    camera.updateProjectionMatrix();
  });

  return null;
};

const BlackHoleSystemScene = ({ compact, reducedMotion }) => {
  const system = useRef(null);
  const scale = compact ? 0.82 : 1.04;

  useFrame(({ clock }) => {
    if (!system.current) return;
    const time = clock.elapsedTime;
    system.current.rotation.y = THREE.MathUtils.lerp(
      system.current.rotation.y,
      -0.18 + heroMotion.current * 0.38 + (reducedMotion ? 0 : Math.sin(time * 0.065) * 0.04),
      0.04
    );
    system.current.rotation.x = THREE.MathUtils.lerp(
      system.current.rotation.x,
      0.02 + heroMotion.current * 0.1 + Math.sin(time * 0.055) * 0.02,
      0.04
    );
    system.current.position.y = THREE.MathUtils.lerp(
      system.current.position.y,
      compact ? -0.08 : -0.02,
      0.04
    );
  });

  return (
    <>
      <color attach="background" args={["#020304"]} />
      <fog attach="fog" args={["#020304", compact ? 6.8 : 7.6, compact ? 18 : 24]} />
      <ambientLight intensity={0.11} />
      <directionalLight position={[-4, 5, 6]} intensity={0.62} color="#f5f6f8" />
      <directionalLight position={[5, -2, -3]} intensity={0.18} color="#7f8792" />
      <pointLight position={[0, 0.1, 2.8]} intensity={0.76} color="#ffffff" distance={8} />
      <CameraRig compact={compact} reducedMotion={reducedMotion} />
      <group ref={system} scale={scale} position={[0, compact ? -0.08 : 0, -0.45]}>
        <WarpField compact={compact} />
        <DebrisField compact={compact} reducedMotion={reducedMotion} />
        <AccretionField compact={compact} reducedMotion={reducedMotion} />
        <group rotation={[compact ? 1.2 : 1.12, 0.08, -0.08]}>
          <PhotonRing radius={compact ? 1.44 : 1.82} tube={0.026} rotation={[0, 0, 0]} speed={0.034} opacity={0.34} compact={compact} phase={0.2} />
          <PhotonRing radius={compact ? 2.02 : 2.58} tube={0.017} rotation={[0.04, 0.06, 0.04]} speed={-0.022} opacity={0.2} compact={compact} phase={1.5} />
          <PhotonRing radius={compact ? 2.72 : 3.48} tube={0.011} rotation={[-0.03, -0.04, 0.02]} speed={0.014} opacity={0.12} compact={compact} phase={2.7} />
          <Singularity compact={compact} />
          <EventHorizonShadow compact={compact} />
        </group>
      </group>
    </>
  );
};

const createMetricState = () => ({
  ping: 14,
  nodes: 143,
  sync: 98.6,
  packets: 742,
  throughput: 42.8,
  signal: 96,
});

const LiveMetric = ({ label, value, suffix = "", icon: Icon }) => (
  <div className="live-metric">
    <span className="metric-label">{Icon && <Icon size={13} />} {label}</span>
    <motion.span
      className="metric-value"
      key={`${label}-${value}`}
      initial={{ opacity: 0.45, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {value}{suffix}
    </motion.span>
  </div>
);

const MetricDeck = ({ metrics, variant }) => {
  const rows =
    variant === "sync"
      ? [
          { label: "PING", value: metrics.ping, suffix: "ms", icon: Signal },
          { label: "NODES", value: metrics.nodes, icon: Network },
          { label: "SYNC", value: metrics.sync.toFixed(1), suffix: "%", icon: Activity },
        ]
      : [
          { label: "PACKETS", value: metrics.packets, icon: ScanSearch },
          { label: "LINK", value: metrics.signal.toFixed(0), suffix: "%", icon: ShieldCheck },
          { label: "FLOW", value: metrics.throughput.toFixed(1), suffix: "mb/s", icon: RadioReceiver },
        ];

  return (
    <div className="live-metric-grid">
      {rows.map((row) => (
        <LiveMetric key={row.label} {...row} />
      ))}
    </div>
  );
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState("ENTER A 5 LETTER NODE ID");
  const [activeSection, setActiveSection] = useState(0);
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth <= 760);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [metrics, setMetrics] = useState(createMetricState);
  const noticeTimer = useRef(null);
  const isValid = /^[A-Z]{5}$/.test(username);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMedia = () => {
      setCompact(media.matches);
      setReducedMotion(motionMedia.matches);
    };

    syncMedia();
    media.addEventListener("change", syncMedia);
    motionMedia.addEventListener("change", syncMedia);

    return () => {
      media.removeEventListener("change", syncMedia);
      motionMedia.removeEventListener("change", syncMedia);
    };
  }, []);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics((current) => {
        const spike = Math.random() > 0.88;
        return {
          ping: Math.max(8, Math.round(current.ping + (Math.random() - 0.45) * 5 + (spike ? 9 : 0))),
          nodes: Math.max(118, Math.round(current.nodes + (Math.random() - 0.47) * 5)),
          sync: Math.min(99.8, Math.max(96.4, current.sync + (Math.random() - 0.48) * 0.55)),
          packets: Math.max(640, Math.round(current.packets + (Math.random() - 0.42) * 42)),
          throughput: Math.min(62, Math.max(28, current.throughput + (Math.random() - 0.48) * 2.4)),
          signal: Math.min(99, Math.max(88, current.signal + (Math.random() - 0.5) * 2.1)),
        };
      });
    };

    const interval = window.setInterval(updateMetrics, 920);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let frame = 0;
    let lenis;

    const updateProgress = ({ scroll, limit, velocity, progress } = {}) => {
      const available = Math.max(1, limit ?? document.documentElement.scrollHeight - window.innerHeight);
      const rawProgress = typeof progress === "number" ? progress : (scroll ?? window.scrollY) / available;
      heroMotion.target = clamp01(rawProgress);
      heroMotion.velocity = velocity ?? heroMotion.velocity;
      const section = Math.min(3, Math.floor(heroMotion.target * 4.05));
      setActiveSection((current) => (current === section ? current : section));
    };

    const updatePointer = (event) => {
      heroMotion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      heroMotion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    const resetPointer = () => {
      heroMotion.pointerX = 0;
      heroMotion.pointerY = 0;
    };

    if (!reducedMotion) {
      lenis = new Lenis({
        duration: 1.55,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.74,
        touchMultiplier: 1.08,
        syncTouch: true,
      });
      lenis.on("scroll", updateProgress);

      const raf = (time) => {
        lenis.raf(time);
        frame = window.requestAnimationFrame(raf);
      };
      frame = window.requestAnimationFrame(raf);
      document.documentElement.classList.add("orbit-lenis-active");
    } else {
      updateProgress();
      window.addEventListener("scroll", updateProgress, { passive: true });
    }

    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerleave", resetPointer);
    updateProgress();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (lenis) lenis.destroy();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", resetPointer);
      document.documentElement.classList.remove("orbit-lenis-active");
      heroMotion.target = 0;
      heroMotion.current = 0;
      heroMotion.velocity = 0;
    };
  }, [reducedMotion]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const handleInput = (event) => {
    const raw = event.target.value.toUpperCase();
    const letters = raw.replace(/[^A-Z]/g, "");
    const next = letters.slice(0, 5);
    setUsername(next);
    window.clearTimeout(noticeTimer.current);

    if (raw !== letters) {
      setNotice("LETTERS ONLY - SIGNAL REJECTED");
    } else if (letters.length > 5) {
      setNotice("NODE ID LIMITED TO 5 LETTERS");
    } else if (next.length === 5) {
      setNotice("IDENTITY VERIFIED - LINK READY");
    } else {
      setNotice(`AWAITING ${5 - next.length} MORE LETTER${next.length === 4 ? "" : "S"}`);
    }

    if (raw !== letters) {
      noticeTimer.current = window.setTimeout(() => {
        setNotice(next.length === 5 ? "IDENTITY VERIFIED - LINK READY" : "ENTER A 5 LETTER NODE ID");
      }, 1300);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) {
      setNotice("EXACTLY 5 LETTERS REQUIRED");
      return;
    }
    onLogin(username, "Global");
  };

  return (
    <main className="orbit-entry">
      <div className="network-canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, compact ? 10.6 : 11.8], fov: 42 }}
          dpr={compact ? [1, 1.12] : [1, 1.55]}
          gl={{ antialias: !compact, alpha: false, powerPreference: "high-performance" }}
        >
          <BlackHoleSystemScene compact={compact} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className="network-vignette" aria-hidden="true" />
      <div className="entry-status-strip" aria-hidden="true">
        <span>ORBIT ENGINE</span>
        <span>{metrics.ping}MS</span>
        <span>{metrics.nodes} NODES</span>
      </div>

      <nav className="chapter-rail" aria-label="Network initialization stages">
        {["INIT", "SYNC", "LIVE", "CONNECT"].map((label, index) => (
          <span key={label} className={activeSection === index ? "current" : ""}>
            <i />
            {label}
          </span>
        ))}
      </nav>

      <div className="entry-sections">
        <section className="entry-panel entry-intro">
          <motion.div className="entry-copy centered" initial="hidden" whileInView="visible" viewport={{ amount: 0.45 }} variants={easeReveal}>
            <div className="entry-kicker"><Aperture size={13} /> ORBIT / SPATIAL ENGINE</div>
            <h1>Enter<br /><strong>The Orbit</strong></h1>
            <p>A Realtime Network Built For Spatial Communication and Live Interaction</p>
            <div className="entry-scroll-prompt"><span /> SCROLL DOWN</div>
          </motion.div>
        </section>

        <section className="entry-panel entry-sync">
          <motion.article className="network-card right" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Network size={22} />
            <div className="card-index">01 / LIVE MAP AWARENESS</div>
            <h2>SYNC REALTIME</h2>
            <p>Orbit synchronizes movement, proximity and room activity into one operational field.</p>
            <MetricDeck metrics={metrics} variant="sync" />
          </motion.article>
        </section>

        <section className="entry-panel entry-verify">
          <motion.article className="network-card left" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Fingerprint size={22} />
            <div className="card-index">02 / IDENTITY NODE</div>
            <h2>A live signal joins the Orbit network</h2>
            <p>A concise identity key binds chat, location and awareness into the Orbit network</p>
            <MetricDeck metrics={metrics} variant="identity" />
          </motion.article>
        </section>

        <section className="entry-panel entry-access">
          <div className="orbit-login-replica">
            <div className="orbit-title">
              <span>ENTER</span>
              <strong>ORBIT</strong>
            </div>

            <div className="orbit-card">
              <div className="orbit-card-inner">
                <div className="orbit-sync-icon">
                  <RadioReceiver size={15} />
                </div>

                <div className="orbit-sync-text">
                  IDENTITY SYNCHRONIZATION
                </div>

                <form
                  className={`orbit-form ${isValid ? "ready" : ""}`}
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <div className="orbit-input-wrap">
                    <span>[</span>
                    <input
                      id="orbit-identity"
                      type="text"
                      value={username}
                      onChange={handleInput}
                      maxLength={5}
                      placeholder="USERNAME"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <span>]</span>
                  </div>

                  <div className="orbit-status">
                    {notice} . . . {username.length}/5
                  </div>

                  <button type="submit" disabled={!isValid}>
                    <Fingerprint size={14} />
                    CONNECT TO NETWORK
                  </button>
                </form>

                <div className="orbit-footer">
                  DEVELOPED BY OSCAR
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
