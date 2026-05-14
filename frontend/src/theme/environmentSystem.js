// ── Orbit Environment System ────────────────────────────────────────────────
// Dynamic time-based cinematic atmosphere.
//
// The world moves through two states:
//   Night  (6 PM → 6 AM)  → dayFactor = 0
//   Day    (6 AM → 6 PM)  → dayFactor = 1
//
// Transitions happen over a 60-minute window (±30 min around 6 AM / 6 PM)
// so the switch is always smooth, cinematic, and gradual.
// ────────────────────────────────────────────────────────────────────────────

/** Convert HH:MM local time to fractional minutes since midnight */
const timeToMinutes = (hours, minutes) => hours * 60 + minutes;

/**
 * Returns a smooth 0→1 day factor based on the current local time.
 *   0 = full cinematic night
 *   1 = full cinematic day
 * Transition windows (smooth blend):
 *   Dawn:  5:30 → 6:30 AM
 *   Dusk:  5:30 → 6:30 PM
 */
export const getDayFactor = (now = new Date()) => {
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMinutes = timeToMinutes(h, m);

  const DAWN_START = timeToMinutes(5, 30);  // 330
  const DAWN_END   = timeToMinutes(6, 30);  // 390
  const DUSK_START = timeToMinutes(17, 30); // 1050
  const DUSK_END   = timeToMinutes(18, 30); // 1110

  // Smooth step: 0→1 during dawn window
  if (currentMinutes >= DAWN_START && currentMinutes <= DAWN_END) {
    return (currentMinutes - DAWN_START) / (DAWN_END - DAWN_START);
  }

  // Full day (6:30 AM → 5:30 PM)
  if (currentMinutes > DAWN_END && currentMinutes < DUSK_START) {
    return 1;
  }

  // Smooth step: 1→0 during dusk window
  if (currentMinutes >= DUSK_START && currentMinutes <= DUSK_END) {
    return 1 - (currentMinutes - DUSK_START) / (DUSK_END - DUSK_START);
  }

  // Full night (6:30 PM → 5:30 AM)
  return 0;
};

/** Lerp between two values */
const lerp = (a, b, t) => a + (b - a) * t;

/** Parse "rgb(r,g,b)" or "#rrggbb" → { r, g, b } */
const parseHex = (hex) => {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  };
};

/** Interpolate between two hex colours */
const lerpColor = (hexA, hexB, t) => {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
};

// ── Night environment baseline (full dark cinematic) ─────────────────────────
const NIGHT = {
  // Background
  background:          '#1c2024',
  // Landcover
  landcoverLow:        '#20242a',
  landcoverHigh:       '#343a43',
  // Landuse residential
  residentialLow:      '#232830',
  residentialHigh:     '#3a414b',
  // General landuse
  landuse:             '#333941',
  // Parks
  park:                '#263628',
  // Water (deep teal)
  waterLow:            '#101b24',
  waterHigh:           '#203746',
  waterOutline:        '#2b4658',
  waterShadow:         '#25465a',
  waterway:            '#2b5668',
  // Building base wall colour
  buildingLow:         '#22262b',
  buildingHigh:        '#151a22',
  buildingLightColor:  '#e5e9f1',
  buildingLightIntensity: 0.54,
};

// ── Day environment target (cinematic daytime like the reference image) ───────
const DAY = {
  // Background — soft warm haze
  background:          '#bdb9b0',
  // Landcover — muted warm stone
  landcoverLow:        '#ccc7be',
  landcoverHigh:       '#d4cfc6',
  // Landuse residential — soft off-white
  residentialLow:      '#cac5bc',
  residentialHigh:     '#d8d3ca',
  // General landuse — warm buff
  landuse:             '#c8c4bb',
  // Parks — muted olive green
  park:                '#8ea87a',
  // Water — soft atmospheric blue (reference image inspired)
  waterLow:            '#7ba8c4',
  waterHigh:           '#9abcce',
  waterOutline:        '#b0ccd8',
  waterShadow:         '#8cb8cc',
  waterway:            '#8fb8cc',
  // Building base wall — warm sandstone / terracotta inspired
  buildingLow:         '#b8a898',
  buildingHigh:        '#a09080',
  buildingLightColor:  '#f8eed8',
  buildingLightIntensity: 0.72,
};

/**
 * Returns fully interpolated environment values for the given dayFactor.
 * All consumers should call this once per environment update cycle.
 */
export const getEnvironmentValues = (dayFactor) => {
  const t = dayFactor;
  return {
    background:             lerpColor(NIGHT.background,         DAY.background,         t),
    landcoverLow:           lerpColor(NIGHT.landcoverLow,       DAY.landcoverLow,       t),
    landcoverHigh:          lerpColor(NIGHT.landcoverHigh,      DAY.landcoverHigh,      t),
    residentialLow:         lerpColor(NIGHT.residentialLow,     DAY.residentialLow,     t),
    residentialHigh:        lerpColor(NIGHT.residentialHigh,    DAY.residentialHigh,    t),
    landuse:                lerpColor(NIGHT.landuse,            DAY.landuse,            t),
    park:                   lerpColor(NIGHT.park,               DAY.park,               t),
    waterLow:               lerpColor(NIGHT.waterLow,           DAY.waterLow,           t),
    waterHigh:              lerpColor(NIGHT.waterHigh,          DAY.waterHigh,          t),
    waterOutline:           lerpColor(NIGHT.waterOutline,       DAY.waterOutline,       t),
    waterShadow:            lerpColor(NIGHT.waterShadow,        DAY.waterShadow,        t),
    waterway:               lerpColor(NIGHT.waterway,           DAY.waterway,           t),
    buildingLow:            lerpColor(NIGHT.buildingLow,        DAY.buildingLow,        t),
    buildingHigh:           lerpColor(NIGHT.buildingHigh,       DAY.buildingHigh,       t),
    buildingLightColor:     lerpColor(NIGHT.buildingLightColor, DAY.buildingLightColor, t),
    buildingLightIntensity: lerp(NIGHT.buildingLightIntensity,  DAY.buildingLightIntensity, t),
    dayFactor: t,
  };
};

// ── Sky / Atmosphere presets ─────────────────────────────────────────────────
// These are interpolated between night and day versions per camera mode.
// Used by MapView to setSky() on the map.

export const interpolateSkyStyle = (nightSky, daySky, t) => {
  const lerpRgba = (a, b, factor) => {
    // Parse "rgba(r,g,b,a)" strings
    const parse = (s) => {
      const m = s.match(/[\d.]+/g);
      return { r: +m[0], g: +m[1], b: +m[2], a: +m[3] };
    };
    const na = parse(a);
    const nb = parse(b);
    return `rgba(${Math.round(lerp(na.r,nb.r,factor))},${Math.round(lerp(na.g,nb.g,factor))},${Math.round(lerp(na.b,nb.b,factor))},${(lerp(na.a,nb.a,factor)).toFixed(2)})`;
  };

  return {
    'sky-color':         lerpRgba(nightSky['sky-color'],      daySky['sky-color'],      t),
    'horizon-color':     lerpRgba(nightSky['horizon-color'],  daySky['horizon-color'],  t),
    'fog-color':         lerpRgba(nightSky['fog-color'],      daySky['fog-color'],      t),
    'fog-ground-blend':  lerp(nightSky['fog-ground-blend'],   daySky['fog-ground-blend'],  t),
    'horizon-fog-blend': lerp(nightSky['horizon-fog-blend'],  daySky['horizon-fog-blend'], t),
    'sky-horizon-blend': lerp(nightSky['sky-horizon-blend'],  daySky['sky-horizon-blend'], t),
    'atmosphere-blend':  lerp(nightSky['atmosphere-blend'],   daySky['atmosphere-blend'],  t),
  };
};

// Daytime sky presets (per camera mode)
export const DAY_SKY_STYLES = {
  top: {
    'sky-color':         'rgba(160,175,195,0.70)',
    'horizon-color':     'rgba(195,205,215,0.60)',
    'fog-color':         'rgba(175,185,195,0.50)',
    'fog-ground-blend':  0.86,
    'horizon-fog-blend': 0.78,
    'sky-horizon-blend': 0.72,
    'atmosphere-blend':  0.38,
  },
  cinematic: {
    'sky-color':         'rgba(120,145,175,0.82)',
    'horizon-color':     'rgba(180,195,208,0.72)',
    'fog-color':         'rgba(155,170,185,0.58)',
    'fog-ground-blend':  0.78,
    'horizon-fog-blend': 0.84,
    'sky-horizon-blend': 0.76,
    'atmosphere-blend':  0.44,
  },
  immersive: {
    'sky-color':         'rgba(100,130,165,0.88)',
    'horizon-color':     'rgba(165,185,200,0.80)',
    'fog-color':         'rgba(140,160,178,0.66)',
    'fog-ground-blend':  0.72,
    'horizon-fog-blend': 0.86,
    'sky-horizon-blend': 0.80,
    'atmosphere-blend':  0.52,
  },
};
