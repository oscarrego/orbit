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
  9,
  0.7,
  11,
  1.4,
  13,
  3.1,
  15,
  7,
  17,
  15,
  19,
  28
];

const highwayOuterGlowWidth = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  9,
  1.5,
  11,
  3.2,
  13,
  8.5,
  15,
  22,
  17,
  46,
  19,
  78
];

const highwayMidGlowWidth = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  9,
  1,
  11,
  2.3,
  13,
  6,
  15,
  15,
  17,
  32,
  19,
  56
];

const secondaryWidth = [
  "interpolate",
  ["exponential", 1.35],
  ["zoom"],
  11,
  0.35,
  13,
  0.9,
  15,
  2.1,
  17,
  5.2,
  19,
  9
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

const cinematicHighwayLayers = [
  {
    id: "orbit-highway-outer-glow",
    filter: highwayFilter,
    paint: {
      "line-color": "rgba(255,179,71,0.22)",
      "line-width": clone(highwayOuterGlowWidth),
      "line-blur": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        7,
        14,
        14,
        17,
        22,
        19,
        32
      ],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        0,
        11,
        0.18,
        14,
        0.28,
        17,
        0.42
      ]
    }
  },
  {
    id: "orbit-highway-mid-glow",
    filter: highwayFilter,
    paint: {
      "line-color": "#ffb347",
      "line-width": clone(highwayMidGlowWidth),
      "line-blur": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        3,
        14,
        7,
        17,
        13,
        19,
        20
      ],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        0,
        11,
        0.3,
        14,
        0.5,
        17,
        0.68
      ]
    }
  },
  {
    id: "orbit-highway-core",
    filter: highwayFilter,
    paint: {
      "line-color": "#ffd36b",
      "line-width": clone(highwayWidth),
      "line-blur": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.4,
        14,
        0.7,
        17,
        1.2
      ],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        0,
        11,
        0.58,
        14,
        0.86,
        17,
        0.98
      ]
    }
  },
  {
    id: "orbit-highway-center-highlight",
    filter: highwayFilter,
    paint: {
      "line-color": "#fff3c2",
      "line-width": [
        "interpolate",
        ["exponential", 1.35],
        ["zoom"],
        10,
        0.25,
        13,
        0.7,
        15,
        1.35,
        17,
        2.8,
        19,
        5
      ],
      "line-blur": 0.15,
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0,
        12,
        0.62,
        15,
        0.92,
        18,
        1
      ]
    }
  },
  {
    id: "orbit-secondary-road-depth",
    filter: secondaryFilter,
    paint: {
      "line-color": "#758294",
      "line-width": clone(secondaryWidth),
      "line-blur": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.2,
        15,
        0.7,
        18,
        1.4
      ],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.12,
        14,
        0.28,
        17,
        0.42
      ]
    }
  }
];

const styleGroundAndWater = (mapInstance) => {
  setPaint(mapInstance, "background", "background-color", "#1c2128");

  setPaint(mapInstance, "landcover", "fill-color", [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    "#1b2027",
    12,
    "#20252d",
    16,
    "#252a33"
  ]);
  setPaint(mapInstance, "landcover", "fill-opacity", 0.72);

  setPaint(mapInstance, "landuse_residential", "fill-color", [
    "interpolate",
    ["linear"],
    ["zoom"],
    6,
    "#1a1f26",
    12,
    "#20252d",
    16,
    "#252a33"
  ]);
  setPaint(mapInstance, "landuse_residential", "fill-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    6,
    0.55,
    12,
    0.82,
    16,
    0.92
  ]);

  setPaint(mapInstance, "landuse", "fill-color", "#222b30");
  setPaint(mapInstance, "landuse", "fill-opacity", 0.64);

  setPaint(mapInstance, "park_national_park", "fill-color", "#203027");
  setPaint(mapInstance, "park_nature_reserve", "fill-color", "#203027");

  setPaint(mapInstance, "water", "fill-color", [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    "#0b1726",
    10,
    "#10233a",
    14,
    "#13263d",
    17,
    "#15304d"
  ]);
  setPaint(mapInstance, "water", "fill-outline-color", "#1a3654");
  setPaint(mapInstance, "water", "fill-opacity", 1);

  setPaint(mapInstance, "water_shadow", "fill-color", "#1a3654");
  setPaint(mapInstance, "water_shadow", "fill-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    0.18,
    13,
    0.36,
    17,
    0.58
  ]);

  setPaint(mapInstance, "waterway", "line-color", "#1a3654");
  setPaint(mapInstance, "waterway", "line-opacity", 0.82);
  setPaint(mapInstance, "waterway", "line-width", [
    "interpolate",
    ["exponential", 1.3],
    ["zoom"],
    8,
    0.45,
    13,
    1.4,
    16,
    3.2
  ]);
};

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
      setPaint(mapInstance, id, "line-color", isCase ? "#3a2f26" : "#b9823e");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.38 : isCase ? 0.44 : 0.62);
      setPaint(mapInstance, id, "line-blur", isCase ? 1.2 : 0.35);
      return;
    }

    if (isSecondary) {
      setPaint(mapInstance, id, "line-color", isCase ? "#303744" : "#667284");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.28 : isBridge ? 0.78 : 0.66);
      setPaint(mapInstance, id, "line-blur", isCase ? 0.55 : 0.12);
      return;
    }

    if (isMinor) {
      setPaint(mapInstance, id, "line-color", isCase ? "#242a33" : "#48515f");
      setPaint(mapInstance, id, "line-opacity", isTunnel ? 0.18 : isBridge ? 0.58 : 0.46);
      setPaint(mapInstance, id, "line-blur", isCase ? 0.45 : 0);
      return;
    }

    if (id.includes("rail")) {
      setPaint(mapInstance, id, "line-color", "#354150");
      setPaint(mapInstance, id, "line-opacity", 0.34);
    }
  });
};

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

    setPaint(mapInstance, id, "text-halo-color", "rgba(10,12,16,0.9)");
    setPaint(mapInstance, id, "text-halo-width", isPlace || isRoadName ? 1.8 : 1.35);
    setPaint(mapInstance, id, "text-halo-blur", 0.25);
    setPaint(mapInstance, id, "text-opacity", isHouseNumber ? 0.45 : 0.92);

    if (isCity) {
      setPaint(mapInstance, id, "text-color", "#d8e1ec");
      setPaint(mapInstance, id, "icon-color", "#9fb1c4");
      return;
    }

    if (isCountry) {
      setPaint(mapInstance, id, "text-color", "#c3cfdd");
      setPaint(mapInstance, id, "icon-color", "#8392a5");
      return;
    }

    if (isPlace) {
      setPaint(mapInstance, id, "text-color", "#aebccd");
      setPaint(mapInstance, id, "icon-color", "#7e8fa2");
      return;
    }

    if (isMajorRoadName) {
      setPaint(mapInstance, id, "text-color", "#f4d88a");
      setPaint(mapInstance, id, "text-halo-color", "rgba(4,5,7,0.86)");
      setPaint(mapInstance, id, "text-halo-width", 2);
      return;
    }

    if (isRoadName) {
      setPaint(mapInstance, id, "text-color", "#aeb8c6");
      return;
    }

    if (isWater) {
      setPaint(mapInstance, id, "text-color", "#8fb1d4");
      setPaint(mapInstance, id, "text-halo-color", "rgba(4,10,18,0.88)");
      return;
    }

    if (isPoi) {
      const poiColor = id.includes("park") ? "#9fce87" : "#d7b46a";
      setPaint(mapInstance, id, "text-color", poiColor);
      setPaint(mapInstance, id, "icon-color", poiColor);
      setPaint(mapInstance, id, "text-opacity", 0.84);
    }
  });
};

const addCinematicRoadLayers = (mapInstance) => {
  if (!mapInstance.getSource(CARTO_SOURCE_ID)) return;

  const beforeLayerId = insertBeforeBuilding(mapInstance);
  cinematicHighwayLayers.forEach((layer) => addLineLayer(mapInstance, layer, beforeLayerId));
};

export const applyCinematicDarkMapStyle = (mapInstance) => {
  if (!mapInstance || !mapInstance.isStyleLoaded()) return;

  const cinematicLayersReady = cinematicHighwayLayers.every((layer) => mapInstance.getLayer(layer.id));
  if (mapInstance.__orbitCinematicDarkApplied && cinematicLayersReady) return;

  styleGroundAndWater(mapInstance);
  styleRoadHierarchy(mapInstance);
  styleLabels(mapInstance);
  addCinematicRoadLayers(mapInstance);

  mapInstance.__orbitCinematicDarkApplied = true;
};
