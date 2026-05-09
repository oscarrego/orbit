import React, { useEffect, useRef, useState } from 'react';
import './OrbitEasterEgg.css';

const OrbitEasterEgg = ({ onComplete }) => {
  console.log("OrbitEasterEgg running (from OrbitEasterEgg.js)");
  const canvasRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let startTime = Date.now();

    // Resize canvas
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Particle System
    const particles = [];
    const particleCount = 120;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        // Spawn at edges or random if initial
        if (initial) {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
        } else {
          const edge = Math.floor(Math.random() * 4);
          if (edge === 0) { this.x = 0; this.y = Math.random() * canvas.height; }
          else if (edge === 1) { this.x = canvas.width; this.y = Math.random() * canvas.height; }
          else if (edge === 2) { this.x = Math.random() * canvas.width; this.y = 0; }
          else { this.x = Math.random() * canvas.width; this.y = canvas.height; }
        }

        this.size = Math.random() * 2 + 1;
        this.speed = Math.random() * 2 + 1;
        this.angle = Math.atan2(centerY - this.y, centerX - this.x);
        this.orbitRadius = Math.random() * 150 + 50;
        this.orbitSpeed = (Math.random() * 0.05 + 0.02) * (Math.random() > 0.5 ? 1 : -1);
        this.currentOrbitAngle = Math.random() * Math.PI * 2;
        this.state = 'inbound'; // inbound, orbit, absorb
        this.color = `hsla(${Math.random() * 20 + 40}, 100%, 60%, ${Math.random() * 0.5 + 0.5})`;
        this.history = [];
      }

      update(elapsed, exiting) {
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 10) this.history.shift();

        if (exiting) {
          // Collapse into center
          const dist = Math.hypot(centerX - this.x, centerY - this.y);
          this.x += (centerX - this.x) * 0.2;
          this.y += (centerY - this.y) * 0.2;
          return;
        }

        const distToCenter = Math.hypot(centerX - this.x, centerY - this.y);

        if (this.state === 'inbound') {
          this.x += Math.cos(this.angle) * this.speed * 5;
          this.y += Math.sin(this.angle) * this.speed * 5;
          if (distToCenter < this.orbitRadius + 20) this.state = 'orbit';
        } else if (this.state === 'orbit') {
          this.currentOrbitAngle += this.orbitSpeed;
          const targetX = centerX + Math.cos(this.currentOrbitAngle) * this.orbitRadius;
          const targetY = centerY + Math.sin(this.currentOrbitAngle) * this.orbitRadius;
          this.x += (targetX - this.x) * 0.1;
          this.y += (targetY - this.y) * 0.1;
          
          // Randomly transition to absorb after some time
          if (elapsed > 1000 && Math.random() < 0.01) this.state = 'absorb';
        } else if (this.state === 'absorb') {
          const angle = Math.atan2(centerY - this.y, centerX - this.x);
          this.x += Math.cos(angle) * this.speed * 8;
          this.y += Math.sin(angle) * this.speed * 8;
          if (distToCenter < 10) this.reset();
        }
      }

      draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        for (let i = this.history.length - 1; i >= 0; i--) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const exiting = elapsed > 2500;

      if (elapsed > 500 && !showText) setShowText(true);
      if (exiting && !isExiting) setIsExiting(true);

      // Trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'lighter';

      // Draw Core
      const pulse = 1 + Math.sin(elapsed * 0.005) * 0.1;
      const coreSize = (exiting ? 0 : 25) * pulse;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 3);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.2, '#ffcc00');
      gradient.addColorStop(0.5, '#ff9500');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // Flash on exit
      if (elapsed > 2450 && elapsed < 2550) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Update & Draw Particles
      particles.forEach(p => {
        p.update(elapsed, exiting);
        p.draw();
      });

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const completeTimer = setTimeout(() => onComplete(), 3000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`orbit-egg-overlay ${isExiting ? 'exit' : ''}`}>
      <div className="vignette"></div>
      <canvas ref={canvasRef} className="orbit-canvas" />
      <div className={`orbit-egg-text ${showText ? 'visible' : ''} ${isExiting ? 'exit' : ''}`}>
        Developed by OSCAR
      </div>
    </div>
  );
};

export default OrbitEasterEgg;
