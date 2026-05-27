export const BUILDING_LAYER_ID = "orbit-3d-buildings";
export const BUILDING_2D_LAYER_ID = "orbit-2d-buildings";
export const BUILDING_ROOF_LAYER_ID = "orbit-3d-building-roofs";
export const BUILDING_TERRAIN_BLEND_LAYER_ID = "orbit-building-terrain-blend";
export const BUILDING_ROAD_BOUNCE_LAYER_ID = "orbit-building-road-bounce";
export const BUILDING_ATMOSPHERE_LAYER_ID = "orbit-building-atmosphere-veil";
export const SKYSCRAPER_UPPER_LIGHT_LAYER_ID = "orbit-skyscraper-upper-light";
export const SKYSCRAPER_CROWN_LIGHT_LAYER_ID = "orbit-skyscraper-crown-light";
export const SKYSCRAPER_WINDOW_BAND_LAYER_IDS = [
  "orbit-skyscraper-window-band-a",
  "orbit-skyscraper-window-band-b",
  "orbit-skyscraper-window-band-c",
  "orbit-skyscraper-window-band-d"
];
export const SKYSCRAPER_BAND_LAYER_IDS = [
  "orbit-skyscraper-shadow-band-a",
  "orbit-skyscraper-shadow-band-b",
  "orbit-skyscraper-shadow-band-c"
];
export const BUILDING_ACCENT_LAYER_IDS = [
  BUILDING_TERRAIN_BLEND_LAYER_ID,
  BUILDING_ROAD_BOUNCE_LAYER_ID,
  BUILDING_ATMOSPHERE_LAYER_ID,
  BUILDING_ROOF_LAYER_ID,
  SKYSCRAPER_UPPER_LIGHT_LAYER_ID,
  SKYSCRAPER_CROWN_LIGHT_LAYER_ID,
  ...SKYSCRAPER_WINDOW_BAND_LAYER_IDS,
  ...SKYSCRAPER_BAND_LAYER_IDS
];
export const BUILDING_SOURCE_LAYER = "building";
export const BUILDING_MIN_ZOOM = 11;
export const BUILDING_2D_MIN_ZOOM = 10;
export const BUILDING_3D_MIN_ZOOM = 13;

const BUILDING_ID_NUMBER_EXPRESSION = [
  "abs",
  ["case", ["==", ["id"], null], 17, ["to-number", ["id"], 17]]
];

const BUILDING_TONE_BUCKET_EXPRESSION = ["%", BUILDING_ID_NUMBER_EXPRESSION, 6];

// Buildings grade through cool/warm charcoal families so districts do not read
// as one flat matte mass. Height still controls the downtown weight.
const DARK_BUILDING_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 10, ["to-number", ["get", "render_height"], 24]],
  "tone",
  BUILDING_TONE_BUCKET_EXPRESSION,
  [
    "case",
    ["<", ["var", "tone"], 2],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#3b3334",
      22, "#5a463e",
      55, "#6b5245",
      105, "#5a4842",
      180, "#43393a"
    ],
    ["<", ["var", "tone"], 4],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#363132",
      22, "#51413b",
      55, "#604a40",
      105, "#52423e",
      180, "#3f3637"
    ],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#3f3431",
      22, "#60483d",
      55, "#705243",
      105, "#5d463e",
      180, "#443735"
    ]
  ]
];

const LIGHT_BUILDING_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 10, ["to-number", ["get", "render_height"], 24]],
  "tone",
  BUILDING_TONE_BUCKET_EXPRESSION,
  [
    "case",
    ["<", ["var", "tone"], 2],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#d6dbe2",
      35, "#d0d6de",
      80, "#c8d0da",
      150, "#bcc6d2",
      220, "#aebac7"
    ],
    ["<", ["var", "tone"], 4],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#dde1e7",
      35, "#d7dce3",
      80, "#ced5de",
      150, "#c2cad5",
      220, "#b4bfcb"
    ],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#d2d8df",
      35, "#cbd2db",
      80, "#c3ccd6",
      150, "#b8c3cf",
      220, "#abb7c4"
    ]
  ]
];

const PROCEDURAL_BUILDING_HEIGHT_EXPRESSION = [
  "+",
  16,
  ["*", 3, ["%", BUILDING_ID_NUMBER_EXPRESSION, 9]],
  ["*", 2, ["%", ["floor", ["/", BUILDING_ID_NUMBER_EXPRESSION, 13]], 7]]
];

const BUILDING_BASE_VALUE_EXPRESSION = [
  "case",
  ["has", "render_min_height"],
  ["to-number", ["get", "render_min_height"], 0],
  ["has", "min_height"],
  ["to-number", ["get", "min_height"], 0],
  ["has", "building:min_height"],
  ["to-number", ["get", "building:min_height"], 0],
  0
];

const BUILDING_RAW_HEIGHT_EXPRESSION = [
  "case",
  ["has", "render_height"],
  ["to-number", ["get", "render_height"], PROCEDURAL_BUILDING_HEIGHT_EXPRESSION],
  ["has", "height"],
  ["to-number", ["get", "height"], PROCEDURAL_BUILDING_HEIGHT_EXPRESSION],
  ["has", "building:height"],
  ["to-number", ["get", "building:height"], PROCEDURAL_BUILDING_HEIGHT_EXPRESSION],
  ["has", "levels"],
  ["*", 3.4, ["to-number", ["get", "levels"], 5]],
  ["has", "building:levels"],
  ["*", 3.4, ["to-number", ["get", "building:levels"], 5]],
  PROCEDURAL_BUILDING_HEIGHT_EXPRESSION
];

const BUILDING_FULL_HEIGHT_EXPRESSION = [
  "let",
  "base",
  BUILDING_BASE_VALUE_EXPRESSION,
  "raw",
  BUILDING_RAW_HEIGHT_EXPRESSION,
  ["min", 300, ["max", ["+", ["var", "base"], 8], ["*", 1.45, ["max", 10, ["var", "raw"]]]]]
];

const BUILDING_HEIGHT_EXPRESSION = [
  "let",
  "base",
  BUILDING_BASE_VALUE_EXPRESSION,
  "raw",
  BUILDING_RAW_HEIGHT_EXPRESSION,
  [
    "interpolate",
    ["linear"],
    ["zoom"],
    11,
    0,
    12,
    [
      "*",
      0.25,
      ["min", 300, ["max", ["+", ["var", "base"], 8], ["*", 1.45, ["max", 10, ["var", "raw"]]]]]
    ],
    13,
    [
      "*",
      0.60,
      ["min", 300, ["max", ["+", ["var", "base"], 8], ["*", 1.45, ["max", 10, ["var", "raw"]]]]]
    ],
    14,
    [
      "*",
      0.88,
      ["min", 300, ["max", ["+", ["var", "base"], 8], ["*", 1.45, ["max", 10, ["var", "raw"]]]]]
    ],
    15,
    BUILDING_FULL_HEIGHT_EXPRESSION
  ]
];

const BUILDING_BASE_EXPRESSION = [
  "let",
  "base",
  BUILDING_BASE_VALUE_EXPRESSION,
  [
    "interpolate",
    ["linear"],
    ["zoom"],
    11,
    0,
    12,
    ["*", 0.25, ["var", "base"]],
    13,
    ["*", 0.60, ["var", "base"]],
    14,
    ["*", 0.88, ["var", "base"]],
    15,
    ["var", "base"]
  ]
];

const BUILDING_OPACITY_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  11,
  0,
  11.5,
  0.55,
  12,
  0.82,
  13,
  1
];

const LIGHT_BUILDING_OPACITY_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  11,
  0,
  12,
  0.42,
  13,
  0.65,
  14,
  0.82,
  16,
  0.92
];

const cloneExpression = (value) =>
  Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value;

// Rooftops catch slightly more atmospheric ambient light than walls.
// They should be slightly lighter and cooler than the wall base colour.
const DARK_ROOF_COLOR_EXPRESSION = [
  "let",
  "tone",
  BUILDING_TONE_BUCKET_EXPRESSION,
  [
    "case",
    ["<", ["var", "tone"], 2], "#6e5649",
    ["<", ["var", "tone"], 4], "#634d43",
    "#735846"
  ]
];

const LIGHT_ROOF_COLOR_EXPRESSION = [
  "let",
  "tone",
  BUILDING_TONE_BUCKET_EXPRESSION,
  [
    "case",
    ["<", ["var", "tone"], 2], "#e6ebf1",
    ["<", ["var", "tone"], 4], "#eaf0f5",
    "#e1e7ee"
  ]
];

const TALL_BUILDING_FILTER = [
  ">=",
  ["max", 0, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  48
];

const LOW_BUILDING_FILTER = [
  "<",
  ["max", 0, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  48
];

// Upper-third of skyscrapers — warm diffuse light from city-glow ambience.
// Opacity kept very low so it only appears as a subtle depth gradient.
const SKYSCRAPER_UPPER_LIGHT_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 48, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  [
    "interpolate",
    ["linear"],
    ["var", "height"],
    48,
    "#5d4b45",
    90,
    "#665247",
    150,
    "#735b4d",
    220,
    "#806655"
  ]
];

// Crown region — most exposed to overcast sky + distant urban glow.
// Taller buildings catch more atmospheric light at their apex.
const SKYSCRAPER_CROWN_LIGHT_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 48, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  [
    "interpolate",
    ["linear"],
    ["var", "height"],
    48,
    "#70584b",
    110,
    "#7c6252",
    180,
    "#896b58",
    250,
    "#96765f"
  ]
];

const LIGHT_SKYSCRAPER_UPPER_LIGHT_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 48, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  [
    "interpolate",
    ["linear"],
    ["var", "height"],
    48,
    "#e9edf2",
    90,
    "#e1e7ee",
    150,
    "#d9e1ea",
    220,
    "#ced9e4"
  ]
];

const LIGHT_SKYSCRAPER_CROWN_LIGHT_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 48, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)],
  [
    "interpolate",
    ["linear"],
    ["var", "height"],
    48,
    "#f8fafc",
    110,
    "#eef3f8",
    180,
    "#e4ebf3",
    250,
    "#d9e3ed"
  ]
];

const mergeFilters = (baseFilter, accentFilter) =>
  baseFilter
    ? ["all", cloneExpression(baseFilter), cloneExpression(accentFilter)]
    : cloneExpression(accentFilter);

const buildingHeightAtRatio = (ratio) => [
  "let",
  "base",
  cloneExpression(BUILDING_BASE_VALUE_EXPRESSION),
  "top",
  cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
  [
    "+",
    ["var", "base"],
    ["*", ratio, ["max", 0, ["-", ["var", "top"], ["var", "base"]]]]
  ]
];

const buildingRoofBaseExpression = [
  "max",
  cloneExpression(BUILDING_BASE_VALUE_EXPRESSION),
  ["-", cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION), 1.4]
];

const getSkyscraperBandLayer = (id, ratio, source, sourceLayer, baseFilter) => {
  const bandBase = buildingHeightAtRatio(ratio);

  return {
    id,
    source,
    "source-layer": sourceLayer,
    type: "fill-extrusion",
    minzoom: BUILDING_MIN_ZOOM + 1,
    filter: mergeFilters(baseFilter, TALL_BUILDING_FILTER),
    paint: {
      "fill-extrusion-color": "#211c1d",
      "fill-extrusion-height": ["+", bandBase, 1.05],
      "fill-extrusion-base": bandBase,
      "fill-extrusion-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.5,
        0.22,
        17,
        0.36
      ],
      "fill-extrusion-vertical-gradient": false
    }
  };
};

const getSkyscraperWindowBandLayer = (
  id,
  ratio,
  thickness,
  color,
  maxOpacity,
  source,
  sourceLayer,
  baseFilter
) => {
  const bandBase = buildingHeightAtRatio(ratio);

  return {
    id,
    source,
    "source-layer": sourceLayer,
    type: "fill-extrusion",
    minzoom: BUILDING_MIN_ZOOM + 1,
    filter: mergeFilters(baseFilter, TALL_BUILDING_FILTER),
    paint: {
      "fill-extrusion-color": color,
      "fill-extrusion-height": ["+", bandBase, thickness],
      "fill-extrusion-base": bandBase,
      "fill-extrusion-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.25,
        ["*", maxOpacity, 0.54],
        17,
        maxOpacity,
        19,
        ["*", maxOpacity, 1.08]
      ],
      "fill-extrusion-vertical-gradient": false
    }
  };
};

export const getBuildingPaint = (themeId) => {
  const isLight = themeId === "light";
  return {
    "fill-extrusion-color": cloneExpression(isLight ? LIGHT_BUILDING_COLOR_EXPRESSION : DARK_BUILDING_COLOR_EXPRESSION),
    "fill-extrusion-height": cloneExpression(BUILDING_HEIGHT_EXPRESSION),
    "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
    "fill-extrusion-opacity": cloneExpression(isLight ? LIGHT_BUILDING_OPACITY_EXPRESSION : BUILDING_OPACITY_EXPRESSION),
    "fill-extrusion-vertical-gradient": true
  };
};

export const getBuildingFillPaint = (themeId) => {
  const isLight = themeId === "light";
  return {
    "fill-color": cloneExpression(isLight ? LIGHT_BUILDING_COLOR_EXPRESSION : DARK_BUILDING_COLOR_EXPRESSION),
    "fill-outline-color": isLight ? "rgba(112, 125, 141, 0.30)" : "rgba(245, 245, 245, 0.10)",
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      BUILDING_2D_MIN_ZOOM,
      isLight ? 0.22 : 0.18,
      13.5,
      isLight ? 0.48 : 0.38,
      15,
      isLight ? 0.34 : 0.30
    ]
  };
};

export const getBuildingLight = (themeId) => ({
  anchor: "viewport",
  position: themeId === "light" ? [1.15, 210, 58] : [1.45, 220, 52],
  color: themeId === "light" ? "#ffffff" : "#f0d1b3",
  intensity: themeId === "light" ? 0.55 : 0.78
});

export const getBuildingAccentLayers = (themeId, source, sourceLayer, baseFilter) => {
  const isLight = themeId === "light";
  const terrainBlendTop = [
    "min",
    cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
    ["+", cloneExpression(BUILDING_BASE_VALUE_EXPRESSION), 5.5]
  ];
  const roadBounceTop = [
    "min",
    cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
    ["+", cloneExpression(BUILDING_BASE_VALUE_EXPRESSION), 12]
  ];

  return [
    {
      id: BUILDING_TERRAIN_BLEND_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM,
      filter: mergeFilters(baseFilter, LOW_BUILDING_FILTER),
      paint: {
        "fill-extrusion-color": [
          "let",
          "tone",
          BUILDING_TONE_BUCKET_EXPRESSION,
          [
            "case",
            ["<", ["var", "tone"], 2], isLight ? "#e2e7ee" : "#604b42",
            ["<", ["var", "tone"], 4], isLight ? "#dbe2eb" : "#57463f",
            isLight ? "#d5dee8" : "#6a5042"
          ]
        ],
        "fill-extrusion-height": terrainBlendTop,
        "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14.25, isLight ? 0.08 : 0.12,
          16, isLight ? 0.14 : 0.22,
          18, isLight ? 0.18 : 0.28
        ],
        "fill-extrusion-vertical-gradient": false
      }
    },
    {
      id: BUILDING_ROAD_BOUNCE_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM + 0.35,
      filter: baseFilter ? cloneExpression(baseFilter) : undefined,
      paint: {
        "fill-extrusion-color": [
          "case",
          [">=", ["max", 0, cloneExpression(BUILDING_RAW_HEIGHT_EXPRESSION)], 70],
          isLight ? "#f4f1ea" : "#78604f",
          isLight ? "#ebe8e0" : "#6b5345"
        ],
        "fill-extrusion-height": roadBounceTop,
        "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14.5, isLight ? 0.035 : 0.045,
          16.5, isLight ? 0.075 : 0.095,
          18.5, isLight ? 0.09 : 0.12
        ],
        "fill-extrusion-vertical-gradient": true
      }
    },
    {
      id: BUILDING_ATMOSPHERE_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM + 0.8,
      filter: baseFilter ? cloneExpression(baseFilter) : undefined,
      paint: {
        "fill-extrusion-color": isLight ? "#ffffff" : "#9a7c66",
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.28),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.5, 0,
          15, isLight ? 0.02 : 0.045,
          17, isLight ? 0.038 : 0.075,
          19, isLight ? 0.05 : 0.095
        ],
        "fill-extrusion-vertical-gradient": true
      }
    },
    {
      id: SKYSCRAPER_UPPER_LIGHT_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM + 1,
      filter: mergeFilters(baseFilter, TALL_BUILDING_FILTER),
      paint: {
        "fill-extrusion-color": cloneExpression(isLight ? LIGHT_SKYSCRAPER_UPPER_LIGHT_COLOR_EXPRESSION : SKYSCRAPER_UPPER_LIGHT_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.38),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0,
          15, isLight ? 0.07 : 0.10,
          17, isLight ? 0.12 : 0.18,
          19, isLight ? 0.15 : 0.22
        ],
        "fill-extrusion-vertical-gradient": true
      }
    },
    {
      id: SKYSCRAPER_CROWN_LIGHT_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM + 1.5,
      filter: mergeFilters(baseFilter, TALL_BUILDING_FILTER),
      paint: {
        "fill-extrusion-color": cloneExpression(isLight ? LIGHT_SKYSCRAPER_CROWN_LIGHT_COLOR_EXPRESSION : SKYSCRAPER_CROWN_LIGHT_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.64),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,   0,
          15.5, isLight ? 0.09 : 0.14,
          17,   isLight ? 0.15 : 0.22,
          19,   isLight ? 0.18 : 0.28
        ],
        "fill-extrusion-vertical-gradient": true
      }
    },
    // Subtle material ribs, not emissive windows.
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[0],
      0.50,
      2.4,
      isLight ? "#bac4d0" : "#8c7565",
      isLight ? 0.07 : 0.10,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[1],
      0.65,
      2.6,
      isLight ? "#c7d0da" : "#9b8170",
      isLight ? 0.09 : 0.13,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[2],
      0.78,
      2.2,
      isLight ? "#b4bfcb" : "#846f62",
      isLight ? 0.075 : 0.11,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[3],
      0.90,
      2.8,
      isLight ? "#d2dae3" : "#aa8d78",
      isLight ? 0.10 : 0.14,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperBandLayer(SKYSCRAPER_BAND_LAYER_IDS[0], 0.56, source, sourceLayer, baseFilter),
    getSkyscraperBandLayer(SKYSCRAPER_BAND_LAYER_IDS[1], 0.71, source, sourceLayer, baseFilter),
    getSkyscraperBandLayer(SKYSCRAPER_BAND_LAYER_IDS[2], 0.84, source, sourceLayer, baseFilter),
    {
      id: BUILDING_ROOF_LAYER_ID,
      source,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
      minzoom: BUILDING_MIN_ZOOM,
      filter: baseFilter ? cloneExpression(baseFilter) : undefined,
      paint: {
        "fill-extrusion-color": cloneExpression(isLight ? LIGHT_ROOF_COLOR_EXPRESSION : DARK_ROOF_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": cloneExpression(buildingRoofBaseExpression),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14, isLight ? 0.38 : 0.52,
          16, isLight ? 0.56 : 0.76,
          18, isLight ? 0.66 : 0.88
        ],
        "fill-extrusion-vertical-gradient": false
      }
    }
  ];
};
