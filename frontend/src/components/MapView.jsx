import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getBackgroundColor, getMapFilters } from "../theme/themeHelpers";
import { customLightMapStyle } from "../theme/customLightMapStyle";
import { BUILDING_LAYER_ID, BUILDING_MIN_ZOOM, getBuildingLight, getBuildingPaint } from "../theme/mapBuildingStyle";
import { DARK_MAP_STYLE_URL, applyCinematicDarkMapStyle } from "../theme/cinematicDarkMapStyle";

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

const CAMERA_MODES = {
  TOP: "top",
  CINEMATIC: "cinematic",
  IMMERSIVE: "immersive",
};

const getNextCameraMode = (mode) => {
  if (mode === CAMERA_MODES.TOP) return CAMERA_MODES.CINEMATIC;
  if (mode === CAMERA_MODES.CINEMATIC) return CAMERA_MODES.IMMERSIVE;
  return CAMERA_MODES.TOP;
};

const cloneMapStyle = (style) =>
  typeof style === "string" ? style : JSON.parse(JSON.stringify(style));

const getMapStyleForTheme = (themeId) =>
  themeId === "light" ? cloneMapStyle(customLightMapStyle) : DARK_MAP_STYLE_URL;

const isBuildingSourceLayer = (layer) =>
  Boolean(
    layer?.source &&
      typeof layer["source-layer"] === "string" &&
      layer["source-layer"].toLowerCase().includes("building")
  );

const applyBuildingLighting = (mapInstance, themeId) => {
  try {
    mapInstance.setLight(getBuildingLight(themeId));
  } catch (error) {
    console.warn("Unable to apply building lighting:", error);
  }
};

const applyBuildingPaint = (mapInstance, layerId, themeId) => {
  if (!mapInstance.getLayer(layerId)) return;

  const paint = getBuildingPaint(themeId);
  Object.entries(paint).forEach(([property, value]) => {
    mapInstance.setPaintProperty(layerId, property, value);
  });
  mapInstance.setLayoutProperty(layerId, "visibility", "visible");
  applyBuildingLighting(mapInstance, themeId);
};

const applyThemeToMap = (mapInstance, themeId) => {
  if (!mapInstance || !mapInstance.isStyleLoaded()) {
    return;
  }

  const bgColor = getBackgroundColor(themeId);
  const filter = getMapFilters(themeId);

  const container = mapInstance.getContainer();
  if (container) {
    container.style.transition = "background-color 400ms ease, filter 400ms ease, color 400ms ease";
    container.style.filter = filter;
    container.style.backgroundColor = bgColor;
  }

  applyBuildingLighting(mapInstance, themeId);

  if (themeId === "dark") {
    applyCinematicDarkMapStyle(mapInstance);
  } else {
    mapInstance.__orbitCinematicDarkApplied = false;
  }
};

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

const MapView = forwardRef(({ users, userLocation, theme, isFollowing, setIsFollowing, onAutoDisableFollowing, currentUserId, sosAlerts, cameraMode, setCameraMode }, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const sosMarkers = useRef({});
  const userMarker = useRef(null);
  const initialCenterSet = useRef(false);

  const themeRef = useRef(theme);
  const onAutoDisableFollowingRef = useRef(onAutoDisableFollowing);

  useEffect(() => {
    onAutoDisableFollowingRef.current = onAutoDisableFollowing;
  }, [onAutoDisableFollowing]);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyleForTheme(themeRef.current),
      center: [77.5946, 12.9716],
      zoom: 15,
      pitch: 60,
      bearing: -20,
      antialias: true,
      maxPitch: 85,
    });
    

    // 🏗️ RELIABLE LAYER RESTORATION
    // 'styledata' fires when style changes, ensuring 3D layers are always re-added
    const restoreMapLayers = () => {
      applyThemeToMap(map.current, themeRef.current);
      add3D();
    };

    map.current.on("style.load", restoreMapLayers);
    map.current.on("styledata", restoreMapLayers);
    map.current.on("idle", restoreMapLayers);

    // 📍 Auto-disable follow mode on user interaction
    map.current.on("dragstart", () => {
      if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current();
    });

    map.current.on("zoomstart", () => {
      if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current();
    });

    map.current.on("rotatestart", () => {
      if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current();
    });

    map.current.on("error", (e) => {
      const message = e?.error?.message || e?.message || "";
      if (/abort|cancel/i.test(message)) return;
      console.error("MapLibre Error:", message || e);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const prevTheme = useRef(theme);

  // 🌓 Handle Theme Change
  useEffect(() => {
    if (!map.current) return;
    themeRef.current = theme;
    
    if (prevTheme.current !== theme) {
      map.current.setStyle(getMapStyleForTheme(theme));
      prevTheme.current = theme;
    } else if (map.current.isStyleLoaded()) {
      applyThemeToMap(map.current, theme);
      add3D();
    }
  }, [theme]);

  useImperativeHandle(ref, () => ({
    handleRecenter: () => {
      if (map.current && userLocation) {
        const { lngOffset, latOffset } = getDecorations(currentUserId);
        const nextCameraMode = getNextCameraMode(cameraMode);



        if (nextCameraMode === CAMERA_MODES.TOP) {
  // TOP VIEW
      map.current.easeTo({
        center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
        zoom: 16,
        pitch: 0,
        bearing: 0,
        duration: 800,
        essential: true,
      });
    } else if (nextCameraMode === CAMERA_MODES.CINEMATIC) {
      // 3D VIEW
      map.current.easeTo({
        center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
        zoom: 16,
        pitch: 60,
        bearing: userLocation.heading || 0,
        duration: 800,
        essential: true,
      });
    } else {
      // IMMERSIVE VIEW
      map.current.easeTo({
        center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
        zoom: 18.25,
        pitch: 78,
        bearing: userLocation.heading || 0,
        duration: 1000,
        essential: true,
      });
    }

    setCameraMode(nextCameraMode);






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
  }, [userLocation, theme, isFollowing, currentUserId, cameraMode]);

  const add3D = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const style = map.current.getStyle();
    const layers = style.layers || [];
    const buildingLayers = layers.filter(isBuildingSourceLayer);
    const existingExtrusionLayer = buildingLayers.find(
      (layer) => layer.id === BUILDING_LAYER_ID || layer.type === "fill-extrusion"
    );

    if (existingExtrusionLayer) {
      buildingLayers.forEach((layer) => {
        if (layer.id !== existingExtrusionLayer.id && map.current.getLayer(layer.id)) {
          map.current.removeLayer(layer.id);
        }
      });
      applyBuildingPaint(map.current, existingExtrusionLayer.id, themeRef.current);
      return;
    }

    const buildingLayer = buildingLayers.find((layer) => layer.source && layer["source-layer"]);
    if (!buildingLayer) {
      return;
    }

    const source = buildingLayer.source;
    const sourceLayer = buildingLayer["source-layer"];
    const lastBuildingIndex = layers.reduce(
      (lastIndex, layer, index) => (isBuildingSourceLayer(layer) ? index : lastIndex),
      -1
    );
    const beforeLayerId = layers.slice(lastBuildingIndex + 1).find((layer) => !isBuildingSourceLayer(layer))?.id;

    buildingLayers.forEach((layer) => {
      if (map.current.getLayer(layer.id)) {
        map.current.removeLayer(layer.id);
      }
    });

    const extrusionLayer = {
      id: BUILDING_LAYER_ID,
      source: source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM,
      layout: {
        visibility: "visible",
      },
      paint: getBuildingPaint(themeRef.current),
      ...(buildingLayer.filter ? { filter: buildingLayer.filter } : {}),
    };

    map.current.addLayer(
      extrusionLayer,
      beforeLayerId && map.current.getLayer(beforeLayerId) ? beforeLayerId : undefined
    );
    applyBuildingLighting(map.current, themeRef.current);
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
