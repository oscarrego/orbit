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

const journey = {
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

const buildDotCube = (compact) => {
  const positions = [];
  const normals = [];
  const half = compact ? 2.45 : 3.1;
  const density = compact ? 11 : 15;
  const step = (half * 2) / (density - 1);

  const pushPoint = (axis, sign, a, b) => {
    const coords = [0, 0, 0];
    const normal = [0, 0, 0];
    coords[axis] = sign * half;
    normal[axis] = sign;

    const sideAxes = [0, 1, 2].filter((index) => index !== axis);
    coords[sideAxes[0]] = -half + a * step;
    coords[sideAxes[1]] = -half + b * step;

    const jitter = Math.sin((a + 1.7) * 12.989 + (b + 3.1) * 78.233 + axis * 18.4 + sign) * 0.012;
    positions.push(coords[0] + jitter, coords[1] - jitter, coords[2] + jitter * 0.5);
    normals.push(normal[0], normal[1], normal[2]);
  };

  for (let axis = 0; axis < 3; axis += 1) {
    [-1, 1].forEach((sign) => {
      for (let a = 0; a < density; a += 1) {
        for (let b = 0; b < density; b += 1) {
          pushPoint(axis, sign, a, b);
        }
      }
    });
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
};

const buildInternalMatrix = (compact) => {
  const positions = [];
  const span = compact ? 2.05 : 2.65;
  const density = compact ? 7 : 9;
  const step = (span * 2) / (density - 1);

  for (let x = 0; x < density; x += 1) {
    for (let y = 0; y < density; y += 1) {
      for (let z = 0; z < density; z += 1) {
        const edgeBias = x === 0 || y === 0 || z === 0 || x === density - 1 || y === density - 1 || z === density - 1;
        if (!edgeBias && (x + y + z) % 2 === 1) continue;
        positions.push(-span + x * step, -span + y * step, -span + z * step);
      }
    }
  }

  return new Float32Array(positions);
};

const buildPacketLines = (compact) => {
  const positions = [];
  const rails = compact ? 18 : 28;
  const length = compact ? 5.7 : 7.1;

  for (let index = 0; index < rails; index += 1) {
    const side = index % 4;
    const offset = (index - rails / 2) * 0.16;
    const wobble = Math.sin(index * 1.7) * 0.18;
    let start;
    let end;

    if (side === 0) {
      start = [-length / 2, offset, wobble];
      end = [length / 2, offset * 0.45, -wobble];
    } else if (side === 1) {
      start = [offset, -length / 2, wobble];
      end = [offset * 0.5, length / 2, -wobble];
    } else if (side === 2) {
      start = [offset, wobble, -length / 2];
      end = [-offset * 0.5, -wobble, length / 2];
    } else {
      start = [-length / 2, wobble, offset];
      end = [length / 2, -wobble, -offset];
    }

    positions.push(...start, ...end);
  }

  return new Float32Array(positions);
};

const MatrixPoints = ({ geometryData, size, intensity, phase, reducedMotion }) => {
  const material = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uIntensity: { value: intensity },
      uPhase: { value: phase },
      uSize: { value: size },
      uMotion: { value: reducedMotion ? 0.1 : 1 },
    }),
    [intensity, phase, reducedMotion, size]
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uProgress.value = journey.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={geometryData.positions}
          count={geometryData.positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-normal"
          array={geometryData.normals}
          count={geometryData.normals.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uProgress;
          uniform float uPhase;
          uniform float uSize;
          uniform float uMotion;
          varying float vAlpha;

          void main() {
            vec3 point = position;
            float open = smoothstep(0.12, 0.58, uProgress);
            float reform = smoothstep(0.76, 1.0, uProgress);
            float shimmer = sin(point.x * 2.2 + point.y * 1.7 + point.z * 2.8 + uTime * 0.7 + uPhase);
            vec3 opened = point + normal * (open * 1.85 - reform * 1.18);
            opened += normalize(point + vec3(0.001)) * sin(uProgress * 3.14159) * 0.22;
            opened.y += shimmer * 0.035 * uMotion;
            point = mix(opened, position * 0.84 + normal * 0.18, reform * 0.46);

            vec4 mv = modelViewMatrix * vec4(point, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(uSize * (30.0 / max(2.0, -mv.z)), 1.0, 4.6);
            vAlpha = (0.25 + open * 0.5 - reform * 0.12) * (0.72 + shimmer * 0.18);
          }
        `}
        fragmentShader={`
          uniform float uIntensity;
          varying float vAlpha;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            float radius = length(centered);
            if (radius > 0.5) discard;
            float glow = smoothstep(0.5, 0.05, radius);
            gl_FragColor = vec4(vec3(0.96), glow * vAlpha * uIntensity);
          }
        `}
      />
    </points>
  );
};

const InternalMatrix = ({ positions, reducedMotion }) => {
  const material = useRef(null);
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
    material.current.uniforms.uProgress.value = journey.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uProgress;
          uniform float uMotion;
          varying float vAlpha;

          void main() {
            vec3 point = position;
            float reveal = smoothstep(0.22, 0.7, uProgress);
            point *= 0.8 + reveal * 0.34;
            point.xz *= mat2(cos(uProgress * 0.72), -sin(uProgress * 0.72), sin(uProgress * 0.72), cos(uProgress * 0.72));
            point.y += sin(uTime * 0.9 + point.x * 2.0 + point.z) * 0.045 * uMotion;
            vec4 mv = modelViewMatrix * vec4(point, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp((2.2 + reveal * 0.8) * (24.0 / max(2.0, -mv.z)), 1.0, 4.0);
            vAlpha = reveal * (0.22 + 0.42 * sin(uTime * 0.45 + point.z * 2.0) * 0.5 + 0.5);
          }
        `}
        fragmentShader={`
          varying float vAlpha;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            float radius = length(centered);
            if (radius > 0.5) discard;
            gl_FragColor = vec4(vec3(0.9), smoothstep(0.5, 0.06, radius) * vAlpha);
          }
        `}
      />
    </points>
  );
};

const EdgeCube = ({ size = 6, index = 0 }) => {
  const ref = useRef(null);
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)), [size]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const progress = journey.current;
    const open = smoothstep(0.16, 0.66, progress);
    const reform = smoothstep(0.78, 1, progress);
    ref.current.rotation.x = index * 0.21 + progress * 0.34 + Math.sin(clock.elapsedTime * 0.12 + index) * 0.035;
    ref.current.rotation.y = index * 0.28 + progress * 0.48;
    ref.current.scale.setScalar(1 + open * (0.16 + index * 0.05) - reform * 0.11);
    ref.current.material.opacity = 0.12 + open * 0.18 - reform * 0.04;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#f8fafc" transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  );
};

const PacketLines = ({ positions, reducedMotion }) => {
  const ref = useRef(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const progress = journey.current;
    const reveal = smoothstep(0.28, 0.74, progress);
    ref.current.rotation.y = progress * 0.6 + (reducedMotion ? 0 : clock.elapsedTime * 0.025);
    ref.current.rotation.z = -progress * 0.18;
    ref.current.material.opacity = 0.04 + reveal * 0.24;
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#f6f8fb" transparent opacity={0.08} depthWrite={false} />
    </lineSegments>
  );
};

const CubeFace = ({ axis, sign, compact }) => {
  const ref = useRef(null);
  const size = compact ? 4.9 : 6.2;
  const half = size / 2;

  const rotation = useMemo(() => {
    if (axis === 0) return [0, Math.PI / 2, 0];
    if (axis === 1) return [Math.PI / 2, 0, 0];
    return [0, 0, 0];
  }, [axis]);

  useFrame(() => {
    if (!ref.current) return;
    const progress = journey.current;
    const open = smoothstep(0.2, 0.62, progress);
    const reform = smoothstep(0.8, 1, progress);
    const distance = half + open * 1.05 - reform * 0.72;
    ref.current.position.set(0, 0, 0);
    ref.current.position.setComponent(axis, sign * distance);
    ref.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    ref.current.rotation.x += axis !== 0 ? sign * open * 0.28 : 0;
    ref.current.rotation.y += axis !== 1 ? sign * open * 0.28 : 0;
    ref.current.material.opacity = 0.035 + open * 0.075 - reform * 0.025;
  });

  return (
    <mesh ref={ref} rotation={rotation}>
      <planeGeometry args={[size, size, 7, 7]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.04} wireframe depthWrite={false} />
    </mesh>
  );
};

const CameraRig = ({ reducedMotion }) => {
  const { camera } = useThree();

  useFrame(() => {
    journey.current = THREE.MathUtils.lerp(journey.current, journey.target, reducedMotion ? 0.22 : 0.045);
    journey.velocity = THREE.MathUtils.lerp(journey.velocity, 0, 0.055);

    const progress = journey.current;
    const pointerWeight = reducedMotion ? 0 : 0.42;
    const velocityLift = Math.min(1.2, Math.abs(journey.velocity) * 0.018);
    const targetX = journey.pointerX * pointerWeight + Math.sin(progress * Math.PI * 2) * 0.18;
    const targetY = journey.pointerY * pointerWeight + (0.52 - progress) * 0.82;
    const targetZ = 11.8 - progress * 5.4 + velocityLift;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.055);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.055);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.055);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, (progress - 0.5) * -0.06, 0.055);
    camera.fov = THREE.MathUtils.lerp(camera.fov, 42 + progress * 10, 0.05);
    camera.lookAt(0, 0, -0.35);
    camera.updateProjectionMatrix();
  });

  return null;
};

const CubeNetworkScene = ({ compact, reducedMotion }) => {
  const architecture = useRef(null);
  const cube = useMemo(() => buildDotCube(compact), [compact]);
  const inner = useMemo(() => buildInternalMatrix(compact), [compact]);
  const packets = useMemo(() => buildPacketLines(compact), [compact]);

  useFrame(({ clock }) => {
    if (!architecture.current) return;
    const progress = journey.current;
    architecture.current.rotation.y = THREE.MathUtils.lerp(
      architecture.current.rotation.y,
      progress * 0.52 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.15) * 0.045),
      0.04
    );
    architecture.current.rotation.x = THREE.MathUtils.lerp(
      architecture.current.rotation.x,
      -0.1 + progress * 0.24,
      0.04
    );
  });

  return (
    <>
      <color attach="background" args={["#030405"]} />
      <fog attach="fog" args={["#030405", 7, 24]} />
      <CameraRig reducedMotion={reducedMotion} />
      <group ref={architecture}>
        <MatrixPoints geometryData={cube} size={compact ? 2.7 : 3.1} intensity={0.78} phase={0.4} reducedMotion={reducedMotion} />
        <InternalMatrix positions={inner} reducedMotion={reducedMotion} />
        <PacketLines positions={packets} reducedMotion={reducedMotion} />
        <EdgeCube size={compact ? 4.9 : 6.2} index={0} />
        <EdgeCube size={compact ? 3.4 : 4.5} index={1} />
        <EdgeCube size={compact ? 2.1 : 2.7} index={2} />
        {[0, 1, 2].map((axis) =>
          [-1, 1].map((sign) => (
            <CubeFace key={`${axis}-${sign}`} axis={axis} sign={sign} compact={compact} />
          ))
        )}
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
      journey.target = clamp01(rawProgress);
      journey.velocity = velocity ?? journey.velocity;
      const section = Math.min(3, Math.floor(journey.target * 4.05));
      setActiveSection((current) => (current === section ? current : section));
    };

    const updatePointer = (event) => {
      journey.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      journey.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    const resetPointer = () => {
      journey.pointerX = 0;
      journey.pointerY = 0;
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
      journey.target = 0;
      journey.current = 0;
      journey.velocity = 0;
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
          camera={{ position: [0, 0, 11.8], fov: 42 }}
          dpr={compact ? [1, 1.18] : [1, 1.65]}
          gl={{ antialias: !compact, alpha: false, powerPreference: "high-performance" }}
        >
          <CubeNetworkScene compact={compact} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className="network-vignette" aria-hidden="true" />
      <div className="entry-status-strip" aria-hidden="true">
        <span>ORBIT ENGINE</span>
        <span>{metrics.ping}MS</span>
        <span>{metrics.nodes} NODES</span>
      </div>

      <nav className="chapter-rail" aria-label="Network initialization stages">
        {["INIT", "SYNC", "VERIFY", "LINK"].map((label, index) => (
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
            <h1>Enter<br /><strong>The Field.</strong></h1>
            <p>A realtime presence layer opening inside a monochrome network cube.</p>
            <div className="entry-scroll-prompt"><span /> CORE OPENING</div>
          </motion.div>
        </section>

        <section className="entry-panel entry-sync">
          <motion.article className="network-card right" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Network size={22} />
            <div className="card-index">01 / LIVE MAP AWARENESS</div>
            <h2>Presence resolves into shared spatial truth.</h2>
            <p>Orbit synchronizes movement, proximity and room activity into one operational field.</p>
            <MetricDeck metrics={metrics} variant="sync" />
          </motion.article>
        </section>

        <section className="entry-panel entry-verify">
          <motion.article className="network-card left" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Fingerprint size={22} />
            <div className="card-index">02 / IDENTITY NODE</div>
            <h2>A verified signal becomes a presence node.</h2>
            <p>A concise identity key binds chat, location and awareness into the Orbit network.</p>
            <MetricDeck metrics={metrics} variant="identity" />
          </motion.article>
        </section>

        <section className="entry-panel entry-access">
          <motion.div className="access-terminal" initial="hidden" whileInView="visible" viewport={{ amount: 0.32 }} variants={easeReveal}>
            <div className="terminal-kicker"><RadioReceiver size={14} /> NETWORK ACCESS READY</div>
            <h2>Initialize</h2>
            <p className="terminal-copy">Activate one Orbit node with a five-letter identity.</p>
            <form className={`identity-form ${isValid ? "ready" : ""}`} onSubmit={handleSubmit} noValidate>
              <label htmlFor="orbit-identity">IDENTITY SIGNATURE</label>
              <div className="identity-field">
                <span>[</span>
                <input
                  id="orbit-identity"
                  type="text"
                  value={username}
                  onChange={handleInput}
                  maxLength={5}
                  placeholder="ALPHA"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="identity-feedback"
                  aria-invalid={!isValid && username.length > 0}
                />
                <span>]</span>
              </div>
              <div id="identity-feedback" className="identity-feedback" aria-live="polite">
                <span className={isValid ? "verified" : ""} />
                {notice}
              </div>
              <button type="submit" disabled={!isValid}>
                <Fingerprint size={15} />
                OPEN ORBIT
              </button>
            </form>
            <div className="terminal-footer">PRESENCE / MAP / CHAT / LIVE FIELD</div>
          </motion.div>
        </section>
      </div>
    </main>
  );
};

export default Login;
