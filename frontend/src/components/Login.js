import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "framer-motion";
import Lenis from "lenis";
import * as THREE from "three";
import "./Login.css";

/* ═══════════════════════════════════════════════════════════════
   SHARED SCROLL STATE
   ═══════════════════════════════════════════════════════════════ */
const journey = {
  target: 0,
  current: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (e0, e1, v) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;

/* ═══════════════════════════════════════════════════════════════
   PREMIUM MONOCHROME CUBE — solid industrial surfaces
   ═══════════════════════════════════════════════════════════════ */
const CubeMaterial = () => {
  return (
    <meshStandardMaterial
      color="#d8d8d8"
      roughness={0.18}
      metalness={0.42}
      envMapIntensity={0.6}
    />
  );
};

/* Door panel on the front face */
const DoorPanel = () => {
  const ref = useRef();
  const handleRef = useRef();

  useFrame(() => {
    if (!ref.current) return;
    const p = journey.current;
    const doorOpen = smoothstep(0.2, 0.55, p);
    // Hinge rotation on Y axis (opens outward)
    ref.current.rotation.y = -doorOpen * Math.PI * 0.55;
    ref.current.position.x = -0.7 + doorOpen * 0.02;
    ref.current.position.z = 1.501 - doorOpen * 0.1;

    if (handleRef.current) {
      handleRef.current.material.emissiveIntensity = doorOpen * 0.3;
    }
  });

  return (
    <group ref={ref} position={[-0.7, -0.15, 1.501]}>
      {/* Door panel */}
      <mesh position={[0.35, 0, -0.001]}>
        <boxGeometry args={[0.7, 0.75, 0.04]} />
        <meshStandardMaterial
          color="#c8c8c8"
          roughness={0.15}
          metalness={0.5}
        />
      </mesh>
      {/* Seam line */}
      <mesh position={[0.35, 0, 0.021]}>
        <boxGeometry args={[0.72, 0.77, 0.001]} />
        <meshStandardMaterial
          color="#999"
          roughness={0.3}
          metalness={0.4}
          transparent
          opacity={0.3}
        />
      </mesh>
      {/* Small handle */}
      <mesh ref={handleRef} position={[0.6, 0, 0.03]}>
        <boxGeometry args={[0.06, 0.06, 0.025]} />
        <meshStandardMaterial
          color="#888"
          roughness={0.1}
          metalness={0.8}
          emissive="#ffffff"
          emissiveIntensity={0}
        />
      </mesh>
    </group>
  );
};

/* Seam lines visible on scroll */
const CubeSeams = () => {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current) return;
    const p = journey.current;
    ref.current.material.opacity = smoothstep(0.08, 0.3, p) * 0.6;
  });

  return (
    <lineSegments ref={ref}>
      <edgesGeometry
        args={[new THREE.BoxGeometry(3.01, 3.01, 3.01)]}
      />
      <lineBasicMaterial
        color="#666666"
        transparent
        opacity={0}
        linewidth={1}
      />
    </lineSegments>
  );
};

/* ═══════════════════════════════════════════════════════════════
   COSMIC INTERIOR — stars, dust, black hole vortex
   ═══════════════════════════════════════════════════════════════ */
const StarField = ({ count = 600 }) => {
  const ref = useRef();
  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.3 + Math.random() * 1.1;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 0.15;
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i] = 0.5 + Math.random() * 2.5;
    }
    return [pos, sz];
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPull: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material;
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uProgress.value = journey.current;
    mat.uniforms.uPull.value = smoothstep(0.45, 0.85, journey.current);
  });

  return (
    <points ref={ref} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={count} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uProgress;
          uniform float uPull;
          attribute float aSize;
          varying float vAlpha;
          varying float vDist;

          void main() {
            vec3 p = position;
            float reveal = smoothstep(0.3, 0.65, uProgress);

            // Gravitational spiral
            float dist = length(p.xz);
            float angle = atan(p.z, p.x) + uTime * 0.15 * (1.0 + uPull * 2.0) / max(0.3, dist);
            float pullRadius = dist * (1.0 - uPull * 0.5 * smoothstep(0.0, 1.5, dist));
            p.x = cos(angle) * pullRadius;
            p.z = sin(angle) * pullRadius;
            p.y += sin(uTime * 0.4 + dist * 3.0) * 0.02;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * reveal * (18.0 / max(1.0, -mv.z));
            vAlpha = reveal * (0.4 + 0.6 * smoothstep(1.5, 0.1, dist));
            vDist = dist;
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          varying float vDist;

          void main() {
            float r = length(gl_PointCoord - 0.5);
            if (r > 0.5) discard;
            float glow = smoothstep(0.5, 0.0, r);
            float warm = smoothstep(0.8, 0.0, vDist);
            vec3 col = mix(vec3(0.7, 0.75, 0.9), vec3(1.0, 0.95, 0.85), warm * 0.3);
            gl_FragColor = vec4(col, glow * vAlpha);
          }
        `}
      />
    </points>
  );
};

/* Cosmic dust particles */
const CosmicDust = ({ count = 300 }) => {
  const ref = useRef();
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.15 + Math.random() * 0.9;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 0.15;
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.uniforms.uTime.value = clock.elapsedTime;
    ref.current.material.uniforms.uProgress.value = journey.current;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uProgress;
          varying float vAlpha;

          void main() {
            vec3 p = position;
            float reveal = smoothstep(0.35, 0.7, uProgress);
            float dist = length(p.xz);
            float angle = atan(p.z, p.x) + uTime * 0.08 / max(0.2, dist);
            p.x = cos(angle) * dist;
            p.z = sin(angle) * dist;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = 1.2 * reveal * (12.0 / max(1.0, -mv.z));
            vAlpha = reveal * 0.3;
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          void main() {
            float r = length(gl_PointCoord - 0.5);
            if (r > 0.5) discard;
            gl_FragColor = vec4(vec3(0.6, 0.65, 0.8), smoothstep(0.5, 0.1, r) * vAlpha);
          }
        `}
      />
    </points>
  );
};

/* Black hole vortex ring */
const VortexRing = () => {
  const ref = useRef();
  const ringCount = 3;
  const ringGeo = useMemo(() => new THREE.TorusGeometry(0.25, 0.008, 16, 64), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = journey.current;
    const reveal = smoothstep(0.4, 0.75, p);
    ref.current.children.forEach((ring, i) => {
      ring.rotation.x = Math.PI / 2 + Math.sin(clock.elapsedTime * 0.3 + i * 1.2) * 0.15 * reveal;
      ring.rotation.z = clock.elapsedTime * (0.1 + i * 0.05) * reveal;
      ring.scale.setScalar(reveal * (0.8 + i * 0.4));
      ring.material.opacity = reveal * (0.35 - i * 0.08);
    });
  });

  return (
    <group ref={ref} position={[0, -0.15, 0]}>
      {Array.from({ length: ringCount }).map((_, i) => (
        <mesh key={i} geometry={ringGeo}>
          <meshBasicMaterial
            color="#8888cc"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

/* Black hole center disk */
const BlackHoleCenter = () => {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const reveal = smoothstep(0.45, 0.8, journey.current);
    ref.current.scale.setScalar(reveal * 0.15);
    ref.current.material.opacity = reveal * 0.95;
    ref.current.rotation.z = clock.elapsedTime * 0.05;
  });

  return (
    <mesh ref={ref} position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CAMERA RIG — cinematic scroll-linked movement
   ═══════════════════════════════════════════════════════════════ */
const CameraRig = ({ reducedMotion }) => {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    journey.current = lerp(journey.current, journey.target, reducedMotion ? 0.18 : 0.04);

    const p = journey.current;
    const t = clock.elapsedTime;

    // Subtle pointer parallax
    const pw = reducedMotion ? 0 : 0.25;

    // Camera path: starts far, orbits slightly, moves closer to door
    const baseX = Math.sin(p * Math.PI * 0.4) * 1.2 + journey.pointerX * pw;
    const baseY = 1.5 - p * 1.8 + journey.pointerY * pw * 0.5;
    const baseZ = 7.5 - p * 3.5;

    // Subtle idle sway
    const idleX = reducedMotion ? 0 : Math.sin(t * 0.12) * 0.04;
    const idleY = reducedMotion ? 0 : Math.cos(t * 0.09) * 0.03;

    camera.position.x = lerp(camera.position.x, baseX + idleX, 0.045);
    camera.position.y = lerp(camera.position.y, baseY + idleY, 0.045);
    camera.position.z = lerp(camera.position.z, baseZ, 0.045);

    camera.fov = lerp(camera.fov, 38 + p * 8, 0.04);
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
  });

  return null;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN SCENE — Cube + Interior + Atmosphere
   ═══════════════════════════════════════════════════════════════ */
const CubeScene = ({ compact, reducedMotion }) => {
  const cubeGroup = useRef();

  useFrame(({ clock }) => {
    if (!cubeGroup.current) return;
    const t = clock.elapsedTime;
    // Very subtle idle floating
    const drift = reducedMotion ? 0.005 : 0.015;
    cubeGroup.current.position.y = Math.sin(t * 0.25) * drift;
    cubeGroup.current.rotation.y = lerp(
      cubeGroup.current.rotation.y,
      -0.35 + Math.sin(t * 0.08) * 0.02 + journey.current * 0.15,
      0.03
    );
    cubeGroup.current.rotation.x = lerp(
      cubeGroup.current.rotation.x,
      0.15 + Math.sin(t * 0.06) * 0.01,
      0.03
    );
  });

  return (
    <>
      <color attach="background" args={["#060608"]} />
      <fog attach="fog" args={["#060608", 6, 22]} />

      <CameraRig reducedMotion={reducedMotion} />

      {/* Lighting — cinematic, physically believable */}
      <ambientLight intensity={0.15} color="#b0b8c8" />
      <directionalLight position={[4, 6, 3]} intensity={1.8} color="#e8e4df" castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#8890a8" />
      <pointLight position={[0, -2, 4]} intensity={0.3} color="#ffffff" distance={8} />

      {/* Soft environment reflection */}
      <hemisphereLight args={["#c0c8d4", "#1a1a2e", 0.25]} />

      <group ref={cubeGroup}>
        {/* Main cube body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 3, 3]} />
          <CubeMaterial />
        </mesh>

        {/* Subtle bevel edges */}
        <CubeSeams />

        {/* Door panel */}
        <DoorPanel />

        {/* Cosmic interior — revealed when door opens */}
        <group position={[0, 0, 0]}>
          <StarField count={compact ? 350 : 600} />
          <CosmicDust count={compact ? 150 : 300} />
          <VortexRing />
          <BlackHoleCenter />
        </group>
      </group>

      {/* Ground shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.15} />
      </mesh>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FRAMER MOTION VARIANTS
   ═══════════════════════════════════════════════════════════════ */
const easeReveal = {
  hidden: { opacity: 0, y: 28, filter: "blur(12px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ═══════════════════════════════════════════════════════════════
   LOGIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState("ENTER A 5 LETTER CALLSIGN");
  const [activeSection, setActiveSection] = useState(0);
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth <= 760);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const noticeTimer = useRef(null);
  const isValid = /^[A-Z]{5}$/.test(username);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setCompact(media.matches);
      setReducedMotion(motionMedia.matches);
    };
    sync();
    media.addEventListener("change", sync);
    motionMedia.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      motionMedia.removeEventListener("change", sync);
    };
  }, []);

  /* Scroll system */
  useEffect(() => {
    let frame = 0;
    let lenis;

    const updateProgress = ({ scroll, limit, velocity, progress } = {}) => {
      const available = Math.max(1, limit ?? document.documentElement.scrollHeight - window.innerHeight);
      const raw = typeof progress === "number" ? progress : (scroll ?? window.scrollY) / available;
      journey.target = clamp01(raw);
      journey.velocity = velocity ?? journey.velocity;
      const section = Math.min(3, Math.floor(journey.target * 4.05));
      setActiveSection((c) => (c === section ? c : section));
    };

    const updatePointer = (e) => {
      journey.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      journey.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const resetPointer = () => { journey.pointerX = 0; journey.pointerY = 0; };

    if (!reducedMotion) {
      lenis = new Lenis({
        duration: 1.6,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.7,
        touchMultiplier: 1.05,
        syncTouch: true,
      });
      lenis.on("scroll", updateProgress);
      const raf = (time) => { lenis.raf(time); frame = window.requestAnimationFrame(raf); };
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
      journey.target = 0; journey.current = 0; journey.velocity = 0;
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
      setNotice("LETTERS ONLY");
    } else if (letters.length > 5) {
      setNotice("5 CHARACTERS MAXIMUM");
    } else if (next.length === 5) {
      setNotice("IDENTITY VERIFIED");
    } else {
      setNotice(`${5 - next.length} MORE LETTER${next.length === 4 ? "" : "S"} NEEDED`);
    }

    if (raw !== letters) {
      noticeTimer.current = window.setTimeout(() => {
        setNotice(next.length === 5 ? "IDENTITY VERIFIED" : "ENTER A 5 LETTER CALLSIGN");
      }, 1200);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) { setNotice("EXACTLY 5 LETTERS REQUIRED"); return; }
    onLogin(username, "Global");
  };

  return (
    <main className="orbit-entry">
      {/* 3D Canvas */}
      <div className="orbit-canvas-wrap" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 1.5, 7.5], fov: 38 }}
          dpr={compact ? [1, 1.2] : [1, 1.6]}
          shadows
          gl={{
            antialias: !compact,
            alpha: false,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
        >
          <CubeScene compact={compact} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      {/* Atmospheric overlays */}
      <div className="orbit-vignette" aria-hidden="true" />

      {/* Progress rail */}
      <nav className="orbit-rail" aria-label="Scroll progress">
        {["I", "II", "III", "IV"].map((label, i) => (
          <span key={label} className={activeSection === i ? "active" : ""}>
            <i />{label}
          </span>
        ))}
      </nav>

      {/* Scroll sections */}
      <div className="orbit-sections">
        {/* Section 1: Discovery */}
        <section className="orbit-section">
          <motion.div className="orbit-hero" initial="hidden" whileInView="visible" viewport={{ amount: 0.4 }} variants={easeReveal}>
            <div className="orbit-badge">ORBIT</div>
            <h1>Discover<br /><strong>The Unknown.</strong></h1>
            <p>A mysterious object. An impossible interior. An entry point into spatial awareness.</p>
            <div className="orbit-scroll-hint">
              <span />
              SCROLL TO EXPLORE
            </div>
          </motion.div>
        </section>

        {/* Section 2: Opening */}
        <section className="orbit-section">
          <motion.div className="orbit-card orbit-card--right" initial="hidden" whileInView="visible" viewport={{ amount: 0.35 }} variants={easeReveal}>
            <div className="orbit-card-num">01</div>
            <h2>The seams appear.<br />Something unlocks.</h2>
            <p>Precision-engineered panels begin to separate, revealing darkness within the monolith.</p>
          </motion.div>
        </section>

        {/* Section 3: Revelation */}
        <section className="orbit-section">
          <motion.div className="orbit-card orbit-card--left" initial="hidden" whileInView="visible" viewport={{ amount: 0.35 }} variants={easeReveal}>
            <div className="orbit-card-num">02</div>
            <h2>An entire universe<br />inside a cube.</h2>
            <p>Stars spiral inward. Space bends. The interior is infinitely larger than the object itself.</p>
          </motion.div>
        </section>

        {/* Section 4: Login */}
        <section className="orbit-section orbit-section--login">
          <motion.div className="orbit-terminal" initial="hidden" whileInView="visible" viewport={{ amount: 0.3 }} variants={easeReveal}>
            <div className="orbit-terminal-badge">ENTER THE SYSTEM</div>
            <h2>Initialize</h2>
            <p className="orbit-terminal-desc">Choose a five-letter identity to enter Orbit.</p>

            <form className={`orbit-form ${isValid ? "ready" : ""}`} onSubmit={handleSubmit} noValidate>
              <label htmlFor="orbit-callsign">CALLSIGN</label>
              <div className="orbit-input-wrap">
                <input
                  id="orbit-callsign"
                  type="text"
                  value={username}
                  onChange={handleInput}
                  maxLength={5}
                  placeholder="ALPHA"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="orbit-feedback"
                  aria-invalid={!isValid && username.length > 0}
                />
              </div>
              <div id="orbit-feedback" className="orbit-feedback" aria-live="polite">
                <span className={isValid ? "verified" : ""} />
                {notice}
              </div>
              <button type="submit" disabled={!isValid}>
                OPEN ORBIT
              </button>
            </form>
          </motion.div>
        </section>
      </div>
    </main>
  );
};

export default Login;
