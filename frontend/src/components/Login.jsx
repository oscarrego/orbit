import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Float, Sphere, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import Lenis from 'lenis';
import { Lock, Fingerprint, Eye, EyeOff, MapPin, Network, ShieldAlert } from 'lucide-react';
import './Login.css';

// --- GLOBAL SCROLL STATE FOR 3D ---
const scrollState = { current: 0 };
const mouseState = { x: 0, y: 0, targetX: 0, targetY: 0 };

// --- SHADERS & 3D COMPONENTS ---

const DiskMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    colorCore: { value: new THREE.Color('#ffffff') },
    colorMid: { value: new THREE.Color('#00f3ff') },
    colorOuter: { value: new THREE.Color('#020b14') },
    scrollDistortion: { value: 0.0 }
  },
  transparent: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPos;
    uniform float scrollDistortion;
    uniform float time;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Gravitational lensing warp based on scroll
      float dist = length(pos.xy);
      float warp = scrollDistortion * (15.0 / (dist + 0.1));
      pos.z += warp * sin(time + dist);
      
      vPos = pos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 colorCore;
    uniform vec3 colorMid;
    uniform vec3 colorOuter;
    varying vec2 vUv;
    varying vec3 vPos;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
      vec2 pos = vPos.xy;
      float dist = length(pos);
      if(dist < 2.0 || dist > 10.0) discard;

      float angle = atan(pos.y, pos.x);
      
      // High frequency cinematic noise
      float n1 = noise(vec2(angle * 6.0 - time * 3.0, dist * 4.0 - time * 1.5));
      float n2 = noise(vec2(angle * 12.0 + time * 2.0, dist * 8.0));
      float intensity = (n1 * 0.7 + n2 * 0.3);
      
      vec3 color = colorOuter;
      if (dist < 4.0) {
        float t = (dist - 2.0) / 2.0;
        color = mix(colorCore, colorMid, t);
      } else {
        float t = (dist - 4.0) / 6.0;
        color = mix(colorMid, colorOuter, t);
      }
      
      float alpha = 1.0;
      if (dist > 7.0) alpha = 1.0 - (dist - 7.0) / 3.0;
      if (dist < 2.2) alpha = smoothstep(2.0, 2.2, dist);

      float rings = sin(dist * 15.0 - time * 5.0) * 0.5 + 0.5;
      alpha *= (intensity * 0.6 + rings * 0.4);

      // Boost brightness for bloom
      color *= 1.5;

      gl_FragColor = vec4(color, alpha * 0.8);
    }
  `
});

const BlackHole = () => {
  const groupRef = useRef();
  
  useFrame((state) => {
    const p = scrollState.current;
    DiskMaterial.uniforms.time.value = state.clock.elapsedTime;
    DiskMaterial.uniforms.scrollDistortion.value = p;

    // Smooth mouse interpolation
    mouseState.targetX = THREE.MathUtils.lerp(mouseState.targetX, mouseState.x, 0.05);
    mouseState.targetY = THREE.MathUtils.lerp(mouseState.targetY, mouseState.y, 0.05);

    if (groupRef.current) {
      // Parallax & Scroll transforms
      const baseTiltX = Math.PI * 0.15 + (p * Math.PI * 0.35); // Tilts down as we scroll
      const baseTiltY = p * Math.PI * 0.2; // Rotates slightly
      
      groupRef.current.rotation.x = baseTiltX + mouseState.targetY * 0.1;
      groupRef.current.rotation.y = baseTiltY + mouseState.targetX * 0.1;
      
      // Moving closer
      groupRef.current.position.y = p * 4.0;
      groupRef.current.position.z = p * 5.0; // Moves towards camera
      groupRef.current.position.x = mouseState.targetX * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Event Horizon */}
      <Sphere args={[2, 64, 64]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* Photon Ring Glow */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.15, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Accretion Disk */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 10.0, 128]} />
        <primitive object={DiskMaterial} attach="material" />
      </mesh>
    </group>
  );
};

const ParticleField = () => {
  const pointsRef = useRef();
  const count = 5000;
  
  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const scl = new Float32Array(count);
    for(let i=0; i<count; i++) {
      const r = 10 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
      scl[i] = Math.random();
    }
    return [pos, scl];
  }, [count]);

  useFrame((state) => {
    const p = scrollState.current;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02 + p;
      pointsRef.current.rotation.x = p * 0.5;
      pointsRef.current.position.z = p * 20; // Warp speed effect
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aScale" count={count} array={scales} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aScale;
          varying float vAlpha;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (20.0 / -mvPosition.z) * aScale;
            gl_Position = projectionMatrix * mvPosition;
            vAlpha = aScale;
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            gl_FragColor = vec4(0.0, 0.95, 1.0, (0.5 - d) * 2.0 * vAlpha);
          }
        `}
      />
    </points>
  );
};

const CameraRig = () => {
  const { camera } = useThree();
  useFrame(() => {
    const p = scrollState.current;
    // Dramatic FOV shift and dolly in
    camera.fov = THREE.MathUtils.lerp(40, 75, p);
    camera.position.z = THREE.MathUtils.lerp(18, 5, p);
    camera.updateProjectionMatrix();
  });
  return null;
};

const Scene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 18], fov: 40 }} gl={{ antialias: false, powerPreference: "high-performance" }}>
      <color attach="background" args={['#010204']} />
      <fog attach="fog" args={['#010204', 10, 40]} />
      
      <CameraRig />
      <ambientLight intensity={0.2} />
      
      <Suspense fallback={null}>
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
          <BlackHole />
        </Float>
        <ParticleField />
        <Stars radius={100} depth={50} count={7000} factor={6} saturation={1} fade speed={1} />
        <Sparkles count={1000} scale={20} size={2} speed={0.4} opacity={0.1} color="#00f3ff" />
      </Suspense>

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.002, 0.002]} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Noise opacity={0.03} />
      </EffectComposer>
    </Canvas>
  );
};

// --- HTML OVERLAY UI ---

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      smoothTouch: true,
      touchMultiplier: 2
    });

    lenis.on('scroll', (e) => {
      scrollState.current = e.progress;
    });

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    const handleMouseMove = (e) => {
      mouseState.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseState.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      lenis.destroy();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (username.trim().length === 5) {
      setIsLoggingIn(true);
      setTimeout(() => {
        onLogin(username.toUpperCase(), 'Global');
      }, 1500);
    } else {
      alert("Username must be exactly 5 characters for Orbit synchronization.");
    }
  };

  const revealUp = {
    hidden: { opacity: 0, y: 50, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="login-experience-wrapper">
      <div className="canvas-container">
        <Scene />
      </div>

      <div className="scroll-overlay">
        <div className="scroll-content">
          
          {/* SECTION 1: HERO */}
          <section className="cinematic-section">
            <motion.div 
              className="section-inner center-align final-section"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-20%" }}
              variants={revealUp}
            >
              <h1 className="hero-title">ORBIT</h1>
              <p className="hero-subtitle">Realtime Human Presence Network.<br/>Synchronize your physical reality.</p>
              
              <div className="scroll-indicator">
                <div className="scroll-mouse">
                  <div className="scroll-wheel"></div>
                </div>
                <span className="scroll-text">INITIATE DESCENT</span>
              </div>
            </motion.div>
          </section>

          {/* SECTION 2: FEATURES */}
          <section className="cinematic-section">
            <motion.div 
              className="section-inner left-align"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-20%" }}
              variants={revealUp}
            >
              <h2 className="feature-text">
                Space is <span className="highlight">vast.</span><br/>
                Connection is <span className="highlight">instant.</span>
              </h2>
              <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Network size={32} color="#00f3ff" />
                  <span style={{ fontSize: '1.2rem', letterSpacing: '0.1em' }}>LIVE TOPOLOGY</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MapPin size={32} color="#00f3ff" />
                  <span style={{ fontSize: '1.2rem', letterSpacing: '0.1em' }}>GEO-SYNC</span>
                </div>
              </div>
            </motion.div>
          </section>

          {/* SECTION 3: LOGIN PANEL */}
          <section className="cinematic-section" style={{ pointerEvents: 'none' }}>
            {/* We set pointerEvents: none on section to let background be clickable if needed, 
                then re-enable it on the panel */}
            <motion.div 
              className="section-inner center-align"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-20%" }}
              variants={revealUp}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="glass-panel login-form-container">
                <div className="login-header">
                  <h2>TERMINAL ACCESS</h2>
                  <p>Authenticate to enter the network.</p>
                </div>

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="input-group">
                    <label>Identification (5 Chars)</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase())}
                      placeholder="e.g. ALPHA"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Encryption Key</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <label className="checkbox-wrapper">
                      <input type="checkbox" style={{ width: 'auto' }} />
                      <span>Remember Origin</span>
                    </label>
                    <a href="#" className="forgot-link">Lost Signal?</a>
                  </div>

                  <button 
                    type="submit" 
                    className={`login-btn ${isLoggingIn ? 'logging-in' : ''}`}
                    disabled={isLoggingIn || username.length !== 5 || !password}
                  >
                    {isLoggingIn ? (
                      <>
                        <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                        SYNCHRONIZING...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={18} />
                        ENTER ORBIT
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </section>

        </div>
      </div>

      <div className={`warp-transition ${isLoggingIn ? 'active' : ''}`}>
        <div className="warp-text">WARP ENGAGED</div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default Login;
