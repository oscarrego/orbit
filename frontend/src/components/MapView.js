import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getBackgroundColor, getMapFilters, getThemeConfig } from "../theme/themeHelpers";
import {
  BUILDING_ACCENT_LAYER_IDS,
  BUILDING_LAYER_ID,
  BUILDING_MIN_ZOOM,
  getBuildingAccentLayers,
  getBuildingLight,
  getBuildingPaint
} from "../theme/mapBuildingStyle";
import { applyCinematicDarkMapStyle } from "../theme/cinematicDarkMapStyle";

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

// ── Sky & Atmosphere presets ─────────────────────────────────────────────────
//
// Design intent: cloudy urban night — overcast cloud deck trapping city glow,
// no stars, no sci-fi. The horizon should feel like a distant metropolitan
// skyline viewed through humid air rather than pure void.
//
// TOP mode: minimal atmosphere — almost clean for overview readability
const TOP_SKY_STYLE = {
  "sky-color":        "rgba(14, 16, 22, 0.0)",   // transparent
  "horizon-color":    "rgba(18, 20, 28, 0.0)",
  "fog-color":        "rgba(14, 16, 22, 0.0)",
  "fog-ground-blend": 1,
  "horizon-fog-blend":1,
  "sky-horizon-blend":1,
  "atmosphere-blend": 0
};

// CINEMATIC mode: dark overcast sky with soft warm horizon — city glow from below
const CINEMATIC_SKY_STYLE = {
  "sky-color":        "rgba(12, 14, 20, 0.88)",   // deep blue-black cloud ceiling
  "horizon-color":    "rgba(32, 30, 24, 0.72)",   // warm amber horizon haze
  "fog-color":        "rgba(24, 22, 18, 0.54)",   // ground-level city warmth
  "fog-ground-blend": 0.82,
  "horizon-fog-blend":0.88,
  "sky-horizon-blend":0.78,
  "atmosphere-blend": 0.18
};

// IMMERSIVE mode: deep volumetric fog — humid cloudy night close to ground level
const IMMERSIVE_SKY_STYLE = {
  "sky-color":        "rgba(10, 12, 18, 0.94)",   // almost opaque cloud ceiling
  "horizon-color":    "rgba(38, 34, 26, 0.80)",   // warm amber city-glow horizon
  "fog-color":        "rgba(32, 28, 22, 0.64)",   // volumetric ground haze
  "fog-ground-blend": 0.76,
  "horizon-fog-blend":0.90,
  "sky-horizon-blend":0.82,
  "atmosphere-blend": 0.28
};

const LIGHT_SKY_STYLE = {
  "sky-color": "rgba(232, 237, 243, 0.92)",
  "horizon-color": "rgba(244, 247, 250, 0.9)",
  "fog-color": "rgba(221, 227, 234, 0.34)",
  "fog-ground-blend": 0.84,
  "horizon-fog-blend": 0.92,
  "sky-horizon-blend": 0.92,
  "atmosphere-blend": 0.1
};

const getSkyStyleForMode = (cameraMode, themeId) => {
  if (themeId === "light") return cloneMapStyle(LIGHT_SKY_STYLE);
  if (cameraMode === CAMERA_MODES.IMMERSIVE)  return cloneMapStyle(IMMERSIVE_SKY_STYLE);
  if (cameraMode === CAMERA_MODES.CINEMATIC)  return cloneMapStyle(CINEMATIC_SKY_STYLE);
  return cloneMapStyle(TOP_SKY_STYLE);
};

const applyCameraAtmosphere = (mapInstance, cameraMode, themeId) => {
  if (!mapInstance?.setSky) return;
  try {
    mapInstance.setSky(getSkyStyleForMode(cameraMode, themeId), { validate: false });
  } catch (error) {
    console.warn("Unable to apply camera atmosphere:", error);
  }
};


const getMapStyleForTheme = (themeId) => getThemeConfig(themeId).styleUrl;

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

const applyBuildingPaint = (mapInstance, layerId, themeId, buildingsEnabled) => {
  if (!mapInstance.getLayer(layerId)) return;
  const paint = getBuildingPaint(themeId);
  mapInstance.setPaintProperty(layerId, "fill-extrusion-height-transition", { duration: 540, delay: 0 });
  mapInstance.setPaintProperty(layerId, "fill-extrusion-base-transition", { duration: 540, delay: 0 });
  mapInstance.setPaintProperty(layerId, "fill-extrusion-opacity-transition", { duration: 420, delay: 0 });
  Object.entries(paint).forEach(([property, value]) => {
    const nextValue =
      !buildingsEnabled && property === "fill-extrusion-height" ? 0 :
      !buildingsEnabled && property === "fill-extrusion-base" ? 0 :
      !buildingsEnabled && property === "fill-extrusion-opacity" ? 0 :
      value;
    mapInstance.setPaintProperty(layerId, property, nextValue);
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

const syncBuildingAccentLayers = (mapInstance, source, sourceLayer, baseFilter, themeId, beforeLayerId, buildingsEnabled) => {
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
    }

    Object.entries(layer.paint || {}).forEach(([property, value]) => {
      mapInstance.setPaintProperty(layer.id, "fill-extrusion-height-transition", { duration: 540, delay: 0 });
      mapInstance.setPaintProperty(layer.id, "fill-extrusion-base-transition", { duration: 540, delay: 0 });
      mapInstance.setPaintProperty(layer.id, "fill-extrusion-opacity-transition", { duration: 420, delay: 0 });
      const nextValue =
        !buildingsEnabled && property === "fill-extrusion-height" ? 0 :
        !buildingsEnabled && property === "fill-extrusion-base" ? 0 :
        !buildingsEnabled && property === "fill-extrusion-opacity" ? 0 :
        cloneMapStyle(value);
      mapInstance.setPaintProperty(layer.id, property, nextValue);
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

  applyCinematicDarkMapStyle(mapInstance, themeId);

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

const MapView = forwardRef(({
  users, userLocation, theme, isFollowing, setIsFollowing,
  onAutoDisableFollowing, currentUserId, sosAlerts,
  cameraMode, setCameraMode, onBearingChange, buildingsEnabled, deviceHeading, onMapInteraction
}, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const sosMarkers = useRef({});
  const userMarker = useRef(null);
  const initialCenterSet = useRef(false);
  const styleRestoreTimer = useRef(null);

  const themeRef = useRef(theme);
  const cameraModeRef = useRef(cameraMode);
  const buildingsEnabledRef = useRef(buildingsEnabled);
  const onAutoDisableFollowingRef = useRef(onAutoDisableFollowing);
  const onMapInteractionRef = useRef(onMapInteraction);

  useEffect(() => {
    onAutoDisableFollowingRef.current = onAutoDisableFollowing;
  }, [onAutoDisableFollowing]);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

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

    // 📍 Auto-disable follow and let mobile UI yield to deliberate map gestures.
    const handleGestureStart = () => {
      if (onAutoDisableFollowingRef.current) onAutoDisableFollowingRef.current();
      if (onMapInteractionRef.current) onMapInteractionRef.current();
    };

    map.current.on("dragstart", handleGestureStart);
    map.current.on("zoomstart", handleGestureStart);
    map.current.on("rotatestart", handleGestureStart);
    map.current.on("pitchstart", handleGestureStart);

    const canvasContainer = map.current.getCanvasContainer();
    canvasContainer?.addEventListener("pointerdown", handleGestureStart, { passive: true });
    canvasContainer?.addEventListener("wheel", handleGestureStart, { passive: true });

    map.current.on("error", (e) => {
      const message = e?.error?.message || e?.message || "";
      if (/abort|cancel/i.test(message)) return;
      console.error("MapLibre Error:", message || e);
    });

    return () => {
      if (styleRestoreTimer.current) window.clearTimeout(styleRestoreTimer.current);
      canvasContainer?.removeEventListener("pointerdown", handleGestureStart);
      canvasContainer?.removeEventListener("wheel", handleGestureStart);
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
      map.current.__orbitBuildingThemeApplied = null;
      map.current.__orbitBuildingsEnabled = null;
      map.current.setStyle(getMapStyleForTheme(theme));
      prevTheme.current = theme;
      const restoreNewStyle = () => {
        if (!map.current || !map.current.isStyleLoaded() || themeRef.current !== theme) return;
        applyThemeToMap(map.current, theme, cameraModeRef.current);
        add3D(true);
      };
      map.current.once("idle", restoreNewStyle);
      if (styleRestoreTimer.current) window.clearTimeout(styleRestoreTimer.current);
      styleRestoreTimer.current = window.setTimeout(restoreNewStyle, 1200);
    } else if (map.current.isStyleLoaded()) {
      applyThemeToMap(map.current, theme, cameraModeRef.current);
      add3D(true);
    }
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (map.current && map.current.isStyleLoaded()) {
      applyCameraAtmosphere(map.current, cameraMode, themeRef.current);
    }
  }, [cameraMode]);

  useEffect(() => {
    buildingsEnabledRef.current = buildingsEnabled;
    if (map.current && map.current.isStyleLoaded()) {
      add3D(true);
    }
  }, [buildingsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    handleRecenter: () => {
      if (map.current && userLocation) {
        const { lngOffset, latOffset } = getDecorations(currentUserId);
        const nextCameraMode = getNextCameraMode(cameraMode);
        const naturalHeading = userLocation.heading ?? deviceHeading ?? map.current.getBearing();
        const target =
          nextCameraMode === CAMERA_MODES.TOP
            ? { pitch: 0, bearing: 0, duration: 1280 }
            : nextCameraMode === CAMERA_MODES.CINEMATIC
              ? { pitch: 54, bearing: naturalHeading, duration: 1420 }
              : { pitch: 73, bearing: naturalHeading, duration: 1540 };

        map.current.easeTo({
          center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
          pitch: target.pitch,
          bearing: target.bearing,
          duration: target.duration,
          easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
          essential: true,
        });

        setCameraMode(nextCameraMode);
      }
    },
    resetBearing: () => {
      if (!map.current) return;
      map.current.easeTo({
        bearing: 0,
        duration: 980,
        easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        essential: true,
      });
    },
    handleCenterOnUser: (lng, lat) => {
      if (map.current) {
        map.current.easeTo({ center: [lng, lat], zoom: 16, duration: 1200, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
      }
    },
  }));

  // 🎯 Update user location marker
  useEffect(() => {
    if (!map.current || !userLocation || !currentUserId) return;

    const { lng, lat, heading } = userLocation;
    const effectiveHeading = heading ?? deviceHeading;
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

    if (effectiveHeading !== null && effectiveHeading !== undefined) {
      cone.style.transform = `rotate(${effectiveHeading - map.current.getBearing()}deg)`;
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
  }, [userLocation, theme, isFollowing, currentUserId, cameraMode, deviceHeading]); // eslint-disable-line react-hooks/exhaustive-deps

  const add3D = (force = false) => {
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
      !force &&
      existingExtrusionLayer?.id === BUILDING_LAYER_ID &&
      accentLayersReady &&
      map.current.__orbitBuildingThemeApplied === themeRef.current &&
      map.current.__orbitBuildingsEnabled === buildingsEnabledRef.current
    ) {
      return;
    }

    if (existingExtrusionLayer) {
      baseBuildingLayers.forEach((layer) => {
        if (layer.id !== existingExtrusionLayer.id && map.current.getLayer(layer.id)) {
          map.current.removeLayer(layer.id);
        }
      });
      applyBuildingPaint(map.current, existingExtrusionLayer.id, themeRef.current, buildingsEnabledRef.current);
      syncBuildingAccentLayers(
        map.current,
        existingExtrusionLayer.source,
        existingExtrusionLayer["source-layer"],
        existingExtrusionLayer.filter,
        themeRef.current,
        layers.slice(layers.indexOf(existingExtrusionLayer) + 1).find((layer) => !isBuildingSourceLayer(layer))?.id,
        buildingsEnabledRef.current
      );
      map.current.__orbitBuildingThemeApplied = themeRef.current;
      map.current.__orbitBuildingsEnabled = buildingsEnabledRef.current;
      return;
    }

    const buildingLayer = baseBuildingLayers.find((layer) => layer.source && layer["source-layer"]);
    if (!buildingLayer) {
      removeBuildingAccentLayers(map.current);
      map.current.__orbitBuildingThemeApplied = null;
      map.current.__orbitBuildingsEnabled = null;
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
      paint: buildingsEnabledRef.current
        ? getBuildingPaint(themeRef.current)
        : {
            ...getBuildingPaint(themeRef.current),
            "fill-extrusion-height": 0,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0,
          },
      ...(buildingLayer.filter ? { filter: buildingLayer.filter } : {}),
    };

    map.current.addLayer(
      extrusionLayer,
      beforeLayerId && map.current.getLayer(beforeLayerId) ? beforeLayerId : undefined
    );
    applyBuildingLighting(map.current, themeRef.current);
    applyBuildingPaint(map.current, BUILDING_LAYER_ID, themeRef.current, buildingsEnabledRef.current);
    syncBuildingAccentLayers(
      map.current,
      source,
      sourceLayer,
      buildingLayer.filter,
      themeRef.current,
      beforeLayerId,
      buildingsEnabledRef.current
    );
    map.current.__orbitBuildingThemeApplied = themeRef.current;
    map.current.__orbitBuildingsEnabled = buildingsEnabledRef.current;
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

