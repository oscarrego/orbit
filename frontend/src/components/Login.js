import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Float, Sphere, Sparkles, Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import Lenis from 'lenis';
import { Aperture, Activity, ShieldAlert, Crosshair, Fingerprint, MapPin, RadioReceiver, Network, ScanSearch, Lock } from 'lucide-react';
import './Login.css';

// --- GLOBAL SCROLL STATE FOR 3D ---
const scrollState = { current: 0 };
const mouseState = { x: 0, y: 0 };
let emergencyBoost = 0;
let boosting = false;



// --- 3D COMPONENTS ---

// Custom shader for the accretion disk with noise and swirling energy
const DiskMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    colorCore: { value: new THREE.Color('#ffffff') },
    colorMid: { value: new THREE.Color('#aaaaaa') },
    colorOuter: { value: new THREE.Color('#222222') },
    isSOS: { value: 0.0 },
    emergencyIntensity: { value: 0.0 },
    sosColor: { value: new THREE.Color('#ff003c') }
  },
  transparent: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 colorCore;
    uniform vec3 colorMid;
    uniform vec3 colorOuter;
    uniform float isSOS;
    uniform float emergencyIntensity;
    uniform vec3 sosColor;
    varying vec2 vUv;
    varying vec3 vPos;

    // Simple 2D noise
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
      vec2 center = vec2(0.0, 0.0);
      vec2 pos = vPos.xy; // The disk is on XY plane before rotation, wait, ringGeometry is on XY.
      float dist = length(pos);
      
      if(dist < 2.0 || dist > 8.0) discard;

      // Swirling angles
      float angle = atan(pos.y, pos.x);
      
      // Dynamic noise
      float n = noise(vec2(angle * 4.0 - time * 2.0, dist * 3.0 - time));
      float n2 = noise(vec2(angle * 8.0 + time, dist * 6.0));
      
      float intensity = (n * 0.6 + n2 * 0.4);
      
      vec3 finalColor = colorOuter;
      if (dist < 4.0) {
        float t = (dist - 2.0) / 2.0; // 0 to 1
        finalColor = mix(colorCore, colorMid, t);
      } else {
        float t = (dist - 4.0) / 4.0; // 0 to 1
        finalColor = mix(colorMid, colorOuter, t);
      }
      
      // Fade edges
      float alpha = 1.0;
      if (dist > 6.0) alpha = 1.0 - (dist - 6.0) / 2.0;
      if (dist < 2.1) alpha = (dist - 2.0) / 0.1;

      // Rings and bands
      float rings = sin(dist * 10.0 - time * 4.0) * 0.5 + 0.5;
      
      // Combine
      alpha *= (intensity * 0.5 + rings * 0.5) * 0.8;

      // SOS Overrides
     finalColor = mix(
  finalColor,
  sosColor,
  (isSOS * 0.4) + (emergencyIntensity * 0.9)
);
      alpha = mix(
  alpha,
  alpha * (1.5 + emergencyIntensity * 1.2),
  isSOS
);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
});

const AccretionParticles = () => {
  const particlesRef = useRef();
  const count = 12000;
  
  const [positions, phases, speeds, radii, offsets] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    const sp = new Float32Array(count);
    const rad = new Float32Array(count);
    const off = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Concentrate near center, spread out further
      const radius = 2.05 + Math.pow(Math.random(), 2) * 8.0; 
      const theta = Math.random() * Math.PI * 2;
      
      // Y distortion creates the "thickness" of the disk, pinched at the center
      const yDistortion = (Math.random() - 0.5) * (0.05 + Math.pow((radius - 2.05) * 0.2, 1.5)); 
      
      pos[i * 3] = radius * Math.cos(theta);
      pos[i * 3 + 1] = yDistortion;
      pos[i * 3 + 2] = radius * Math.sin(theta);
      
      ph[i] = Math.random() * Math.PI * 2;
      // Closer particles move much faster
      sp[i] = (25.0 / (radius * radius)) * (0.8 + Math.random() * 0.4);
      rad[i] = radius;
      off[i] = Math.random();
    }
    return [pos, ph, sp, rad, off];
  }, []);

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    scrollPos: { value: 0 },
    colorCore: { value: new THREE.Color('#ffffff') }, 
    colorMid: { value: new THREE.Color('#bbbbbb') },  
    colorOuter: { value: new THREE.Color('#222222') },
    colorSOS: { value: new THREE.Color('#ff003c') },  
    isSOS: { value: 0.0 }, 
  }), []);

  useFrame((state) => {
    const p = scrollState.current;
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.scrollPos.value = p;
    
    // Add rotation offset to whole system based on scroll for dramatic spin
    if (particlesRef.current) {
      particlesRef.current.rotation.y = -state.clock.elapsedTime * 0.05 - (p * Math.PI * 2);
      // Slight wobble
      particlesRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }

    const isSOS = p >= 0.6 && p < 0.8;
    uniforms.isSOS.value = THREE.MathUtils.lerp(uniforms.isSOS.value, isSOS ? 1.0 : 0.0, 0.05);
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={count} array={speeds} itemSize={1} />
        <bufferAttribute attach="attributes-radius" count={count} array={radii} itemSize={1} />
        <bufferAttribute attach="attributes-offset" count={count} array={offsets} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial 
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float phase;
          attribute float speed;
          attribute float radius;
          attribute float offset;
          varying float vAlpha;
          varying float vRadius;
          uniform float time;
          uniform float scrollPos;
          uniform float isSOS;
          
          void main() {
            // Speed up everything as you scroll down
            float currentSpeed = speed * (1.0 + scrollPos * 2.0);
            float angle = time * currentSpeed + phase;
            
            vec3 pos = position;
            
            // Warp effect: bend Z and Y based on scroll and radius
            float warp = scrollPos * (10.0 / radius);
            
            pos.x = radius * cos(angle);
            pos.z = radius * sin(angle);
            
            // SOS turbulence
            if (isSOS > 0.0) {
                pos.y += sin(angle * 10.0 + time * 10.0) * isSOS * 0.2 * (radius * 0.1);
            }

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Size scaling based on perspective and distance
            float size = (30.0 / -mvPosition.z) * (1.0 / (radius * 0.2));
            // Add pulse
            size *= 1.0 + 0.3 * sin(time * 5.0 + phase);
            gl_PointSize = clamp(size, 1.0, 8.0);
            
            vAlpha = 0.4 + 0.6 * sin(time * currentSpeed * 2.0 + offset * 10.0);
            vRadius = radius;
          }
        `}
        fragmentShader={`
          uniform vec3 colorCore;
          uniform vec3 colorMid;
          uniform vec3 colorOuter;
          uniform vec3 colorSOS;
          uniform float isSOS;
          varying float vAlpha;
          varying float vRadius;
          void main() {
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            if (ll > 0.5) discard;
            
            vec3 color = colorOuter;
            if (vRadius < 4.0) {
               float t = (vRadius - 2.05) / (4.0 - 2.05);
               color = mix(colorCore, colorMid, t);
            } else {
               float t = (vRadius - 4.0) / (10.0 - 4.0);
               color = mix(colorMid, colorOuter, t);
            }

            // Highlight
            if (vRadius < 2.5) {
               color = mix(color, vec3(1.0, 0.95, 0.9), 0.4); 
            }

            // SOS override
            color = mix(color, colorSOS, isSOS * 0.8);
            
            // Fade out
            float edgeFade = 1.0 - smoothstep(7.0, 10.0, vRadius);

            gl_FragColor = vec4(color, vAlpha * edgeFade * pow(1.0 - (ll * 2.0), 2.5));
          }
        `}
      />
    </points>
  );
};

// Orbiting Cinematic Debris
const CinematicDebris = () => {
  const count = 150;
  const meshRef = useRef();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const debrisData = useMemo(() => {
    return new Array(count).fill().map(() => {
      const radius = 5.0 + Math.random() * 15.0;
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 / radius) * (Math.random() > 0.5 ? 1 : -1);
      const yOffset = (Math.random() - 0.5) * 4.0;
      const scale = 0.02 + Math.random() * 0.08;
      const rotSpeed = [Math.random() * 0.02, Math.random() * 0.02, Math.random() * 0.02];
      return { radius, angle, speed, yOffset, scale, rotSpeed, currentRot: [0,0,0] };
    });
  }, [count]);

  useFrame((state) => {
    const p = scrollState.current;
    
    debrisData.forEach((d, i) => {
      d.angle += d.speed * state.delta * (1.0 + p * 2.0); // speeds up on scroll
      d.currentRot[0] += d.rotSpeed[0];
      d.currentRot[1] += d.rotSpeed[1];
      d.currentRot[2] += d.rotSpeed[2];

      const x = d.radius * Math.cos(d.angle);
      const z = d.radius * Math.sin(d.angle);
      // Pulled inward slightly based on scroll
      const pull = p * (d.radius * 0.3);

      dummy.position.set(x * (1 - pull/d.radius), d.yOffset, z * (1 - pull/d.radius));
      dummy.rotation.set(...d.currentRot);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#444444" roughness={0.8} metalness={0.2} />
    </instancedMesh>
  );
};

// Atmospheric Gas Volumetrics
const AtmosphericGas = () => {
  const gasRef = useRef();

  useFrame((state, delta) => {
    if (gasRef.current) {
      gasRef.current.rotation.y += delta * 0.05;
      gasRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <group ref={gasRef}>
      <Sphere args={[2.5, 32, 32]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.02} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </Sphere>
      <Sphere args={[4.0, 32, 32]}>
        <meshBasicMaterial color="#aaaaaa" transparent opacity={0.01} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </Sphere>
      <Sphere args={[6.0, 32, 32]}>
        <meshBasicMaterial color="#333333" transparent opacity={0.005} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </Sphere>
    </group>
  );
}

const BlackHole = () => {
  const bhRef = useRef();

  useFrame((state) => {
    const p = scrollState.current;
    
    // Apply shader time
    DiskMaterial.uniforms.time.value = state.clock.elapsedTime;
    const isSOS = p >= 0.6 && p < 0.8;
    DiskMaterial.uniforms.isSOS.value = THREE.MathUtils.lerp(DiskMaterial.uniforms.isSOS.value, isSOS ? 1.0 : 0.0, 0.05);
    DiskMaterial.uniforms.emergencyIntensity.value =
  THREE.MathUtils.lerp(
    DiskMaterial.uniforms.emergencyIntensity.value,
    emergencyBoost,
    0.05
  );

    // Black Hole Object transforms
    let targetX = 0, targetY = 0, targetTiltX = 0, targetTiltY = 0;

    // Drift based on mouse
    const mouseDriftX = mouseState.x * 1.2;
const mouseDriftY = mouseState.y * 0.8;

    if (p < 0.2) {
      // Sec 1: Distant black hole
      targetX = 0; targetY = 0.5; targetTiltX = Math.PI * 0.15; targetTiltY = Math.PI * 0.1;
    } else if (p >= 0.2 && p < 0.4) {
      // Sec 2: Presence - Shifts Left
      targetX = -3.5; targetY = 0; targetTiltX = Math.PI * 0.2; targetTiltY = Math.PI * 0.15;
    } else if (p >= 0.4 && p < 0.6) {
      // Sec 3: Gravitational field - Shifts Right, steep angle
      targetX = 3.5; targetY = 0; targetTiltX = Math.PI * 0.25; targetTiltY = -Math.PI * 0.15;
    } else if (p >= 0.6 && p < 0.8) {
      // Sec 4: SOS pulses - Center, intense angle
      targetX = 0; targetY = 0; targetTiltX = Math.PI * 0.35; targetTiltY = 0;
    } else {
      // Sec 5: Terminal - Directly underneath / overhead
      targetX = 0; targetY = 2.0; targetTiltX = Math.PI * 0.45; targetTiltY = 0;
    }

   if (bhRef.current) {

  bhRef.current.position.x = THREE.MathUtils.lerp(
    bhRef.current.position.x,
    targetX + mouseDriftX,
    0.02
  );

  bhRef.current.position.y = THREE.MathUtils.lerp(
    bhRef.current.position.y,
    targetY + mouseDriftY,
    0.02
  );

  bhRef.current.rotation.x = THREE.MathUtils.lerp(
    bhRef.current.rotation.x,
    targetTiltX,
    0.02
  );

  bhRef.current.rotation.y = THREE.MathUtils.lerp(
    bhRef.current.rotation.y,
    targetTiltY,
    0.02
  );

  const pulse =
    1 +
    Math.sin(state.clock.elapsedTime * 8) *
    emergencyBoost *
    0.08;

  bhRef.current.scale.set(pulse, pulse, pulse);
}
  });

  return (
   <group
  ref={bhRef}
  scale={1 + emergencyBoost * 0.15}
>
      {/* Event Horizon */}
      <Sphere args={[2, 64, 64]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* Deep Singularity glow inside */}
      <Sphere args={[1.9, 32, 32]}>
         <meshBasicMaterial color="#000000" depthTest={false} />
      </Sphere>
      
      {/* Photon Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.05, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Animated Accretion Disk Base */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 8.0, 128]} />
        <primitive object={DiskMaterial} attach="material" />
      </mesh>

      <AtmosphericGas />
      <AccretionParticles />
      <CinematicDebris />
    </group>
  );
};

// Camera Controller to manage FOV and "Descent" Z-depth based on scroll
const CameraController = () => {
  const { camera } = useThree();

  useFrame(() => {
    const p = scrollState.current;
    
    // Z descent: start at 14, end at 4 (very close)
const targetZ =
  16 -
  (p * 12) -
  (emergencyBoost * 8 )  // FOV shift: start narrow, get wide as we approach for distorted warp effect
    const targetFOV = 40 + (p * 30);

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.03);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 0.03);
    camera.updateProjectionMatrix();

    // Subtle camera shake on SOS
  if (p >= 0.6 && p < 0.8) {
const targetBoost = boosting ? 0.5 : 0;
 emergencyBoost = THREE.MathUtils.lerp(
  emergencyBoost,
  targetBoost,
   0.004
);

  const intensity =
    0.015 + (emergencyBoost * 0.45)

  camera.position.x =
    (Math.random() - 0.5) * intensity;

  camera.position.y =
    (Math.random() - 0.5) * intensity;

} else {

  boosting = false;

  emergencyBoost = THREE.MathUtils.lerp(
    emergencyBoost,
    0,
    0.08
  );

  camera.position.x = THREE.MathUtils.lerp(
    camera.position.x,
    0,
    0.1
  );

  camera.position.y = THREE.MathUtils.lerp(
    camera.position.y,
    0,
    0.1
  );
}
  });
  return null;
};

const BackgroundScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 16], fov: 40 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 5, 30]} />
      <CameraController />
      
      {/* Lighting for debris */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2.0} distance={20} color="#ffffff" />
      
      {/* Background Starfield Warp */}
      <group>
        <Stars radius={200} depth={100} count={8000} factor={5} saturation={0} fade speed={0.5} />
        {/* Layer of brighter cinematic dust */}
        <Sparkles count={2000} scale={30} size={1.5} speed={0.2} opacity={0.15} color="#ffffff" />
      </group>

      <Float speed={0.5} rotationIntensity={0.01} floatIntensity={0.02}>
        <BlackHole />
      </Float>
    </Canvas>
  );
};

// --- REACT HTML SCROLL CONTENT ---

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(12);
const [latency, setLatency] = useState(8);


useEffect(() => {

  const usersInterval = setInterval(() => {
    setOnlineUsers(Math.floor(Math.random() * 17) + 8);
  }, 1800);

  const latencyInterval = setInterval(() => {
    setLatency(Math.floor(Math.random() * 16) + 5);
  }, 500);

  return () => {
    clearInterval(usersInterval);
    clearInterval(latencyInterval);
  };

}, []);

  // Setup Lenis for Genuine Smooth Scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.5, // Smoother, heavier feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      smoothTouch: true, // Enables smooth scrolling on touch devices
      touchMultiplier: 1.5, // Improves mobile inertia
      wheelMultiplier: 0.8, // Slightly heavier scroll
    });

    lenis.on('scroll', (e) => {
      scrollState.current = e.progress; // Directly provides 0 to 1 over the document
    });

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Mouse tracker for parallax
    const handleMouseMove = (e) => {
      mouseState.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseState.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleOrientation = (e) => {

  const tiltX = e.gamma || 0;
  const tiltY = e.beta || 0;

  mouseState.x = tiltX / 45;
  mouseState.y = -tiltY / 90;

};

if (
  typeof DeviceOrientationEvent !== 'undefined'
) {

  window.addEventListener(
    'deviceorientation',
    handleOrientation
  );

}

    return () => {
      lenis.destroy();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener(
  'deviceorientation',
  handleOrientation
);
    };
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    setUsername(val);
  };

  const handleEnterClick = () => {
    if (username.length === 5) {
      onLogin(username, 'Global');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && username.length === 5) {
      handleEnterClick();
    }
  };

  // Animation variants for scroll reveals
  const revealUp = {
  hidden: { opacity: 0, y: 30, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

  const revealStagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.4 } }
  };

  return (
    <div className="orbit-login-wrapper">
      
      {/* 3D Background - Fixed in place */}
      <div className="canvas-container">
        <BackgroundScene />
      </div>

      {/* Genuine Scrolling Document */}
      <div className="scroll-content">
        
        {/* SECTION 1: HERO */}
        <section className="cinematic-section hero-section">
          <motion.div 
            className="section-inner center-align"
            variants={revealStagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-10%" }}
          >
            <motion.div variants={revealUp} className="badge-glow">
              <Aperture size={12} className="inline-icon" />
              <span>LIVE NETWORK SYNCHRONIZATION</span>
            </motion.div>
            <motion.h1 variants={revealUp} className="hero-title">REALTIME <span className="bold-text">ORBIT</span><br/>NETWORK</motion.h1>
            <motion.p variants={revealUp} className="hero-subtitle">A live network of synchronized human presence.
              <br></br> Discover, connect, and respond in realtime. </motion.p>
            
            <motion.div variants={revealUp} className="scroll-indicator">
              <div className="scroll-mouse">
                <div className="scroll-wheel"></div>
              </div>
              <span className="scroll-text">SCROLL TO EXPLORE</span>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 2: HUMAN PRESENCE */}
        <section className="cinematic-section presence-section">
          <motion.div 
            className="section-inner right-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "5%" }}
          >
            <div className="glass-panel">
              <div className="panel-glow-effect"></div>
              <div className="icon-wrapper">
                <Network size={24} />
              </div>
              <h2 className="section-title">LIVE LOCATION<br/>AWARENESS</h2>
              <p className="section-desc">Every movement updates the network.
              <br></br>Orbit visualizes nearby activity as it happens.</p>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <ScanSearch size={16} className="stat-icon" />
                  <span className="stat-val">ACTIVE</span>
                 <span className="stat-label">{onlineUsers} ONLINE</span>
                </div>
                <div className="stat-card">
                  <Activity size={16} className="stat-icon" />
                  <span className="stat-val">LIVE</span>
                  <span className="stat-label">{latency}ms LATENCY</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 3: PRIVATE ROOMS */}
        <section className="cinematic-section nearby-section">
          <motion.div 
            className="section-inner left-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "5%" }}
          >
            <div className="glass-panel">
              <div className="panel-glow-effect"></div>
              <div className="icon-wrapper">
                <Lock size={24} />
              </div>
              <h2 className="section-title">SECURE PRIVATE ROOMS</h2>
              <p className="section-desc">Encrypted room-based communication built for synchronized teams,
                  private coordination, and live collaboration.</p>
            </div>
          </motion.div>
        </section>

        {/* SECTION 4: SOS EMERGENCY */}
        <section className="cinematic-section sos-section">
          <motion.div 
            className="section-inner center-align"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "5%" }}
          >
            <div className="glass-panel massive-panel">
              <div className="panel-glow-effect"></div>
<div className="icon-wrapper large-icon sos-icon">
                <ShieldAlert size={32} />
              </div>
              <h2 className="section-title text-center">WHEN A SIGNAL IS SENT,NEARBY USERS RESPOND</h2>
              <p className="section-desc text-center" style={{ maxWidth: '600px', margin: '0 auto 40px auto' }}>Orbit instantly broadcasts emergency signals to nearby connected
users using live location synchronization and realtime alerts.</p>
              
<div
  className="alert-bar"
  style={{
   
    
  }}

  onMouseDown={() => {
    boosting = true;
  }}

  onMouseUp={() => {
    boosting = false;
  }}

  onMouseLeave={() => {
    boosting = false;
  }}

  onTouchStart={() => {
    boosting = true;
  }}

  onTouchEnd={() => {
    boosting = false;
  }}
>
                <div className="alert-pulse"></div>
                <span>HOLD TO AMPLIFY</span>
                <div className="pressure-bar">
  <div
    className="pressure-fill"
    style={{
      width: `${emergencyBoost * 200}%`
    }}
  />
</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 5: ENTER ORBIT (TERMINAL) */}
        <section className="cinematic-section enter-section">
          <motion.div 
            className="section-inner center-align final-section"
            variants={revealUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-10%" }}
          >
            <h2 className="hero-title final-title" style={{ marginBottom: '80px' }}>ENTER <span className="text-gradient-white">ORBIT</span></h2>
            
            <div className="singularity-terminal">
              <div className="terminal-header">
                <Crosshair size={20} className="scanner-icon" />
                <span>IDENTITY SYNCHRONIZATION</span>
              </div>
              
              <div className={`input-wrapper ${isFocused ? 'focused' : ''} ${username.length === 5 ? 'ready' : ''}`}>
                <div className="input-bracket left">[</div>
                <input
                  type="text"
                  value={username}
                  onChange={handleInputChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="USERNAME"
                  className="terminal-input"
                  spellCheck="false"
                  autoComplete="off"
                />
                <div className="input-bracket right">]</div>
              </div>

              <div className="terminal-status">
                {username.length < 5 ? (
                  <span className="status-text blink">AWAITING IDENTIFICATION... {username.length}/5</span>
                ) : (
                  <span className="status-text success">IDENTITY CONFIRMED</span>
                )}
              </div>

              <div className="action-container">
                <button 
                  className={`sync-btn ${username.length === 5 ? 'active' : ''}`}
                  disabled={username.length !== 5}
                  onClick={handleEnterClick}
                >
                  <Fingerprint size={16} className="btn-icon" />
                  <span>CONNECT TO NETWORK</span>
                </button>
                <div className="encryption-notice">
                  <RadioReceiver size={12} />
                  <span>Developed by OSCAR</span>
                </div>
              </div>
            </div>
            
          </motion.div>
        </section>

      </div>
    </div>
  );
};

export default Login;
