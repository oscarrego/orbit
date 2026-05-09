import React, { useEffect, useRef } from 'react';

const NumericSphereBackground = ({ onAbsorb }) => {
  const canvasRef = useRef(null);
  const sphereParticles = useRef([]);
  const vacuumParticles = useRef([]);
  const coreEnergy = useRef(0);
  const rotation = useRef({ x: 0, y: 0 });
  
  
  // Cinematic Loop State Machine
  const phaseRef = useRef('WAIT');
  const timerRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const SPHERE_COUNT = 400;
    const PERSPECTIVE = 450;
    const MAX_PARTICLES = 100;

    const getLogicalWidth = () => canvas.clientWidth || 300;
    const getLogicalHeight = () => canvas.clientHeight || 150;
    const getDynamicRadius = () => Math.min(getLogicalWidth(), getLogicalHeight()) * 0.35;

    const initSphere = () => {
      sphereParticles.current = [];
      const radius = getDynamicRadius();
      
      for (let i = 0; i < SPHERE_COUNT; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / SPHERE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        sphereParticles.current.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          value: Math.floor(Math.random() * 10).toString()
        });
      }
    };

    const spawnParticle = (centerX, centerY, sphereRadius) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = sphereRadius + (40 + Math.random() * 40);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0.3 + Math.random() * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        opacity: 0,
        size: 1.5 + Math.random() * 1.5
      };
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      
      initSphere();
      vacuumParticles.current = [];
      phaseRef.current = 'WAIT';
      timerRef.current = 0;
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      const now = performance.now();
      const rawDt = now - lastTimeRef.current;
      const dt = Math.min(rawDt, 50);
      const timeScale = dt / (1000 / 60); // Normalize to 60fps
      lastTimeRef.current = now;

      const width = getLogicalWidth();
      const height = getLogicalHeight();
      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = getDynamicRadius();

      // --- PHASE LOGIC ---
      if (phaseRef.current === 'WAIT') {
        timerRef.current += dt;
        if (timerRef.current >= 300) {
          phaseRef.current = 'SPAWN';
          timerRef.current = 0;
        }
      } else if (phaseRef.current === 'SPAWN') {
        vacuumParticles.current = [];
        const particleCount = width < 768 ? 40 : MAX_PARTICLES;
        for (let i = 0; i < particleCount; i++) {
          vacuumParticles.current.push(spawnParticle(centerX, centerY, radius));
        }
        coreEnergy.current = 0;
        phaseRef.current = 'FLOW';
        timerRef.current = 0;
      } 
      else if (phaseRef.current === 'FLOW') {
        timerRef.current += dt;
        if (timerRef.current > 3500) {
          phaseRef.current = 'CORE_ANIMATION';
          timerRef.current = 0;
        }
      } else if (phaseRef.current === 'CORE_ANIMATION') {
        timerRef.current += dt;
        if (timerRef.current >= 700) {
          phaseRef.current = 'WAIT';
          timerRef.current = 0;
          coreEnergy.current = 0;
        }
      }

      // 1. RENDER BACKGROUND PARTICLES
      if (phaseRef.current === 'FLOW') {
        for (let i = vacuumParticles.current.length - 1; i >= 0; i--) {
          const p = vacuumParticles.current[i];
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 8) {
            vacuumParticles.current.splice(i, 1);
            coreEnergy.current += 1;
            continue;
          }

          const nx = dx / dist;
          const ny = dy / dist;
          let pull = 0.05 + Math.max(0, 1 - dist / (radius + 80)) * 0.75; 
          
          p.vx += nx * pull * timeScale;
          p.vy += ny * pull * timeScale;
          p.vx += -ny * 0.05 * timeScale;
          p.vy += nx * 0.05 * timeScale;
          
          const damping = Math.pow(0.98, timeScale);
          p.vx *= damping;
          p.vy *= damping;
          
          p.x += p.vx * timeScale * 1.3;
          p.y += p.vy * timeScale * 1.3;

          let normDist = Math.min(dist / (radius + 80), 1);
          const targetOpacity = 0.1 + (1 - normDist) * 0.5;
          p.opacity += (targetOpacity - p.opacity) * (0.1 * timeScale);

          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- SPHERE ROTATION ---
      // Achieve a smooth, continuous diagonal rotation (bottom-right to top-left flow)
      rotation.current.angle = (rotation.current.angle || 0) - (0.010 * timeScale);
      const t = rotation.current.angle;

      // 1. Continuous spin around Y axis
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      
      // 2. Fixed tilt around Z axis to make the rotation diagonal (45 degrees)
      const tiltZ = Math.PI / 4; 
      const cosZ = Math.cos(tiltZ);
      const sinZ = Math.sin(tiltZ);

      // 3. Fixed tilt around X axis for 3D perspective (tilts pole slightly toward viewer)
      const tiltX = -Math.PI / 8;
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);

      const projected = sphereParticles.current.map(p => {
        // Step 1: Spin around Y
        const x1 = p.x * cosT - p.z * sinT;
        const y1 = p.y;
        const z1 = p.x * sinT + p.z * cosT;

        // Step 2: Diagonal Tilt around Z
        const x2 = x1 * cosZ - y1 * sinZ;
        const y2 = x1 * sinZ + y1 * cosZ;
        const z2 = z1;

        // Step 3: Perspective Tilt around X
        const x3 = x2;
        const y3 = y2 * cosX - z2 * sinX;
        const z3 = y2 * sinX + z2 * cosX;

        // Apply 3D perspective projection
        const scale = PERSPECTIVE / (PERSPECTIVE + z3);
        const screenX = centerX + x3 * scale;
        const screenY = centerY + y3 * scale;
        
        return { ...p, screenX, screenY, zPrime: z3 };
      });

      projected.sort((a, b) => b.zPrime - a.zPrime);

      // 2. RENDER SPHERE NUMBERS
      projected.forEach(p => {
        let normalizedZ = (p.zPrime + radius) / (2 * radius);
        normalizedZ = Math.max(0, Math.min(1, normalizedZ));
        const opacity = 1 - (normalizedZ * 0.8);
        const size = 14 - (normalizedZ * 6);
        ctx.font = `${size}px monospace`;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.value, p.screenX, p.screenY);
      });

      // 3. RENDER OUTER CIRCLE
      const ringRadius = radius + 25;
      const ringGradient = ctx.createLinearGradient(centerX, centerY - ringRadius, centerX, centerY + ringRadius);
      // TOP (bright)
      ringGradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      // MID (soft)
      ringGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)");
      // BOTTOM (very dim)
      ringGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ringGradient;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 4. RENDER CORE (MATCHING SPHERE/PARTICLE SYSTEM)
      const timeSec = now * 0.001;
      
      const renderCore = (ctx, x, y, baseRadius, alpha) => {
        // Apply depth-based opacity (depthFactor = 1 for center)
        const depthOpacity = (0.6 + 0.4 * 1) * alpha;
        
        // Micro-pulse based on energy
        const pulsedRadius = baseRadius + (coreEnergy.current * 0.02);
        
        // Subtle jitter to remove "UI sharpness"
        const jitter = Math.sin(timeSec * 4) * 0.5;
        const finalRadius = Math.max(0, pulsedRadius + jitter);

        ctx.save();
        ctx.globalAlpha = depthOpacity;
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Layer 1: Outer Density Layer (Slightly dim)
       

        // Layer 2: Inner Compressed Core
        ctx.beginPath();
        ctx.globalAlpha = depthOpacity;
        ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
        ctx.fill();

        // Crisp definition stroke
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${depthOpacity * 0.8})`;
        ctx.stroke();
        
        ctx.restore();
      };

      // ONLY core animation (no small dot phase)
      if (phaseRef.current === 'CORE_ANIMATION') {
        const DURATION = 700;
        const progress = Math.min(1, timerRef.current / DURATION);

        let animRadius;

        // START immediately with big circle
        const collapseProgress = progress;
        const ease = Math.pow(1 - collapseProgress, 1.8);
        animRadius = 28 * ease;

        // keep tiny dot at end
        animRadius = Math.max(0.3, animRadius);

        // slightly softer opacity (optional)
        const animOpacity = 0.9;

        renderCore(ctx, centerX, centerY, animRadius, animOpacity);
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'transparent'
      }}
    />
  );
};

export default NumericSphereBackground;