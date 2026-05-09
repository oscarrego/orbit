import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MARKER_PALETTE = [
  "#FF3B30", // Red
  "#FF9500", // Orange
  "#FFCC00", // Yellow
  "#34C759", // Green
  "#5AC8FA", // Light Blue
  "#007AFF", // Blue
  "#5856D6", // Purple
  "#FF2D55", // Pink
  "#AF52DE", // Indigo
  "#FF6B6B", // Coral
];

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getDeterministicOffset = (userId) => {
  const hash = hashString(userId);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.00003; // ~3 meters
  return {
    lngOffset: Math.cos(angle) * radius,
    latOffset: Math.sin(angle) * radius,
  };
};

const getDeterministicColor = (userId) => {
  const hash = hashString(userId);
  return MARKER_PALETTE[hash % MARKER_PALETTE.length];
};

const decorationCache = new Map();

const getDecorations = (id) => {
  if (!decorationCache.has(id)) {
    decorationCache.set(id, {
      ...getDeterministicOffset(id),
      color: getDeterministicColor(id),
    });
  }
  return decorationCache.get(id);
};

const startBlackHoleAnimation = (canvas, markerEl, color) => {
  console.log("startBlackHoleAnimation running (from MapView.js)");
  const hexToRgb = (hex) => {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const { r, g, b } = hexToRgb(color);
  const ctx = canvas.getContext("2d");
  canvas.width = 300;
  canvas.height = 300;
  const cx = 150, cy = 150;
  let animId;

  const spawnPoints = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 0, y: 300 },
    { x: 300, y: 300 },
    { x: 0, y: 150 },
    { x: 300, y: 150 }
  ];

  let particles = spawnPoints.map(pt => ({
    x: pt.x,
    y: pt.y,
    vx: 0,
    vy: 0,
    trail: [],
    absorbed: false,
    life: 1
  }));

  const triggerPulse = () => {
    if (markerEl.classList.contains('absorption-pulse')) return;
    markerEl.classList.add('absorption-pulse');
    setTimeout(() => {
      markerEl.classList.remove('absorption-pulse');
    }, 600); // 0.6s pulse matching CSS animation
  };

  const loop = () => {
    animId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, 300, 300);

    ctx.shadowBlur = 15;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    let activeParticles = [];

    particles.forEach(p => {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 20) p.trail.shift();

      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > 100) {
        // PHASE 1: CONVERGENCE
        // move straight toward marker, smooth easing
        p.x += (cx - p.x) * 0.015;
        p.y += (cy - p.y) * 0.015;
      } else if (dist > 5) {
        // PHASE 2 & 3: ORBIT & SPIRAL INWARD
        const closeness = 1 - (dist / 100);
        const swirlStrength = 0.05 + closeness * 0.1;
        const inwardPull = 0.015 + closeness * 0.04;

        p.vx = -dx * inwardPull;
        p.vy = -dy * inwardPull;

        // Force CLOCKWISE rotation
        p.vx += -dy * swirlStrength;
        p.vy += dx * swirlStrength;

        p.x += p.vx;
        p.y += p.vy;
      } else {
        // PHASE 4: ABSORPTION
        p.life -= 0.1;
        if (p.life <= 0 && !p.absorbed) {
          p.absorbed = true;
          triggerPulse();
        }
      }

      if (p.life > 0) {
        activeParticles.push(p);

        // Gradient tail: bright front -> smooth fade tail
        if (p.trail.length > 1) {
          for (let i = 0; i < p.trail.length - 1; i++) {
            ctx.beginPath();
            ctx.moveTo(p.trail[i].x, p.trail[i].y);
            ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
            
            const progress = i / (p.trail.length - 1);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${progress * p.life})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20 * progress;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 1)`;
            ctx.stroke();
          }
        }

        // Bright front
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 1)`;
        ctx.fill();
      }
    });

    particles = activeParticles;

    // SINGLE RUN ANIMATION
    if (particles.length === 0) {
      cancelAnimationFrame(animId);
      ctx.clearRect(0, 0, 300, 300);
    }
  };

  loop();
};

const MapView = forwardRef(({ users, userLocation, theme, isFollowing, setIsFollowing, onAutoDisableFollowing, currentUserId, sosAlerts, is3DView, setIs3DView }, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const sosMarkers = useRef({});
  const userMarker = useRef(null);
  const initialCenterSet = useRef(false);

  const styles = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styles[theme] || styles.dark,
      center: [77.5946, 12.9716],
      zoom: 15,
      pitch: 60,
      bearing: -20,
    });
    

    // 🏗️ RELIABLE LAYER RESTORATION
    // 'styledata' fires when style changes, ensuring 3D layers are always re-added
    map.current.on("styledata", () => {
      add3D();
    });

    // 📍 Auto-disable follow mode on user interaction
    map.current.on("dragstart", () => {
      if (onAutoDisableFollowing) onAutoDisableFollowing();
    });

    map.current.on("zoomstart", () => {
      if (onAutoDisableFollowing) onAutoDisableFollowing();
    });

    map.current.on("rotatestart", () => {
      if (onAutoDisableFollowing) onAutoDisableFollowing();
    });

    map.current.on("error", (e) => console.error("MapLibre Error:", e));
  }, []);

  // 🌓 Handle Theme Change
  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(styles[theme]);
  }, [theme]);

  useImperativeHandle(ref, () => ({
    handleRecenter: () => {
      if (map.current && userLocation) {
        const { lngOffset, latOffset } = getDecorations(currentUserId);



        if (is3DView) {
  // TOP VIEW
      map.current.easeTo({
        center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
        zoom: 16,
        pitch: 0,
        bearing: 0,
        duration: 800,
        essential: true,
      });
    } else {
      // 3D VIEW
      map.current.easeTo({
        center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
        zoom: 16,
        pitch: 60,
        bearing: userLocation.heading || 0,
        duration: 800,
        essential: true,
      });
    }

    setIs3DView(prev => !prev);






      }
    },
    handleCenterOnUser: (lng, lat) => {
      if (map.current) {
        map.current.easeTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1200,
          essential: true,
        });
      }
    },
  }));

  // 🎯 Update Blue Dot Marker
  useEffect(() => {
    if (!map.current || !userLocation || !currentUserId) return;

    const { lng, lat, heading } = userLocation;
    const { lngOffset, latOffset, color } = getDecorations(currentUserId);
    
    const targetLng = lng + lngOffset;
    const targetLat = lat + latOffset;

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "user-location-marker";
      el.style.color = color;
      el.innerHTML = `
        <canvas class="black-hole-canvas"></canvas>
        <div class="pulse-ring"></div>
        <div class="glow-ring"></div>
        <div class="direction-cone"></div>
        <div class="center-dot"></div>
      `;

      const canvas = el.querySelector(".black-hole-canvas");
      startBlackHoleAnimation(canvas, el, color);

      userMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([targetLng, targetLat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([targetLng, targetLat]);
    }

    const el = userMarker.current.getElement();
    const cone = el.querySelector(".direction-cone");
    const dot = el.querySelector(".center-dot");
    const glow = el.querySelector(".glow-ring");
    const pulse = el.querySelector(".pulse-ring");

    // Apply unique color with brightness highlight for current user
    if (dot) {
      dot.style.backgroundColor = color;
      dot.style.borderColor = "white";
      dot.style.boxShadow = `0 0 10px ${color}`;
    }
    if (glow) glow.style.backgroundColor = color;
    if (pulse) pulse.style.backgroundColor = color;
    if (cone) cone.style.borderBottomColor = color;
    
    if (heading !== null && heading !== undefined) {
      cone.style.transform = `rotate(${heading}deg)`;
      cone.style.display = "block";
    } else {
      cone.style.display = "none";
    }

    if (!initialCenterSet.current) {
      map.current.jumpTo({ center: [targetLng, targetLat] });
      initialCenterSet.current = true;
    } else if (isFollowing) {
      map.current.easeTo({
        center: [targetLng, targetLat],
        duration: 800,
        essential: true,
      });
    }
  }, [userLocation, theme, isFollowing, currentUserId, is3DView]);

  const add3D = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer("3d-buildings")) return;

    const style = map.current.getStyle();
    console.log(style.sources);
    console.log(style.layers);

    const buildingLayer = style.layers.find(
      l =>
        l.type === "fill" &&
        l["source-layer"] &&
        l["source-layer"].includes("building")
    );

    if (!buildingLayer) {
      console.warn("No valid building layer found");
      return;
    }

    const source = buildingLayer.source;
    const sourceLayer = buildingLayer["source-layer"];

    console.log("Using source:", source);
    console.log("Using source-layer:", sourceLayer);

    const labelLayerId = style.layers.find(
      (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
    )?.id;

    map.current.addLayer({
      id: "3d-buildings",
      source: source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#bfbfbf",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0,
          15, 80,
          16, 200,
          17, 400,
          18, 800
        ],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 1,
        "fill-extrusion-vertical-gradient": true
      }
    }, labelLayerId);

    map.current.setLight({
      anchor: "viewport",
      position: [1.2, 80, 60],
      color: "#ffffff",
      intensity: 0.8
    });

    map.current.setPitch(65);
    map.current.setBearing(40);
    map.current.setZoom(17);
  };

  useEffect(() => {
    if (!map.current || !currentUserId) return;

    users.forEach((user) => {
      if (user.id === currentUserId) return;

      const { lngOffset, latOffset, color } = getDecorations(user.id);

      if (!markers.current[user.id]) {
        const el = document.createElement("div");
        el.className = "marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.backgroundColor = color;
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([user.lng + lngOffset, user.lat + latOffset])
          .addTo(map.current);

        markers.current[user.id] = marker;
      } else {
        markers.current[user.id].setLngLat([user.lng + lngOffset, user.lat + latOffset]);
        markers.current[user.id].getElement().style.backgroundColor = color;
      }
    });

    Object.keys(markers.current).forEach((id) => {
      if (!users.find((u) => u.id === id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });
  }, [users, theme, currentUserId]);

  // 🚨 Handle SOS Alerts (Enhanced with Markers)
  useEffect(() => {
    if (!map.current) return;

    console.log("📡 SOS ALERTS UPDATE:", sosAlerts);

    // Create/Update SOS Markers
    sosAlerts.forEach((alert) => {
      const { lngOffset, latOffset } = getDecorations(alert.id);
      if (!sosMarkers.current[alert.id]) {
        console.log("✨ Creating new SOS marker for:", alert.id);
        const el = document.createElement("div");
        el.className = "sos-marker";
        el.innerHTML = `
          <div class="sos-pulse"></div>
          <div class="sos-pulse delay"></div>
          
        `;

        const marker = new maplibregl.Marker({ 
          element: el, 
          anchor: "center" 
        })
        
        .setLngLat([
          alert.lng + lngOffset,
          alert.lat + latOffset
        ])
        .addTo(map.current);

        sosMarkers.current[alert.id] = marker;
      } else {
        sosMarkers.current[alert.id].setLngLat([
          alert.lng + lngOffset,
          alert.lat + latOffset
        ]);
      }
    });

    // Remove inactive SOS markers
    Object.keys(sosMarkers.current).forEach((id) => {
      const stillExists = sosAlerts.find((alert) => String(alert.id) === String(id));
      if (!stillExists) {
        console.log("🗑️ Removing SOS marker for:", id);
        sosMarkers.current[id].remove();
        delete sosMarkers.current[id];
      }
    });
  }, [sosAlerts]);

    return (
      <div 
        ref={mapContainer} 
        className="map-viewport" 
        style={{ width: "100%", height: "100vh", position: "relative" }} 
      />
    );
  });
  export default MapView;