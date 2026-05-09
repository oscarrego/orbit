import React, { useEffect, useRef } from 'react';

const WarpTunnel = ({ isWarping }) => {
  const canvasRef = useRef(null);
  const baseParticles = useRef([]);
  const warpParticles = useRef([]);
  const animationFrameId = useRef(null);
  const warpFactor = useRef(1);
  const colors = ['#cbd5ff', '#e0e7ff', '#a5b4fc'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initParticles = () => {
      // 1. BASE LAYER (Far stars)
      baseParticles.current = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 0.8 + 0.2,
        opacity: Math.random() * 0.3 + 0.1,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));

      // 2. WARP LAYER (Outward motion)
      warpParticles.current = Array.from({ length: 250 }, () => createWarpParticle(canvas));
    };

    const createWarpParticle = (canvas) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Spawn near center with randomness
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 50; // Initial spawn radius
      
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        speed: Math.random() * 2 + 1,
        accel: 1.02 + Math.random() * 0.02,
        size: 0.1,
        opacity: 0,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Handle Warp Factor transition for button click
      if (isWarping) {
        warpFactor.current += (3 - warpFactor.current) * 0.15;
      } else {
        warpFactor.current += (1 - warpFactor.current) * 0.05;
      }

      // 1. Draw Base Layer (Subtle stars)
      baseParticles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Draw Warp Layer (Outward motion)
      warpParticles.current.forEach((p, i) => {
        // Apply velocity and acceleration
        const currentSpeed = p.speed * warpFactor.current;
        p.x += p.vx * currentSpeed;
        p.y += p.vy * currentSpeed;
        p.speed *= p.accel; // Accelerate as they move out

        // Perspective effects
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Size increases with distance from center
        p.size = 0.5 + (dist / canvas.width) * 3;
        
        // Opacity: Fade in near center, stay visible, then potentially fade out at edges
        p.opacity = Math.min(dist / 100, 0.8);

        // Streak Effect (Motion Blur)
        if (dist > 50) {
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.8;
          ctx.lineCap = 'round';
          ctx.globalAlpha = p.opacity * 0.5;
          
          // Warp intensity increases streak length
          const streakLen = (dist / 10) * (isWarping ? 2.5 : 1);
          
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          // Trail points back to center
          ctx.lineTo(p.x - p.vx * streakLen, p.y - p.vy * streakLen);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Respawn if off screen
        if (p.x < -100 || p.x > canvas.width + 100 || p.y < -100 || p.y > canvas.height + 100) {
          warpParticles.current[i] = createWarpParticle(canvas);
        }
      });

      ctx.globalAlpha = 1;
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isWarping]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at center, #0d0d1f 0%, #020205 100%)'
      }}
    />
  );
};

export default WarpTunnel;
