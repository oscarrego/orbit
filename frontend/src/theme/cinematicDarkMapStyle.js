export const DARK_MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CARTO_SOURCE_ID = "carto";
const TRANSPORTATION_SOURCE_LAYER = "transportation";

const HIGHWAY_CLASSES = [
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link"
];

const SECONDARY_CLASSES = ["secondary", "tertiary"];

const highwayFilter = ["all", ["in", "class", ...HIGHWAY_CLASSES]];
const secondaryFilter = ["all", ["in", "class", ...SECONDARY_CLASSES]];

const highwayWidth = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  9,  0.7,
  11, 1.4,
  13, 3.1,
  15, 7,
  17, 15,
  19, 28
];

const highwayOuterGlowWidth = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  9,  2.0,
  11, 4.5,
  13, 11,
  15, 28,
  17, 56,
  19, 92
];

const highwayMidGlowWidth = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  9,  1.2,
  11, 2.8,
  13, 7,
  15, 18,
  17, 38,
  19, 64
];

const secondaryWidth = [
  "interpolate",
  ["exponential", 1.35],
  ["zoom"],
  11, 0.35,
  13, 0.9,
  15, 2.1,
  17, 5.2,
  19, 9
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const setPaint = (mapInstance, layerId, property, value) => {
  if (!mapInstance.getLayer(layerId)) return;
  try {
    mapInstance.setPaintProperty(layerId, property, clone(value));
  } catch (error) {
    console.warn(`Unable to set ${property} on ${layerId}:`, error);
  }
};

const insertBeforeBuilding = (mapInstance) => {
  const style = mapInstance.getStyle();
  const buildingLayer = style.layers?.find(
    (layer) =>
      layer.source === CARTO_SOURCE_ID &&
      typeof layer["source-layer"] === "string" &&
      layer["source-layer"].toLowerCase().includes("building")
  );

  if (buildingLayer && mapInstance.getLayer(buildingLayer.id)) {
    return buildingLayer.id;
  }

  const firstLabelLayer = style.layers?.find((layer) => layer.type === "symbol");
  return firstLabelLayer?.id;
};

const addLineLayer = (mapInstance, layer, beforeLayerId) => {
  if (mapInstance.getLayer(layer.id)) return;

  mapInstance.addLayer(
    {
      source: CARTO_SOURCE_ID,
      "source-layer": TRANSPORTATION_SOURCE_LAYER,
      type: "line",
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      ...layer
    },
    beforeLayerId && mapInstance.getLayer(beforeLayerId) ? beforeLayerId : undefined
  );
};

// ── Cinematic Highway Layers ─────────────────────────────────────────────────
// 4-pass system: volumetric outer diffusion → mid bloom → bright core → hot highlight
const cinematicHighwayLayers = [
  // Pass 0 — Volumetric atmospheric diffusion (widest, softest, low opacity)
  {
    id: "orbit-highway-atmosphere",
    filter: highwayFilter,
    paint: {
      "line-color": "rgba(255,172,60,0.14)",
      "line-width": [
        "interpolate", ["exponential", 1.45], ["zoom"],
        9, 4, 11, 9, 13, 20, 15, 48, 17, 90, 19, 140
      ],
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        10, 18, 14, 28, 17, 42, 19, 58
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        9, 0, 11, 0.12, 14, 0.22, 17, 0.34
      ]
    }
  },
  // Pass 1 — Outer cinematic bloom glow
  {
    id: "orbit-highway-outer-glow",
    filter: highwayFilter,
    paint: {
      "line-color": "rgba(255,179,71,0.26)",
      "line-width": clone(highwayOuterGlowWidth),
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        10, 9, 14, 18, 17, 28, 19, 40
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        9, 0, 11, 0.22, 14, 0.36, 17, 0.52
      ]
    }
  },
  // Pass 2 — Mid bloom glow
  {
    id: "orbit-highway-mid-glow",
    filter: highwayFilter,
    paint: {
      "line-color": "#ffb347",
      "line-width": clone(highwayMidGlowWidth),
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        10, 4, 14, 9, 17, 16, 19, 24
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        9, 0, 11, 0.34, 14, 0.58, 17, 0.74
      ]
    }
  },
  // Pass 3 — Bright golden core
  {
    id: "orbit-highway-core",
    filter: highwayFilter,
    paint: {
      "line-color": "#ffd36b",
      "line-width": clone(highwayWidth),
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        10, 0.5, 14, 0.8, 17, 1.4
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        9, 0, 11, 0.62, 14, 0.88, 17, 0.98
      ]
    }
  },
  // Pass 4 — Hot white center highlight (cinematic specularity)
  {
    id: "orbit-highway-center-highlight",
    filter: highwayFilter,
    paint: {
      "line-color": "#fff8e0",
      "line-width": [
        "interpolate", ["exponential", 1.35], ["zoom"],
        10, 0.28, 13, 0.75, 15, 1.5, 17, 3.0, 19, 5.5
      ],
      "line-blur": 0.12,
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        10, 0, 12, 0.64, 15, 0.94, 18, 1
      ]
    }
  },
  // Secondary corridors carry a faint warm spill so the grid sits inside the city glow.
  {
    id: "orbit-secondary-road-warm-bounce",
    filter: secondaryFilter,
    paint: {
      "line-color": "rgba(255,185,92,0.20)",
      "line-width": [
        "interpolate", ["exponential", 1.35], ["zoom"],
        11, 1.4, 13, 3.2, 15, 8.5, 17, 17, 19, 30
      ],
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        11, 2.4, 14, 5.5, 17, 10, 19, 16
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        10, 0, 12, 0.12, 15, 0.26, 18, 0.34
      ]
    }
  },
  // Secondary roads — subtle steel-blue depth
  {
    id: "orbit-secondary-road-depth",
    filter: secondaryFilter,
    paint: {
      "line-color": "#6a7a8a",
      "line-width": clone(secondaryWidth),
      "line-blur": [
        "interpolate", ["linear"], ["zoom"],
        11, 0.2, 15, 0.8, 18, 1.6
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        11, 0.14, 14, 0.32, 17, 0.48
      ]
    }
  }
];

// ── Terrain & Environment ─────────────────────────────────────────────────────
// Key principle: avoid pure black (#000). Use very dark warm/cool greys with
// subtle saturation so depth gradients and atmospheric perspective read correctly.
const styleGroundAndWater = (mapInstance, env) => {
  const bg=env?.background||"#1c2024", lcL=env?.landcoverLow||"#20242a", lcH=env?.landcoverHigh||"#343a43";
  const rlL=env?.residentialLow||"#232830", rlH=env?.residentialHigh||"#3a414b", lu=env?.landuse||"#333941";
  const pk=env?.park||"#263628", wL=env?.waterLow||"#101b24", wH=env?.waterHigh||"#203746";
  const wO=env?.waterOutline||"#2b4658", wS=env?.waterShadow||"#25465a", ww=env?.waterway||"#2b5668";
  setPaint(mapInstance, "background", "background-color", bg);

  // Landcover — subtly visible, layered with depth
  setPaint(mapInstance, "landcover", "fill-color", [
    "interpolate", ["linear"], ["zoom"],
    6, lcL, 10, lcL, 13, lcL, 16, lcH
  ]);
  setPaint(mapInstance, "landcover", "fill-opacity", [
    "interpolate", ["linear"], ["zoom"],
    6, 0.72, 12, 0.88, 16, 0.95
  ]);

  // Residential areas — slightly lighter than base, warm grey
  setPaint(mapInstance, "landuse_residential", "fill-color", [
    "interpolate", ["linear"], ["zoom"],
    6, rlL, 12, rlL, 16, rlH
  ]);
  setPaint(mapInstance, "landuse_residential", "fill-opacity", [
    "interpolate", ["linear"], ["zoom"],
    6, 0.64, 12, 0.86, 16, 0.94
  ]);

  // General landuse — warm-toned dark grey
  setPaint(mapInstance, "landuse", "fill-color", lu);
  setPaint(mapInstance, "landuse", "fill-opacity", 0.82);

  // Parks — dark muted green, not pitch black
  setPaint(mapInstance, "park_national_park", "fill-color", pk);
  setPaint(mapInstance, "park_nature_reserve", "fill-color", pk);

  // Water — deep atmospheric teal, no pure black
  setPaint(mapInstance, "water", "fill-color", [
    "interpolate", ["linear"], ["zoom"],
    0, wL, 8, wL, 12, wL, 16, wH
  ]);
  setPaint(mapInstance, "water", "fill-outline-color", wO);
  setPaint(mapInstance, "water", "fill-opacity", 1);

  // Water shadow — soft atmospheric glow at edges
  setPaint(mapInstance, "water_shadow", "fill-color", wS);
  setPaint(mapInstance, "water_shadow", "fill-opacity", [
    "interpolate", ["linear"], ["zoom"],
    8, 0.22, 13, 0.44, 17, 0.66
  ]);

  // Waterways — atmospheric teal-blue
  setPaint(mapInstance, "waterway", "line-color", ww);
  setPaint(mapInstance, "waterway", "line-opacity", 0.84);
  setPaint(mapInstance, "waterway", "line-width", [
    "interpolate", ["exponential", 1.3], ["zoom"],
    8, 0.5, 13, 1.6, 16, 3.6
  ]);
};

// ── Road Hierarchy ────────────────────────────────────────────────────────────
// Major roads get warm amber tones. Secondary gets cool steel.
// Minor roads stay nearly invisible to not pollute the atmosphere.
const styleRoadHierarchy = (mapInstance) => {
  const layers = mapInstance.getStyle().layers || [];

  layers.forEach((layer) => {
    if (layer.type !== "line") return;

    const id = layer.id;
    const isCase = id.includes("_case");
    const isMajor = id.includes("_mot_") || id.includes("_trunk_") || id.includes("_pri_");
    const isSecondary = id.includes("_sec_");
    const isMinor =
      id.includes("_minor_") ||
      id.includes("_service_") ||
      id.includes("_path") ||
      id.includes("aeroway");
    const isTunnel = id.includes("tunnel");
    const isBridge = id.includes("bridge");

    if (isMajor) {
      // Warm amber undertone — road surface feels illuminated
      setPaint(mapInstance, id, "line-color", isCase ? "#332a1e" : "#a87842");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.32 : isCase ? 0.4 : 0.56);
      setPaint(mapInstance, id, "line-blur", isCase ? 1.0 : 0.3);
      return;
    }

    if (isSecondary) {
      // Cool steel-blue — atmospheric depth
      setPaint(mapInstance, id, "line-color", isCase ? "#323840" : "#747d89");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.28 : isBridge ? 0.78 : 0.64);
      setPaint(mapInstance, id, "line-blur", isCase ? 0.5 : 0.1);
      return;
    }

    if (isMinor) {
      // Barely visible, just enough to feel textured
      setPaint(mapInstance, id, "line-color", isCase ? "#2c3136" : "#565d66");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.18 : isBridge ? 0.56 : 0.42);
      setPaint(mapInstance, id, "line-blur", isCase ? 0.4 : 0);
      return;
    }

    if (id.includes("rail")) {
      setPaint(mapInstance, id, "line-color", "#32383e");
      setPaint(mapInstance, id, "line-opacity", 0.28);
    }
  });
};

// ── Labels ────────────────────────────────────────────────────────────────────
// Cinematic label rendering: soft halos, warm highway names, readable but not harsh.
const styleLabels = (mapInstance) => {
  const layers = mapInstance.getStyle().layers || [];

  layers.forEach((layer) => {
    if (layer.type !== "symbol") return;

    const id = layer.id;
    const isPlace = id.includes("place");
    const isCity = id.includes("city") || id.includes("capital");
    const isCountry = id.includes("country") || id.includes("state") || id.includes("continent");
    const isRoadName = id.includes("roadname");
    const isMajorRoadName = id.includes("major") || id.includes("pri");
    const isPoi = id.includes("poi");
    const isWater = id.includes("water");
    const isHouseNumber = id.includes("housenumber");

    // Universal halo — dark with enough opacity to separate text from terrain
    setPaint(mapInstance, id, "text-halo-color", "rgba(8,10,14,0.92)");
    setPaint(mapInstance, id, "text-halo-width", isPlace || isRoadName ? 1.9 : 1.4);
    setPaint(mapInstance, id, "text-halo-blur", 0.22);
    setPaint(mapInstance, id, "text-opacity", isHouseNumber ? 0.42 : 0.9);

    if (isCity) {
      // Slightly cool-white — moonlight on city signs
      setPaint(mapInstance, id, "text-color", "#d2dce8");
      setPaint(mapInstance, id, "icon-color", "#9ab0c4");
      return;
    }

    if (isCountry) {
      setPaint(mapInstance, id, "text-color", "#bfccd8");
      setPaint(mapInstance, id, "icon-color", "#7e90a4");
      return;
    }

    if (isPlace) {
      setPaint(mapInstance, id, "text-color", "#a8b8c8");
      setPaint(mapInstance, id, "icon-color", "#7a8c9e");
      return;
    }

    if (isMajorRoadName) {
      // Warm gold — matches the highway glow system
      setPaint(mapInstance, id, "text-color", "#f0d07e");
      setPaint(mapInstance, id, "text-halo-color", "rgba(4,5,7,0.88)");
      setPaint(mapInstance, id, "text-halo-width", 2.1);
      return;
    }

    if (isRoadName) {
      setPaint(mapInstance, id, "text-color", "#a8adb4");
      return;
    }

    if (isWater) {
      setPaint(mapInstance, id, "text-color", "#7aaec8");
      setPaint(mapInstance, id, "text-halo-color", "rgba(4,10,18,0.90)");
      return;
    }

    if (isPoi) {
      const poiColor = id.includes("park") ? "#7fbd6e" : "#c8a860";
      setPaint(mapInstance, id, "text-color", poiColor);
      setPaint(mapInstance, id, "icon-color", poiColor);
      setPaint(mapInstance, id, "text-opacity", 0.82);
    }
  });
};

const addCinematicRoadLayers = (mapInstance) => {
  if (!mapInstance.getSource(CARTO_SOURCE_ID)) return;

  const beforeLayerId = insertBeforeBuilding(mapInstance);
  cinematicHighwayLayers.forEach((layer) => addLineLayer(mapInstance, layer, beforeLayerId));
};

export const applyCinematicDarkMapStyle = (mapInstance, env) => {
  if (!mapInstance || !mapInstance.isStyleLoaded()) return;

  const cinematicLayersReady = cinematicHighwayLayers.every((layer) => mapInstance.getLayer(layer.id));
  if (mapInstance.__orbitCinematicDarkApplied && cinematicLayersReady && !env) return;

  styleGroundAndWater(mapInstance, env);
  styleRoadHierarchy(mapInstance);
  styleLabels(mapInstance);
  addCinematicRoadLayers(mapInstance);

  mapInstance.__orbitCinematicDarkApplied = true;
};

export const applyEnvironmentToMap = (mapInstance, env) => {
  if (!mapInstance || !mapInstance.isStyleLoaded()) return;
  styleGroundAndWater(mapInstance, env);
};
