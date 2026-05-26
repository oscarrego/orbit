import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "framer-motion";
import * as THREE from "three";
import { Activity, Aperture, Fingerprint, Network, RadioReceiver, ScanSearch } from "lucide-react";
import "./Login.css";

const journey = {
  target: 0,
  current: 0,
  pointerX: 0,
  pointerY: 0,
};

const easeReveal = {
  hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const buildCorridor = (compact) => {
  const points = [];
  const depthCount = compact ? 16 : 25;
  const sideRows = compact ? 8 : 12;
  for (let zIndex = 0; zIndex < depthCount; zIndex += 1) {
    const z = -zIndex * 0.88 + 7;
    for (let row = -sideRows; row <= sideRows; row += 1) {
      const y = row * 0.44;
      points.push(-6.3, y, z, 6.3, y, z);
    }
    for (let col = -13; col <= 13; col += 1) {
      const x = col * 0.47;
      points.push(x, -5.3, z, x, 5.3, z);
    }
  }
  return new Float32Array(points);
};

const buildCore = (compact) => {
  const points = [];
  const extent = compact ? 6 : 8;
  for (let x = -extent; x <= extent; x += 1) {
    for (let y = -extent; y <= extent; y += 1) {
      for (let z = -extent; z <= extent; z += 1) {
        const onShell =
          Math.abs(x) === extent || Math.abs(y) === extent || Math.abs(z) === extent;
        if (!onShell || (x + y + z) % 2 !== 0) continue;
        points.push(x * 0.34, y * 0.34, z * 0.34);
      }
    }
  }
  return new Float32Array(points);
};

const buildLinks = (compact) => {
  const points = [];
  const rows = compact ? 14 : 24;
  for (let index = 0; index < rows; index += 1) {
    const lane = (index - rows / 2) * 0.42;
    for (let step = 0; step < 36; step += 1) {
      const progress = step / 35;
      const z = 9 - progress * 20;
      const x = lane + Math.sin(progress * Math.PI * 3 + index) * 0.3;
      const y = Math.cos(progress * Math.PI * 2 + index * 0.25) * 1.45;
      points.push(x, y, z);
    }
  }
  return new Float32Array(points);
};

const MatrixCloud = ({ positions, size, intensity, phase, reducedMotion }) => {
  const material = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uIntensity: { value: intensity },
      uPhase: { value: phase },
      uSize: { value: size },
      uMotion: { value: reducedMotion ? 0.12 : 1 },
    }),
    [intensity, phase, size, reducedMotion]
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
          uniform float uPhase;
          uniform float uSize;
          uniform float uMotion;
          varying float vAlpha;
          void main() {
            vec3 point = position;
            float pulse = sin(point.z * 0.72 + uTime * 0.85 + uPhase) * 0.05 * uMotion;
            float opening = smoothstep(0.18, 0.62, uProgress);
            point.x *= 1.0 + opening * 0.36;
            point.y += pulse + sin(point.x + uTime * 0.24) * opening * 0.05 * uMotion;
            point.z += uProgress * (3.0 + uPhase * 0.3);
            vec4 mv = modelViewMatrix * vec4(point, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(uSize * (26.0 / max(2.0, -mv.z)), 1.0, 4.0);
            vAlpha = 0.28 + 0.5 * (0.5 + 0.5 * sin(uTime * 0.7 + point.z + uPhase));
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
            gl_FragColor = vec4(vec3(0.95), glow * vAlpha * uIntensity);
          }
        `}
      />
    </points>
  );
};

const ScanFrame = ({ reducedMotion }) => {
  const frameRef = useRef(null);
  useFrame(({ clock }) => {
    if (!frameRef.current) return;
    const progress = journey.current;
    frameRef.current.position.z = THREE.MathUtils.lerp(8, -7, progress);
    frameRef.current.rotation.z = reducedMotion ? 0 : clock.elapsedTime * 0.07;
    frameRef.current.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.22);
  });

  return (
    <group ref={frameRef}>
      <mesh>
        <ringGeometry args={[2.2, 2.23, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.33} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[3.04, 3.06, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
};

const CameraRig = ({ reducedMotion }) => {
  const { camera } = useThree();
  useFrame(() => {
    journey.current = THREE.MathUtils.lerp(journey.current, journey.target, reducedMotion ? 0.2 : 0.055);
    const progress = journey.current;
    const pointerWeight = reducedMotion ? 0 : 0.44;
    const targetX = journey.pointerX * pointerWeight + Math.sin(progress * Math.PI * 2) * 0.22;
    const targetY = journey.pointerY * pointerWeight + (0.5 - progress) * 0.7;
    const targetZ = 13.2 - progress * 7.2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.06);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.06);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, (progress - 0.5) * -0.045, 0.06);
    camera.fov = THREE.MathUtils.lerp(camera.fov, 44 + progress * 9, 0.06);
    camera.updateProjectionMatrix();
  });
  return null;
};

const NetworkScene = ({ compact, reducedMotion }) => {
  const architecture = useRef(null);
  const corridor = useMemo(() => buildCorridor(compact), [compact]);
  const core = useMemo(() => buildCore(compact), [compact]);
  const links = useMemo(() => buildLinks(compact), [compact]);

  useFrame(({ clock }) => {
    if (!architecture.current) return;
    const progress = journey.current;
    architecture.current.rotation.y = THREE.MathUtils.lerp(
      architecture.current.rotation.y,
      progress * 0.42 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.16) * 0.04),
      0.045
    );
    architecture.current.rotation.x = THREE.MathUtils.lerp(
      architecture.current.rotation.x,
      -0.04 + progress * 0.18,
      0.045
    );
  });

  return (
    <>
      <color attach="background" args={["#050608"]} />
      <fog attach="fog" args={["#050608", 8, 27]} />
      <CameraRig reducedMotion={reducedMotion} />
      <group ref={architecture}>
        <MatrixCloud positions={corridor} size={1.5} intensity={0.32} phase={0.1} reducedMotion={reducedMotion} />
        <group position={[0, 0, -3]}>
          <MatrixCloud positions={core} size={2.5} intensity={0.8} phase={1.9} reducedMotion={reducedMotion} />
        </group>
        <MatrixCloud positions={links} size={2} intensity={0.55} phase={3.2} reducedMotion={reducedMotion} />
        <ScanFrame reducedMotion={reducedMotion} />
      </group>
    </>
  );
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState("ENTER A 5 LETTER NODE ID");
  const [activeSection, setActiveSection] = useState(0);
  const [compact, setCompact] = useState(() => window.innerWidth <= 760);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
    const updateJourney = () => {
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      journey.target = Math.min(1, Math.max(0, window.scrollY / available));
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
    updateJourney();
    window.addEventListener("scroll", updateJourney, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerleave", resetPointer);
    return () => {
      window.removeEventListener("scroll", updateJourney);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", resetPointer);
      journey.target = 0;
      journey.current = 0;
    };
  }, []);

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
          camera={{ position: [0, 0, 13.2], fov: 44 }}
          dpr={compact ? [1, 1.15] : [1, 1.6]}
          gl={{ antialias: !compact, alpha: false, powerPreference: "high-performance" }}
        >
          <NetworkScene compact={compact} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className="network-vignette" aria-hidden="true" />
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
            <div className="entry-kicker"><Aperture size={13} /> ORBIT NETWORK / INITIALIZATION</div>
            <h1>Presence<br /><strong>Online.</strong></h1>
            <p>Initializing a live spatial network where every connected identity is visible in motion, in real time.</p>
            <div className="entry-scroll-prompt"><span /> SCROLL TO SYNCHRONIZE</div>
          </motion.div>
        </section>

        <section className="entry-panel entry-sync">
          <motion.article className="network-card right" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Network size={22} />
            <div className="card-index">01 / REALTIME FIELD</div>
            <h2>Nodes align across a living map.</h2>
            <p>Presence packets resolve into location, movement and communication without losing spatial context.</p>
            <div className="network-metrics">
              <span><Activity size={14} /> STREAM ACTIVE</span>
              <span><ScanSearch size={14} /> POSITION LOCKED</span>
            </div>
          </motion.article>
        </section>

        <section className="entry-panel entry-verify">
          <motion.article className="network-card left" initial="hidden" whileInView="visible" viewport={{ amount: 0.38 }} variants={easeReveal}>
            <Fingerprint size={22} />
            <div className="card-index">02 / IDENTITY GATE</div>
            <h2>A node becomes a presence.</h2>
            <p>Register a concise identity signature. Orbit binds it to the network and opens the shared operating field.</p>
            <div className="verify-track">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </motion.article>
        </section>

        <section className="entry-panel entry-access">
          <motion.div className="access-terminal" initial="hidden" whileInView="visible" viewport={{ amount: 0.32 }} variants={easeReveal}>
            <div className="terminal-kicker"><RadioReceiver size={14} /> NETWORK ACCESS READY</div>
            <h2>Enter Orbit</h2>
            <p className="terminal-copy">Activate one presence node using a five-letter alphabetic identity.</p>
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
                INITIALIZE CONNECTION
              </button>
            </form>
            <div className="terminal-footer">SPATIAL PRESENCE / SECURE NODE LINK / REALTIME CHANNEL</div>
          </motion.div>
        </section>
      </div>
    </main>
  );
};

export default Login;
