import React, { useEffect, useRef, useState } from "react";
import "./OrbitEasterEgg.css";

const DURATION_MS = 3200;
const EXIT_START_MS = 2550;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const easeInOutCubic = (value) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const buildParticles = (count) =>
  Array.from({ length: count }, (_, index) => {
    const lane = index % 9;
    return {
      angle: (index / count) * TAU * 2.35 + lane * 0.37,
      radius: 0.34 + ((index * 17) % 100) / 100,
      depth: 0.42 + ((index * 29) % 100) / 140,
      speed: 0.34 + lane * 0.026,
      phase: ((index * 41) % 100) / 100,
      lane,
    };
  });

const OrbitEasterEgg = ({ onComplete }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { alpha: true });
    let animationFrameId = 0;
    let completeTimer = 0;
    let startTime = performance.now();
    let pixelRatio = 1;
    let width = 0;
    let height = 0;
    let compact = false;
    let closingSet = false;

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      compact = width <= 720;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = false;
      particlesRef.current = buildParticles(compact ? 118 : 176);
    };

    const drawPixelRect = (x, y, size, alpha, shade = 245) => {
      const cell = compact ? 3 : 4;
      const px = Math.round(x / cell) * cell;
      const py = Math.round(y / cell) * cell;
      const block = Math.max(cell, Math.round(size / cell) * cell);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
      context.fillRect(px, py, block, block);
    };

    const drawSegmentedRing = (cx, cy, radius, thickness, alpha, time, spin, segments) => {
      const cell = compact ? 3 : 4;
      for (let index = 0; index < segments; index += 1) {
        const gate = Math.sin(index * 1.9 + time * 1.7 + radius * 0.05);
        if (gate < -0.36) continue;
        const angle = (index / segments) * TAU + time * spin;
        const ellipse = compact ? 0.58 : 0.52;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * ellipse;
        const block = cell * (1 + (index % 3));
        const localAlpha = alpha * (0.52 + Math.max(0, gate) * 0.48);
        context.fillStyle = `rgba(238, 240, 242, ${localAlpha})`;
        context.fillRect(
          Math.round(x / cell) * cell,
          Math.round(y / cell) * cell,
          block + thickness,
          cell
        );
      }
    };

    const render = (now) => {
      const elapsed = now - startTime;
      const intro = easeInOutCubic(clamp(elapsed / 780, 0, 1));
      const exit = easeInOutCubic(clamp((elapsed - EXIT_START_MS) / (DURATION_MS - EXIT_START_MS), 0, 1));
      const anomaly = intro * (1 - exit);
      const cx = width / 2;
      const cy = height * (compact ? 0.46 : 0.48);
      const base = Math.min(width, height) * (compact ? 0.2 : 0.18);
      const time = elapsed / 1000;
      const cell = compact ? 3 : 4;

      if (elapsed > EXIT_START_MS && !closingSet) {
        closingSet = true;
        setIsExiting(true);
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgba(0, 0, 0, ${0.1 + anomaly * 0.18})`;
      context.fillRect(0, 0, width, height);

      const gridAlpha = 0.06 * anomaly;
      context.strokeStyle = `rgba(245, 246, 247, ${gridAlpha})`;
      context.lineWidth = 1;
      for (let x = -cell; x < width + cell; x += cell * 8) {
        const bend = Math.sin((x - cx) * 0.012 + time * 0.8) * anomaly * 5;
        context.beginPath();
        context.moveTo(x + bend, 0);
        context.lineTo(x - bend, height);
        context.stroke();
      }
      for (let y = -cell; y < height + cell; y += cell * 8) {
        const bend = Math.cos((y - cy) * 0.012 - time * 0.7) * anomaly * 4;
        context.beginPath();
        context.moveTo(0, y + bend);
        context.lineTo(width, y - bend);
        context.stroke();
      }

      context.globalCompositeOperation = "screen";
      drawSegmentedRing(cx, cy, base * (1.36 - exit * 0.42), cell, 0.28 * anomaly, time, 0.42, compact ? 72 : 104);
      drawSegmentedRing(cx, cy, base * (1.72 - exit * 0.54), cell, 0.18 * anomaly, time, -0.28, compact ? 90 : 130);
      drawSegmentedRing(cx, cy, base * (2.12 - exit * 0.72), cell, 0.12 * anomaly, time, 0.18, compact ? 108 : 156);

      particlesRef.current.forEach((particle, index) => {
        const spiral = 1 - exit * (0.76 + particle.phase * 0.22);
        const radius = base * (0.56 + particle.radius * 2.25) * spiral;
        const angle = particle.angle + time * particle.speed * (particle.lane % 2 ? -1 : 1);
        const wobble = Math.sin(time * 1.5 + particle.phase * TAU) * base * 0.025;
        const x = cx + Math.cos(angle) * radius + wobble;
        const y = cy + Math.sin(angle) * radius * (compact ? 0.56 : 0.5) + wobble * 0.45;
        const pull = exit * base * 0.5;
        const finalX = x + (cx - x) * exit + Math.cos(angle * 3) * pull * particle.phase;
        const finalY = y + (cy - y) * exit + Math.sin(angle * 2) * pull * 0.24;
        const shimmer = 0.45 + Math.sin(time * 3 + index) * 0.3;
        const alpha = anomaly * (0.11 + shimmer * 0.22) * particle.depth;
        const size = cell * (particle.lane % 4 === 0 ? 2 : 1);
        drawPixelRect(finalX, finalY, size, alpha, 230 + (particle.lane % 3) * 8);
      });

      context.globalCompositeOperation = "source-over";

      const coreRadius = base * (0.42 - exit * 0.22);
      const eventGlow = context.createRadialGradient(cx, cy, 0, cx, cy, base * 1.14);
      eventGlow.addColorStop(0, `rgba(255, 255, 255, ${0.16 * anomaly})`);
      eventGlow.addColorStop(0.18, `rgba(200, 204, 208, ${0.1 * anomaly})`);
      eventGlow.addColorStop(0.34, `rgba(95, 99, 104, ${0.08 * anomaly})`);
      eventGlow.addColorStop(0.62, `rgba(255, 255, 255, ${0.025 * anomaly})`);
      eventGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = eventGlow;
      context.beginPath();
      context.arc(cx, cy, base * 1.14, 0, TAU);
      context.fill();

      context.fillStyle = "rgba(0, 0, 0, 0.98)";
      context.beginPath();
      context.arc(cx, cy, Math.max(12, coreRadius), 0, TAU);
      context.fill();

      context.strokeStyle = `rgba(245, 246, 247, ${0.38 * anomaly})`;
      context.lineWidth = cell;
      context.beginPath();
      context.ellipse(cx, cy, base * 0.64 * (1 - exit * 0.28), base * 0.18 * (1 - exit * 0.34), -0.12, 0, TAU);
      context.stroke();

      const labelAlpha = clamp((elapsed - 520) / 520, 0, 1) * clamp((DURATION_MS - elapsed) / 720, 0, 1);
      context.fillStyle = `rgba(242, 244, 246, ${labelAlpha * 0.64})`;
      context.font = `${compact ? 9 : 10}px "SF Pro Display", Arial, sans-serif`;
      context.textAlign = "center";
      context.letterSpacing = "3px";
      context.fillText("ORBIT ANOMALY", cx, cy + base * (compact ? 1.85 : 2.05));

      if (elapsed < DURATION_MS) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrameId = requestAnimationFrame(render);
    completeTimer = window.setTimeout(onComplete, DURATION_MS);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(completeTimer);
      window.removeEventListener("resize", resize);
    };
  }, [onComplete]);

  return (
    <div className={`orbit-egg-overlay ${isExiting ? "exit" : ""}`}>
      <div className="orbit-egg-frost" aria-hidden="true" />
      <canvas ref={canvasRef} className="orbit-canvas" aria-hidden="true" />
    </div>
  );
};

export default OrbitEasterEgg;
