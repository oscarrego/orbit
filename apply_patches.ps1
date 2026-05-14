Set-Location (Split-Path $MyInvocation.MyCommand.Path)

# ─── Helper ──────────────────────────────────────────────────────────────────
function ApplyPatch($path, $from, $to) {
  $c = [System.IO.File]::ReadAllText($path)
  if ($c.Contains($from)) {
    $c = $c.Replace($from, $to)
    [System.IO.File]::WriteAllText($path, $c)
    Write-Host "  OK: $([System.IO.Path]::GetFileName($path))"
    return $true
  } else {
    Write-Warning "  MISS: pattern not found in $([System.IO.Path]::GetFileName($path))"
    return $false
  }
}

# ─── 1. MapView.js ────────────────────────────────────────────────────────────
$mv = 'frontend\src\components\MapView.js'

# 1a. Add new imports
ApplyPatch $mv `
  'import { DARK_MAP_STYLE_URL, applyCinematicDarkMapStyle } from "../theme/cinematicDarkMapStyle";' `
  ('import { DARK_MAP_STYLE_URL, applyCinematicDarkMapStyle, applyEnvironmentToMap } from "../theme/cinematicDarkMapStyle";' + "`n" + 'import { getDayFactor, getEnvironmentValues, interpolateSkyStyle, DAY_SKY_STYLES } from "../theme/environmentSystem";')

# 1b. Replace sky style constants + getSkyStyleForMode + applyCameraAtmosphere
$oldSky = [System.IO.File]::ReadAllText($mv) -match '(?s)(// \u2500\u2500 Sky & Atmosphere presets.*?applyCameraAtmosphere = \(mapInstance, cameraMode\).*?\};)'
# We'll do it via simple string containment
$c = [System.IO.File]::ReadAllText($mv)

# Find sky section start and end precisely
$skyStart = '// ── Sky & Atmosphere presets ─────────────────────────────────────────────────'
$skyEnd = "`n`r`n`r`n"
# Instead use safe known anchors
$oldCameraAtmFn = @"
const getSkyStyleForMode = (cameraMode) => {
  if (cameraMode === CAMERA_MODES.IMMERSIVE)  return cloneMapStyle(IMMERSIVE_SKY_STYLE);
  if (cameraMode === CAMERA_MODES.CINEMATIC)  return cloneMapStyle(CINEMATIC_SKY_STYLE);
  return cloneMapStyle(TOP_SKY_STYLE);
};

const applyCameraAtmosphere = (mapInstance, cameraMode) => {
  if (!mapInstance?.setSky) return;
  try {
    mapInstance.setSky(getSkyStyleForMode(cameraMode), { validate: false });
  } catch (error) {
    console.warn("Unable to apply camera atmosphere:", error);
  }
};
"@

$newCameraAtmFn = @"
const NIGHT_SKY_STYLES = {
  top: {
    "sky-color":        "rgba(14, 16, 22, 0.0)",
    "horizon-color":    "rgba(18, 20, 28, 0.0)",
    "fog-color":        "rgba(14, 16, 22, 0.0)",
    "fog-ground-blend": 1,
    "horizon-fog-blend":1,
    "sky-horizon-blend":1,
    "atmosphere-blend": 0
  },
  cinematic: {
    "sky-color":        "rgba(12, 14, 20, 0.88)",
    "horizon-color":    "rgba(32, 30, 24, 0.72)",
    "fog-color":        "rgba(24, 22, 18, 0.54)",
    "fog-ground-blend": 0.82,
    "horizon-fog-blend":0.88,
    "sky-horizon-blend":0.78,
    "atmosphere-blend": 0.18
  },
  immersive: {
    "sky-color":        "rgba(10, 12, 18, 0.94)",
    "horizon-color":    "rgba(38, 34, 26, 0.80)",
    "fog-color":        "rgba(32, 28, 22, 0.64)",
    "fog-ground-blend": 0.76,
    "horizon-fog-blend":0.90,
    "sky-horizon-blend":0.82,
    "atmosphere-blend": 0.28
  },
};

const getSkyStyleForMode = (cameraMode, dayFactor = 0) => {
  const key = cameraMode === CAMERA_MODES.IMMERSIVE ? "immersive" :
              cameraMode === CAMERA_MODES.CINEMATIC  ? "cinematic" : "top";
  const night = NIGHT_SKY_STYLES[key];
  const day   = DAY_SKY_STYLES[key];
  if (!day || dayFactor === 0) return cloneMapStyle(night);
  return interpolateSkyStyle(night, day, dayFactor);
};

const applyCameraAtmosphere = (mapInstance, cameraMode, dayFactor = 0) => {
  if (!mapInstance?.setSky) return;
  try {
    mapInstance.setSky(getSkyStyleForMode(cameraMode, dayFactor), { validate: false });
  } catch (error) {
    console.warn("Unable to apply camera atmosphere:", error);
  }
};

"@

if ($c.Contains($oldCameraAtmFn)) {
  $c = $c.Replace($oldCameraAtmFn, $newCameraAtmFn)
  Write-Host "  OK: sky styles replaced"
} else {
  Write-Warning "  MISS: sky function block not found"
}

# Also remove the 3 old sky style const blocks
$oldTopSky = @"
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

"@

if ($c.Contains($oldTopSky)) {
  $c = $c.Replace($oldTopSky, "")
  Write-Host "  OK: old sky const blocks removed"
} else {
  Write-Warning "  MISS: old sky const blocks not found (may be CRLF issue)"
}

# Also strip the design-intent comment block
$c = $c -replace '// Sky & Atmosphere presets[^\n]*\n//\n// Design intent:[^\n]*\n// no stars[^\n]*\n// skyline[^\n]*\n//\n//', '//'

# 1c. Update applyBuildingLighting
$c = $c.Replace(
  'const applyBuildingLighting = (mapInstance, themeId) => {',
  'const applyBuildingLighting = (mapInstance, themeId, env) => {'
)
$c = $c.Replace(
  '    mapInstance.setLight(getBuildingLight(themeId));',
  '    mapInstance.setLight(getBuildingLight(themeId, env));'
)

# 1d. Update applyBuildingPaint
$c = $c.Replace(
  'const applyBuildingPaint = (mapInstance, layerId, themeId) => {',
  'const applyBuildingPaint = (mapInstance, layerId, themeId, env) => {'
)
$c = $c.Replace(
  '  const paint = getBuildingPaint(themeId);',
  '  const paint = getBuildingPaint(themeId, env);'
)
$c = $c.Replace(
  '  applyBuildingLighting(mapInstance, themeId);' + "`n" + '};' + "`n" + "`n" + 'const removeBuildingAccentLayers',
  '  applyBuildingLighting(mapInstance, themeId, env);' + "`n" + '};' + "`n" + "`n" + 'const removeBuildingAccentLayers'
)

# 1e. Update applyThemeToMap
$c = $c.Replace(
  'const applyThemeToMap = (mapInstance, themeId, cameraMode) => {',
  'const applyThemeToMap = (mapInstance, themeId, cameraMode, env) => {'
)
$c = $c.Replace(
  '  applyBuildingLighting(mapInstance, themeId);',
  '  applyBuildingLighting(mapInstance, themeId, env);'
)
$c = $c.Replace(
  '  applyCinematicDarkMapStyle(mapInstance);',
  '  applyCinematicDarkMapStyle(mapInstance, env);'
)
$c = $c.Replace(
  '  applyCameraAtmosphere(mapInstance, cameraMode);',
  '  applyCameraAtmosphere(mapInstance, cameraMode, env?.dayFactor ?? 0);'
)

# 1f. Add envRef declaration
$c = $c.Replace(
  '  const initialCenterSet = useRef(false);' + "`r`n" + "`r`n" + '  const themeRef',
  '  const initialCenterSet = useRef(false);' + "`r`n" + '  const envRef = useRef(getEnvironmentValues(getDayFactor()));' + "`r`n" + "`r`n" + '  const themeRef'
)
# Also try LF-only version
$c = $c.Replace(
  '  const initialCenterSet = useRef(false);' + "`n" + "`n" + '  const themeRef',
  '  const initialCenterSet = useRef(false);' + "`n" + '  const envRef = useRef(getEnvironmentValues(getDayFactor()));' + "`n" + "`n" + '  const themeRef'
)

# 1g. Add environment tick useEffect after onAutoDisableFollowing effect
$envTick = @"

  // Environment tick - smooth day/night shift every 60s
  useEffect(() => {
    const tick = () => {
      const env = getEnvironmentValues(getDayFactor());
      envRef.current = env;
      if (map.current && map.current.isStyleLoaded()) {
        applyEnvironmentToMap(map.current, env);
        applyBuildingLighting(map.current, themeRef.current, env);
        applyCameraAtmosphere(map.current, cameraModeRef.current, env.dayFactor);
      }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
"@

# Try both CRLF and LF endings for the preceding effect closing
$marker1 = "  }, [onAutoDisableFollowing]);" + "`r`n"
$marker2 = "  }, [onAutoDisableFollowing]);" + "`n"
if ($c.Contains($marker1)) {
  $c = $c.Replace($marker1, $marker1 + $envTick)
  Write-Host "  OK: env tick added (CRLF)"
} elseif ($c.Contains($marker2)) {
  $c = $c.Replace($marker2, $marker2 + $envTick)
  Write-Host "  OK: env tick added (LF)"
} else {
  Write-Warning "  MISS: onAutoDisableFollowing effect end not found"
}

# 1h. Update restoreMapLayers call
$c = $c.Replace(
  'applyThemeToMap(map.current, themeRef.current, cameraModeRef.current);',
  'applyThemeToMap(map.current, themeRef.current, cameraModeRef.current, envRef.current);'
)
$c = $c.Replace(
  'applyThemeToMap(map.current, theme, cameraModeRef.current);',
  'applyThemeToMap(map.current, theme, cameraModeRef.current, envRef.current);'
)
$c = $c.Replace(
  'applyCameraAtmosphere(map.current, cameraMode, themeRef.current);',
  'applyCameraAtmosphere(map.current, cameraMode, envRef.current?.dayFactor ?? 0);'
)

[System.IO.File]::WriteAllText("$PWD\frontend\src\components\MapView.js", $c)
Write-Host "MapView.js fully patched"

# Verify
$check = $c.Contains('envRef') -and $c.Contains('Environment tick') -and $c.Contains('applyEnvironmentToMap')
Write-Host "Verification: envRef=$($c.Contains('envRef')) tick=$($c.Contains('Environment tick')) envFn=$($c.Contains('applyEnvironmentToMap'))"

# ─── 2. cinematicDarkMapStyle.js ─────────────────────────────────────────────
$cs = 'frontend\src\theme\cinematicDarkMapStyle.js'
$cc = [System.IO.File]::ReadAllText($cs)

# Update styleGroundAndWater signature + inject env vars
$oldGW = 'const styleGroundAndWater = (mapInstance) => {
  // Base background — deep warm-grey, not black
  setPaint(mapInstance, "background", "background-color", "#1c2024");'

$newGW = @'
const styleGroundAndWater = (mapInstance, env) => {
  const bg=env?.background||"#1c2024", lcL=env?.landcoverLow||"#20242a", lcH=env?.landcoverHigh||"#343a43";
  const rlL=env?.residentialLow||"#232830", rlH=env?.residentialHigh||"#3a414b", lu=env?.landuse||"#333941";
  const pk=env?.park||"#263628", wL=env?.waterLow||"#101b24", wH=env?.waterHigh||"#203746";
  const wO=env?.waterOutline||"#2b4658", wS=env?.waterShadow||"#25465a", ww=env?.waterway||"#2b5668";
  setPaint(mapInstance, "background", "background-color", bg);
'@

if ($cc.Contains($oldGW)) {
  $cc = $cc.Replace($oldGW, $newGW)
  Write-Host "  OK: styleGroundAndWater signature updated"
} else {
  Write-Warning "  MISS: styleGroundAndWater pattern not found"
}

# Update individual color values
$cc = $cc.Replace(
  '    6,  "#20242a",' + "`r`n" + '    10, "#252a31",' + "`r`n" + '    13, "#2c323a",' + "`r`n" + '    16, "#343a43"',
  '    6, lcL, 10, lcL, 13, lcL, 16, lcH'
)
$cc = $cc.Replace(
  '    6,  "#232830",' + "`r`n" + '    12, "#303640",' + "`r`n" + '    16, "#3a414b"',
  '    6, rlL, 12, rlL, 16, rlH'
)
$cc = $cc.Replace('setPaint(mapInstance, "landuse", "fill-color", "#333941");', 'setPaint(mapInstance, "landuse", "fill-color", lu);')
$cc = $cc.Replace('setPaint(mapInstance, "park_national_park", "fill-color", "#263628");', 'setPaint(mapInstance, "park_national_park", "fill-color", pk);')
$cc = $cc.Replace('setPaint(mapInstance, "park_nature_reserve", "fill-color", "#263628");', 'setPaint(mapInstance, "park_nature_reserve", "fill-color", pk);')
$cc = $cc.Replace('    0,  "#101b24",' + "`r`n" + '    8,  "#142331",' + "`r`n" + '    12, "#182b3b",' + "`r`n" + '    16, "#203746"',
  '    0, wL, 8, wL, 12, wL, 16, wH')
$cc = $cc.Replace('  setPaint(mapInstance, "water", "fill-outline-color", "#2b4658");', '  setPaint(mapInstance, "water", "fill-outline-color", wO);')
$cc = $cc.Replace('  setPaint(mapInstance, "water_shadow", "fill-color", "#25465a");', '  setPaint(mapInstance, "water_shadow", "fill-color", wS);')
$cc = $cc.Replace('  setPaint(mapInstance, "waterway", "line-color", "#2b5668");', '  setPaint(mapInstance, "waterway", "line-color", ww);')

# Update applyCinematicDarkMapStyle to accept env
$cc = $cc.Replace(
  'export const applyCinematicDarkMapStyle = (mapInstance) => {',
  'export const applyCinematicDarkMapStyle = (mapInstance, env) => {'
)
$cc = $cc.Replace(
  '  if (mapInstance.__orbitCinematicDarkApplied && cinematicLayersReady) return;',
  '  if (mapInstance.__orbitCinematicDarkApplied && cinematicLayersReady && !env) return;'
)
$cc = $cc.Replace('  styleGroundAndWater(mapInstance);', '  styleGroundAndWater(mapInstance, env);')

# Add applyEnvironmentToMap export
$cc = $cc.Replace(
  '  mapInstance.__orbitCinematicDarkApplied = true;' + "`r`n" + '};',
  '  mapInstance.__orbitCinematicDarkApplied = true;' + "`r`n" + '};' + "`r`n" + "`r`n" + "export const applyEnvironmentToMap = (mapInstance, env) => {" + "`r`n" + "  if (!mapInstance || !mapInstance.isStyleLoaded()) return;" + "`r`n" + "  styleGroundAndWater(mapInstance, env);" + "`r`n" + "};"
)

[System.IO.File]::WriteAllText("$PWD\frontend\src\theme\cinematicDarkMapStyle.js", $cc)
Write-Host "cinematicDarkMapStyle.js patched"
Write-Host "  applyEnvironmentToMap: $($cc.Contains('applyEnvironmentToMap'))"

# ─── 3. mapBuildingStyle.js ──────────────────────────────────────────────────
$bs = 'frontend\src\theme\mapBuildingStyle.js'
$bc = [System.IO.File]::ReadAllText($bs)

$oldPaint = @'
export const getBuildingPaint = () => ({
  "fill-extrusion-color": cloneExpression(DARK_BUILDING_COLOR_EXPRESSION),
  "fill-extrusion-height": cloneExpression(BUILDING_HEIGHT_EXPRESSION),
  "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
  "fill-extrusion-opacity": cloneExpression(BUILDING_OPACITY_EXPRESSION),
  "fill-extrusion-vertical-gradient": true
});
'@

$newPaint = @'
export const getBuildingPaint = (themeId, env) => {
  const dayFactor = env?.dayFactor ?? 0;
  const dayExpr = ["let","height",["max",10,["to-number",["get","render_height"],24]],"tone",["%",["abs",["case",["==",["id"],null],17,["to-number",["id"],17]]],6],["case",["<",["var","tone"],2],["interpolate",["linear"],["var","height"],0,"#c4b8a8",22,"#bfb2a0",55,"#b8aa98",105,"#ae9f8c",180,"#a09080"],["<",["var","tone"],4],["interpolate",["linear"],["var","height"],0,"#c2b6a6",22,"#bcaf9d",55,"#b6a895",105,"#ac9d89",180,"#9e8e7c"],["interpolate",["linear"],["var","height"],0,"#c0b4a4",22,"#bab19e",55,"#b4a796",105,"#aa9c88",180,"#9d8d7b"]]];
  return {
    "fill-extrusion-color": cloneExpression(dayFactor > 0.5 ? dayExpr : DARK_BUILDING_COLOR_EXPRESSION),
    "fill-extrusion-height": cloneExpression(BUILDING_HEIGHT_EXPRESSION),
    "fill-extrusion-base": cloneExpression(BUILDING_BASE_EXPRESSION),
    "fill-extrusion-opacity": cloneExpression(BUILDING_OPACITY_EXPRESSION),
    "fill-extrusion-vertical-gradient": true
  };
};
'@

if ($bc.Contains($oldPaint)) {
  $bc = $bc.Replace($oldPaint, $newPaint)
  Write-Host "  OK: getBuildingPaint updated"
} else {
  Write-Warning "  MISS: getBuildingPaint pattern (trying LF normalised)"
  $oldPaintLF = $oldPaint -replace "`r`n","`n"
  $bcLF = $bc -replace "`r`n","`n"
  if ($bcLF.Contains($oldPaintLF)) {
    $bc = $bcLF.Replace($oldPaintLF, ($newPaint -replace "`r`n","`n"))
    Write-Host "  OK: getBuildingPaint updated (LF)"
  }
}

$oldLight = @'
export const getBuildingLight = () => ({
  anchor: "viewport",
  position: [1.45, 50, 52],
  color: "#e5e9f1",
  intensity: 0.54
});
'@

$newLight = @'
export const getBuildingLight = (themeId, env) => ({
  anchor: "viewport",
  position: [1.45, 50, 52],
  color: env?.buildingLightColor || "#e5e9f1",
  intensity: env?.buildingLightIntensity ?? 0.54
});
'@

if ($bc.Contains($oldLight)) {
  $bc = $bc.Replace($oldLight, $newLight)
  Write-Host "  OK: getBuildingLight updated"
} else {
  $oldLightLF = $oldLight -replace "`r`n","`n"
  $bcLF2 = $bc -replace "`r`n","`n"
  if ($bcLF2.Contains($oldLightLF)) {
    $bc = $bcLF2.Replace($oldLightLF, ($newLight -replace "`r`n","`n"))
    Write-Host "  OK: getBuildingLight updated (LF)"
  } else {
    Write-Warning "  MISS: getBuildingLight pattern not found"
  }
}

[System.IO.File]::WriteAllText("$PWD\frontend\src\theme\mapBuildingStyle.js", $bc)
Write-Host "mapBuildingStyle.js patched"

Write-Host "`nAll patches complete!"
