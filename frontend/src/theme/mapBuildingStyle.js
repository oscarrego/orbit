export const BUILDING_LAYER_ID = "orbit-3d-buildings";
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
export const BUILDING_MIN_ZOOM = 13;

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
      0, "#22262b",
      22, "#252a30",
      55, "#20252d",
      105, "#1a2028",
      180, "#151a22"
    ],
    ["<", ["var", "tone"], 4],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#242629",
      22, "#2b2e32",
      55, "#252a30",
      105, "#1d232a",
      180, "#171c23"
    ],
    [
      "interpolate",
      ["linear"],
      ["var", "height"],
      0, "#1f2528",
      22, "#263034",
      55, "#222a31",
      105, "#1a2229",
      180, "#141b22"
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
  ["min", 220, ["max", ["+", ["var", "base"], 8], ["*", 1.25, ["max", 10, ["var", "raw"]]]]]
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
    13,
    0,
    14,
    [
      "*",
      0.35,
      ["min", 220, ["max", ["+", ["var", "base"], 8], ["*", 1.25, ["max", 10, ["var", "raw"]]]]]
    ],
    15.25,
    [
      "*",
      0.82,
      ["min", 220, ["max", ["+", ["var", "base"], 8], ["*", 1.25, ["max", 10, ["var", "raw"]]]]]
    ],
    16,
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
    13,
    0,
    14,
    ["*", 0.35, ["var", "base"]],
    15.25,
    ["*", 0.82, ["var", "base"]],
    16,
    ["var", "base"]
  ]
];

const BUILDING_OPACITY_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13,
  0,
  13.35,
  0.82,
  14,
  1
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
    ["<", ["var", "tone"], 2],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      13, "#2f343a",
      15, "#373d45",
      17, "#414955",
      19, "#4a5360"
    ],
    ["<", ["var", "tone"], 4],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      13, "#303237",
      15, "#3a3d43",
      17, "#454952",
      19, "#4e535d"
    ],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      13, "#2b3537",
      15, "#354144",
      17, "#404d52",
      19, "#48575d"
    ]
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
    "#303235",
    90,
    "#393b3c",
    150,
    "#44433f",
    220,
    "#514d45"
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
    "#4a4842",
    110,
    "#5d584e",
    180,
    "#706958",
    250,
    "#837b67"
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
      "fill-extrusion-color": "#0f0f0e",
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

export const getBuildingPaint = () => ({
  "fill-extrusion-color": cloneExpression(DARK_BUILDING_COLOR_EXPRESSION),
  "fill-extrusion-height": cloneExpression(BUILDING_HEIGHT_EXPRESSION),
  "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
  "fill-extrusion-opacity": cloneExpression(BUILDING_OPACITY_EXPRESSION),
  "fill-extrusion-vertical-gradient": true
});

export const getBuildingLight = () => ({
  anchor: "viewport",
  position: [1.45, 50, 52],
  color: "#e5e9f1",
  intensity: 0.54
});

export const getBuildingAccentLayers = (themeId, source, sourceLayer, baseFilter) => {
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
            ["<", ["var", "tone"], 2], "#3c4349",
            ["<", ["var", "tone"], 4], "#424348",
            "#384649"
          ]
        ],
        "fill-extrusion-height": terrainBlendTop,
        "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14.25, 0.12,
          16, 0.22,
          18, 0.28
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
          "#6a5538",
          "#5a4d39"
        ],
        "fill-extrusion-height": roadBounceTop,
        "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14.5, 0.06,
          16.5, 0.13,
          18.5, 0.16
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
        "fill-extrusion-color": "#5d6873",
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.28),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.5, 0,
          15, 0.045,
          17, 0.075,
          19, 0.095
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
        "fill-extrusion-color": cloneExpression(SKYSCRAPER_UPPER_LIGHT_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.38),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0,
          15, 0.10,
          17, 0.18,
          19, 0.22
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
        "fill-extrusion-color": cloneExpression(SKYSCRAPER_CROWN_LIGHT_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": buildingHeightAtRatio(0.64),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,   0,
          15.5, 0.14,
          17,   0.22,
          19,   0.28
        ],
        "fill-extrusion-vertical-gradient": true
      }
    },
    // Subtle material ribs, not emissive windows.
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[0],
      0.50,
      2.4,
      "#807b70",
      0.10,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[1],
      0.65,
      2.6,
      "#969083",
      0.13,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[2],
      0.78,
      2.2,
      "#8b867c",
      0.11,
      source,
      sourceLayer,
      baseFilter
    ),
    getSkyscraperWindowBandLayer(
      SKYSCRAPER_WINDOW_BAND_LAYER_IDS[3],
      0.90,
      2.8,
      "#a09a8c",
      0.14,
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
        "fill-extrusion-color": cloneExpression(DARK_ROOF_COLOR_EXPRESSION),
        "fill-extrusion-height": cloneExpression(BUILDING_FULL_HEIGHT_EXPRESSION),
        "fill-extrusion-base": cloneExpression(buildingRoofBaseExpression),
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13, 0,
          14, 0.52,
          16, 0.76,
          18, 0.88
        ],
        "fill-extrusion-vertical-gradient": false
      }
    }
  ];
};
