import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getBackgroundColor, getMapFilters } from "../theme/themeHelpers";
import { customLightMapStyle } from "../theme/customLightMapStyle";
import {
  BUILDING_ACCENT_LAYER_IDS,
  BUILDING_LAYER_ID,
  BUILDING_MIN_ZOOM,
  getBuildingAccentLayers,
  getBuildingLight,
  getBuildingPaint
} from "../theme/mapBuildingStyle";
import { DARK_MAP_STYLE_URL, applyCinematicDarkMapStyle } from "../theme/cinematicDarkMapStyle";

const MARKER_PALETTE = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759",
  "#5AC8FA", "#007AFF", "#5856D6", "#FF2D55",
  "#AF52DE", "#FF6B6B",
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
  const radius = 0.00003;
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

const CLEAR_SKY_STYLE = {
  "sky-color": "rgba(0, 0, 0, 0)",
  "horizon-color": "rgba(0, 0, 0, 0)",
  "fog-color": "rgba(0, 0, 0, 0)",
  "fog-ground-blend": 1,
  "horizon-fog-blend": 1,
  "sky-horizon-blend": 1,
  "atmosphere-blend": 0
};

const IMMERSIVE_SKY_STYLE = {
  "sky-color": "rgba(8, 9, 8, 0)",
  "horizon-color": "rgba(25, 26, 22, 0.24)",
  "fog-color": "rgba(43, 44, 38, 0.28)",
  "fog-ground-blend": 0.88,
  "horizon-fog-blend": 0.94,
  "sky-horizon-blend": 0.86,
  "atmosphere-blend": 0.1
};

const applyCameraAtmosphere = (mapInstance, cameraMode, themeId) => {
  if (!mapInstance?.setSky) return;
  try {
    mapInstance.setSky(
      cloneMapStyle(themeId === "dark" && cameraMode === CAMERA_MODES.IMMERSIVE ? IMMERSIVE_SKY_STYLE : CLEAR_SKY_STYLE),
      { validate: false }
    );
  } catch (error) {
    console.warn("Unable to apply camera atmosphere:", error);
  }
};

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

const removeBuildingAccentLayers = (mapInstance) => {
  BUILDING_ACCENT_LAYER_IDS.forEach((layerId) => {
    if (mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId);
    }
  });
};

const syncBuildingAccentLayers = (mapInstance, source, sourceLayer, baseFilter, themeId, beforeLayerId) => {
  const accentLayers = getBuildingAccentLayers(themeId, source, sourceLayer, baseFilter);
  const accentLayerIds = new Set(accentLayers.map((layer) => layer.id));

  BUILDING_ACCENT_LAYER_IDS.forEach((layerId) => {
    if (!accentLayerIds.has(layerId) && mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId);
    }
  });

  accentLayers.forEach((layer) => {
    const layerSpec = cloneMapStyle(layer);
    if (!layerSpec.filter) delete layerSpec.filter;

    if (!mapInstance.getLayer(layer.id)) {
      mapInstance.addLayer(
        layerSpec,
        beforeLayerId && mapInstance.getLayer(beforeLayerId) ? beforeLayerId : undefined
      );
      return;
    }

    Object.entries(layer.paint || {}).forEach(([property, value]) => {
      mapInstance.setPaintProperty(layer.id, property, cloneMapStyle(value));
    });
    mapInstance.setFilter(layer.id, layer.filter ? cloneMapStyle(layer.filter) : null);
    mapInstance.setLayoutProperty(layer.id, "visibility", "visible");
  });
};

const applyThemeToMap = (mapInstance, themeId, cameraMode) => {
  if (!mapInstance || !mapInstance.isStyleLoaded()) return;

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

  applyCameraAtmosphere(mapInstance, cameraMode, themeId);
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

// ── Blazing gold — same energy as cinematic highways ──────────────────────────
const GOLD = { r: 255, g: 200, b: 60 };

const startBlackHoleAnimation = (canvas, markerEl) => {
  const ctx = canvas.getContext("2d");
  canvas.width = 300;
  canvas.height = 300;
  const cx = 150, cy = 150;
  let animId;
  let frame = 0;

  // 8 trails at organic angles for cinematic asymmetry
  const baseAngles = [0, 42, 90, 137, 180, 222, 270, 317];
  const spawnRadius = 148;

  let particles = baseAngles.map((angleDeg, idx) => {
    const jitter = (Math.random() - 0.5) * 20;
    const jRad = (angleDeg + jitter) * (Math.PI / 180);
    return {
      x: cx + Math.cos(jRad) * spawnRadius,
      y: cy + Math.sin(jRad) * spawnRadius,
      vx: 0,
      vy: 0,
      trail: [],
      trailMaxLen: 26 + idx * 2,
      absorbed: false,
      life: 1,
      delay: idx * 4,          // staggered spawn in frames
      width: 2.0 + Math.random() * 1.2,
    };
  });

  const triggerPulse = () => {
    if (markerEl.classList.contains("absorption-pulse")) return;
    markerEl.classList.add("absorption-pulse");
    setTimeout(() => markerEl.classList.remove("absorption-pulse"), 700);
  };

  let pulseTriggered = false;
  const { r, g, b } = GOLD;

  const drawTrail = (p) => {
    if (p.trail.length < 2) return;

    // Pass 1 — wide outer glow
    for (let i = 0; i < p.trail.length - 1; i++) {
      const progress = i / (p.trail.length - 1);
      ctx.beginPath();
      ctx.moveTo(p.trail[i].x, p.trail[i].y);
      ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
      ctx.strokeStyle = `rgba(${r},${g},${b},${progress * p.life * 0.3})`;
      ctx.lineWidth = p.width * 4.5;
      ctx.shadowBlur = 18 * progress;
      ctx.shadowColor = `rgba(${r},${g},${b},0.85)`;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Pass 2 — bright gold core
    for (let i = 0; i < p.trail.length - 1; i++) {
      const progress = i / (p.trail.length - 1);
      const brightness = Math.round(210 + progress * 45);
      ctx.beginPath();
      ctx.moveTo(p.trail[i].x, p.trail[i].y);
      ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
      ctx.strokeStyle = `rgba(255,${brightness},70,${progress * p.life * 0.9})`;
      ctx.lineWidth = p.width;
      ctx.shadowBlur = 7 * progress;
      ctx.shadowColor = `rgba(255,240,160,0.8)`;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Leading hot point
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.width * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,252,200,${p.life * 0.95})`;
    ctx.shadowBlur = 28;
    ctx.shadowColor = `rgba(255,215,80,1)`;
    ctx.fill();
  };

  const loop = () => {
    animId = requestAnimationFrame(loop);
    frame++;
    ctx.clearRect(0, 0, 300, 300);

    let activeParticles = [];

    particles.forEach((p) => {
      // Staggered spawn — hold until delay frame
      if (frame < p.delay) { activeParticles.push(p); return; }

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > p.trailMaxLen) p.trail.shift();

      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > 88) {
        // Phase 0 — magnetic approach with subtle lateral drift
        const ease = 0.011 + (1 - dist / spawnRadius) * 0.009;
        p.x += (cx - p.x) * ease;
        p.y += (cy - p.y) * ease;
        if (dist > 0) {
          p.x += (-dy / dist) * 0.28;
          p.y += (dx / dist) * 0.28;
        }
      } else if (dist > 4) {
        // Phase 1 — gravitational clockwise spiral, velocity-blended
        const closeness = 1 - dist / 88;
        const swirl = 0.036 + closeness * 0.082;
        const pull  = 0.013 + closeness * 0.046;

        const targetVx = -dx * pull + (-dy * swirl);
        const targetVy = -dy * pull + (dx  * swirl);
        p.vx = p.vx * 0.74 + targetVx * 0.26;
        p.vy = p.vy * 0.74 + targetVy * 0.26;
        p.x += p.vx;
        p.y += p.vy;
      } else {
        // Phase 2 — absorption fade
        p.life -= 0.072;
        if (p.life <= 0 && !p.absorbed) {
          p.absorbed = true;
          if (!pulseTriggered) { pulseTriggered = true; triggerPulse(); }
        }
      }

      if (p.life > 0) {
        activeParticles.push(p);
        ctx.save();
        drawTrail(p);
        ctx.restore();
      }
    });

    particles = activeParticles;
    if (particles.length === 0) {
      cancelAnimationFrame(animId);
      ctx.clearRect(0, 0, 300, 300);
    }
  };

  loop();
};

const MapView = forwardRef(({
  users, userLocation, theme, isFollowing, setIsFollowing,
  onAutoDisableFollowing, currentUserId, sosAlerts,
  cameraMode, setCameraMode, onBearingChange
}, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const sosMarkers = useRef({});
  const userMarker = useRef(null);
  const initialCenterSet = useRef(false);

  const themeRef = useRef(theme);
  const cameraModeRef = useRef(cameraMode);
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

    // 🏗️ Reliable layer restoration
    const restoreMapLayers = () => {
      applyThemeToMap(map.current, themeRef.current, cameraModeRef.current);
      add3D();
    };

    map.current.on("style.load", restoreMapLayers);
    map.current.on("styledata", restoreMapLayers);
    map.current.on("idle", restoreMapLayers);

    // 🧭 Live bearing for compass
    const emitBearing = () => {
      if (onBearingChange) onBearingChange(map.current.getBearing());
    };
    map.current.on("rotate", emitBearing);
    map.current.on("move",   emitBearing);

    // 📍 Auto-disable follow on interaction
    map.current.on("dragstart",   () => { if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current(); });
    map.current.on("zoomstart",   () => { if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current(); });
    map.current.on("rotatestart", () => { if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current(); });

    map.current.on("error", (e) => {
      const message = e?.error?.message || e?.message || "";
      if (/abort|cancel/i.test(message)) return;
      console.error("MapLibre Error:", message || e);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevTheme = useRef(theme);

  // 🌓 Handle Theme Change
  useEffect(() => {
    if (!map.current) return;
    themeRef.current = theme;
    if (prevTheme.current !== theme) {
      map.current.setStyle(getMapStyleForTheme(theme));
      prevTheme.current = theme;
    } else if (map.current.isStyleLoaded()) {
      applyThemeToMap(map.current, theme, cameraModeRef.current);
      add3D();
    }
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (map.current && map.current.isStyleLoaded()) {
      applyCameraAtmosphere(map.current, cameraMode, themeRef.current);
    }
  }, [cameraMode]);

  useImperativeHandle(ref, () => ({
    handleRecenter: () => {
      if (map.current && userLocation) {
        const { lngOffset, latOffset } = getDecorations(currentUserId);
        const nextCameraMode = getNextCameraMode(cameraMode);

        if (nextCameraMode === CAMERA_MODES.TOP) {
          map.current.easeTo({
            center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
            zoom: 16, pitch: 0, bearing: 0, duration: 800, essential: true,
          });
        } else if (nextCameraMode === CAMERA_MODES.CINEMATIC) {
          map.current.easeTo({
            center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
            zoom: 16, pitch: 60, bearing: userLocation.heading || 0, duration: 800, essential: true,
          });
        } else {
          map.current.easeTo({
            center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
            zoom: 18.25, pitch: 78, bearing: userLocation.heading || 0, duration: 1000, essential: true,
          });
        }

        setCameraMode(nextCameraMode);
      }
    },
    handleCenterOnUser: (lng, lat) => {
      if (map.current) {
        map.current.easeTo({ center: [lng, lat], zoom: 16, duration: 1200, essential: true });
      }
    },
  }));

  // 🎯 Update user location marker
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
        <div class="pulse-ring"></div>
        <div class="pulse-ring pulse-ring--secondary"></div>
        <div class="glow-ring"></div>
        <div class="glow-halo"></div>
        <div class="direction-cone"></div>
        <div class="center-dot">
          <div class="center-dot__inner"></div>
        </div>
      `;

      const canvas = el.querySelector(".black-hole-canvas");
      //startBlackHoleAnimation(canvas, el);

      userMarker.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([targetLng, targetLat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([targetLng, targetLat]);
    }

    const el   = userMarker.current.getElement();
    const cone = el.querySelector(".direction-cone");
    const dot  = el.querySelector(".center-dot");
    const glow = el.querySelector(".glow-ring");
    const pulse = el.querySelector(".pulse-ring");

    if (dot)  { dot.style.backgroundColor = color; dot.style.borderColor = "white"; dot.style.boxShadow = `0 0 12px ${color}, 0 0 24px ${color}55`; }
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
      map.current.easeTo({ center: [targetLng, targetLat], duration: 800, essential: true });
    }
  }, [userLocation, theme, isFollowing, currentUserId, cameraMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const add3D = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const style = map.current.getStyle();
    const layers = style.layers || [];
    const buildingLayers = layers.filter(isBuildingSourceLayer);
    const baseBuildingLayers = buildingLayers.filter(
      (layer) => !BUILDING_ACCENT_LAYER_IDS.includes(layer.id)
    );
    const existingExtrusionLayer = baseBuildingLayers.find(
      (layer) => layer.id === BUILDING_LAYER_ID || layer.type === "fill-extrusion"
    );
    const accentLayersReady =
      themeRef.current !== "dark" || BUILDING_ACCENT_LAYER_IDS.every((layerId) => map.current.getLayer(layerId));

    if (
      existingExtrusionLayer?.id === BUILDING_LAYER_ID &&
      accentLayersReady &&
      map.current.__orbitBuildingThemeApplied === themeRef.current
    ) {
      return;
    }

    if (existingExtrusionLayer) {
      baseBuildingLayers.forEach((layer) => {
        if (layer.id !== existingExtrusionLayer.id && map.current.getLayer(layer.id)) {
          map.current.removeLayer(layer.id);
        }
      });
      applyBuildingPaint(map.current, existingExtrusionLayer.id, themeRef.current);
      syncBuildingAccentLayers(
        map.current,
        existingExtrusionLayer.source,
        existingExtrusionLayer["source-layer"],
        existingExtrusionLayer.filter,
        themeRef.current,
        layers.slice(layers.indexOf(existingExtrusionLayer) + 1).find((layer) => !isBuildingSourceLayer(layer))?.id
      );
      map.current.__orbitBuildingThemeApplied = themeRef.current;
      return;
    }

    const buildingLayer = baseBuildingLayers.find((layer) => layer.source && layer["source-layer"]);
    if (!buildingLayer) {
      removeBuildingAccentLayers(map.current);
      map.current.__orbitBuildingThemeApplied = null;
      return;
    }

    const source = buildingLayer.source;
    const sourceLayer = buildingLayer["source-layer"];
    const lastBuildingIndex = layers.reduce(
      (lastIndex, layer, index) =>
        isBuildingSourceLayer(layer) && !BUILDING_ACCENT_LAYER_IDS.includes(layer.id) ? index : lastIndex,
      -1
    );
    const beforeLayerId = layers.slice(lastBuildingIndex + 1).find((layer) => !isBuildingSourceLayer(layer))?.id;

    baseBuildingLayers.forEach((layer) => {
      if (map.current.getLayer(layer.id)) map.current.removeLayer(layer.id);
    });

    const extrusionLayer = {
      id: BUILDING_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM,
      layout: { visibility: "visible" },
      paint: getBuildingPaint(themeRef.current),
      ...(buildingLayer.filter ? { filter: buildingLayer.filter } : {}),
    };

    map.current.addLayer(
      extrusionLayer,
      beforeLayerId && map.current.getLayer(beforeLayerId) ? beforeLayerId : undefined
    );
    applyBuildingLighting(map.current, themeRef.current);
    syncBuildingAccentLayers(map.current, source, sourceLayer, buildingLayer.filter, themeRef.current, beforeLayerId);
    map.current.__orbitBuildingThemeApplied = themeRef.current;
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

  // 🚨 SOS Markers
  useEffect(() => {
    if (!map.current) return;

    sosAlerts.forEach((alert) => {
      const { lngOffset, latOffset } = getDecorations(alert.id);
      if (!sosMarkers.current[alert.id]) {
        const el = document.createElement("div");
        el.className = "sos-marker";
        el.innerHTML = `
          <div class="sos-pulse"></div>
          <div class="sos-pulse delay"></div>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([alert.lng + lngOffset, alert.lat + latOffset])
          .addTo(map.current);
        sosMarkers.current[alert.id] = marker;
      } else {
        sosMarkers.current[alert.id].setLngLat([alert.lng + lngOffset, alert.lat + latOffset]);
      }
    });

    Object.keys(sosMarkers.current).forEach((id) => {
      if (!sosAlerts.find((alert) => String(alert.id) === String(id))) {
        sosMarkers.current[id].remove();
        delete sosMarkers.current[id];
      }
    });
  }, [sosAlerts]);

  return (
    <div
      className={`map-stage ${cameraMode === CAMERA_MODES.IMMERSIVE ? "immersive-atmosphere" : ""}`}
      style={{ width: "100%", height: "100vh", position: "relative" }}
    >
      <div ref={mapContainer} className="map-viewport" style={{ position: "absolute", inset: 0 }} />
      <div className="immersive-fog-overlay" aria-hidden="true" />
    </div>
  );
});

export default MapView;
