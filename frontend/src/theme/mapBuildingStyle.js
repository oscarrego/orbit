export const BUILDING_LAYER_ID = "orbit-3d-buildings";
export const BUILDING_SOURCE_LAYER = "building";
export const BUILDING_MIN_ZOOM = 13;
export const LIGHT_BUILDING_COLOR = "#7a7979";

const DARK_BUILDING_COLOR_EXPRESSION = [
  "let",
  "height",
  ["max", 10, ["to-number", ["get", "render_height"], 24]],
  [
    "interpolate",
    ["linear"],
    ["var", "height"],
    0,
    "#5f3424",
    18,
    "#7a432b",
    45,
    "#925431",
    90,
    "#a8663c",
    160,
    "#bd7b4a"
  ]
];

const BUILDING_ID_NUMBER_EXPRESSION = [
  "abs",
  ["case", ["==", ["id"], null], 17, ["to-number", ["id"], 17]]
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
    ["min", 220, ["max", ["+", ["var", "base"], 8], ["*", 1.25, ["max", 10, ["var", "raw"]]]]]
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

export const getBuildingPaint = (themeId) => ({
  "fill-extrusion-color":
    themeId === "light" ? LIGHT_BUILDING_COLOR : cloneExpression(DARK_BUILDING_COLOR_EXPRESSION),
  "fill-extrusion-height": cloneExpression(BUILDING_HEIGHT_EXPRESSION),
  "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
  "fill-extrusion-opacity": cloneExpression(BUILDING_OPACITY_EXPRESSION),
  "fill-extrusion-vertical-gradient": true
});

export const getBuildingLight = (themeId) =>
  themeId === "light"
    ? {
        anchor: "viewport",
        position: [1.25, 72, 48],
        color: "#ffffff",
        intensity: 0.78
      }
    : {
        anchor: "viewport",
        position: [1.1, 58, 42],
        color: "#ffa55a",
        intensity: 0.42
      };
