$c = [System.IO.File]::ReadAllText("$PWD\frontend\src\components\MapView.js")

# Replace the entire sky section (lines 63-115)
$oldBlock = "// ── Sky & Atmosphere presets ─────────────────────────────────────────────────`r`n//`r`n// Design intent: cloudy urban night — overcast cloud deck trapping city glow,`r`n// no stars, no sci-fi. The horizon should feel like a distant metropolitan`r`n// skyline viewed through humid air rather than pure void.`r`n//`r`n// TOP mode: minimal atmosphere — almost clean for overview readability`r`nconst TOP_SKY_STYLE = {`r`n  ""sky-color"":        ""rgba(14, 16, 22, 0.0)"",   // transparent`r`n  ""horizon-color"":    ""rgba(18, 20, 28, 0.0)"",`r`n  ""fog-color"":        ""rgba(14, 16, 22, 0.0)"",`r`n  ""fog-ground-blend"": 1,`r`n  ""horizon-fog-blend"":1,`r`n  ""sky-horizon-blend"":1,`r`n  ""atmosphere-blend"": 0`r`n};`r`n`r`n// CINEMATIC mode: dark overcast sky with soft warm horizon — city glow from below`r`nconst CINEMATIC_SKY_STYLE = {`r`n  ""sky-color"":        ""rgba(12, 14, 20, 0.88)"",   // deep blue-black cloud ceiling`r`n  ""horizon-color"":    ""rgba(32, 30, 24, 0.72)"",   // warm amber horizon haze`r`n  ""fog-color"":        ""rgba(24, 22, 18, 0.54)"",   // ground-level city warmth`r`n  ""fog-ground-blend"": 0.82,`r`n  ""horizon-fog-blend"":0.88,`r`n  ""sky-horizon-blend"":0.78,`r`n  ""atmosphere-blend"": 0.18`r`n};`r`n`r`n// IMMERSIVE mode: deep volumetric fog — humid cloudy night close to ground level`r`nconst IMMERSIVE_SKY_STYLE = {`r`n  ""sky-color"":        ""rgba(10, 12, 18, 0.94)"",   // almost opaque cloud ceiling`r`n  ""horizon-color"":    ""rgba(38, 34, 26, 0.80)"",   // warm amber city-glow horizon`r`n  ""fog-color"":        ""rgba(32, 28, 22, 0.64)"",   // volumetric ground haze`r`n  ""fog-ground-blend"": 0.76,`r`n  ""horizon-fog-blend"":0.90,`r`n  ""sky-horizon-blend"":0.82,`r`n  ""atmosphere-blend"": 0.28`r`n};`r`n`r`nconst getSkyStyleForMode = (cameraMode) => {`r`n  if (cameraMode === CAMERA_MODES.IMMERSIVE)  return cloneMapStyle(IMMERSIVE_SKY_STYLE);`r`n  if (cameraMode === CAMERA_MODES.CINEMATIC)  return cloneMapStyle(CINEMATIC_SKY_STYLE);`r`n  return cloneMapStyle(TOP_SKY_STYLE);`r`n};`r`n`r`nconst applyCameraAtmosphere = (mapInstance, cameraMode) => {`r`n  if (!mapInstance?.setSky) return;`r`n  try {`r`n    mapInstance.setSky(getSkyStyleForMode(cameraMode), { validate: false });`r`n  } catch (error) {`r`n    console.warn(""Unable to apply camera atmosphere:"", error);`r`n  }`r`n};"

$newBlock = "// Night sky presets (per camera mode)`r`nconst NIGHT_SKY_STYLES = {`r`n  top: {`r`n    ""sky-color"":        ""rgba(14, 16, 22, 0.0)"",`r`n    ""horizon-color"":    ""rgba(18, 20, 28, 0.0)"",`r`n    ""fog-color"":        ""rgba(14, 16, 22, 0.0)"",`r`n    ""fog-ground-blend"": 1,`r`n    ""horizon-fog-blend"":1,`r`n    ""sky-horizon-blend"":1,`r`n    ""atmosphere-blend"": 0`r`n  },`r`n  cinematic: {`r`n    ""sky-color"":        ""rgba(12, 14, 20, 0.88)"",`r`n    ""horizon-color"":    ""rgba(32, 30, 24, 0.72)"",`r`n    ""fog-color"":        ""rgba(24, 22, 18, 0.54)"",`r`n    ""fog-ground-blend"": 0.82,`r`n    ""horizon-fog-blend"":0.88,`r`n    ""sky-horizon-blend"":0.78,`r`n    ""atmosphere-blend"": 0.18`r`n  },`r`n  immersive: {`r`n    ""sky-color"":        ""rgba(10, 12, 18, 0.94)"",`r`n    ""horizon-color"":    ""rgba(38, 34, 26, 0.80)"",`r`n    ""fog-color"":        ""rgba(32, 28, 22, 0.64)"",`r`n    ""fog-ground-blend"": 0.76,`r`n    ""horizon-fog-blend"":0.90,`r`n    ""sky-horizon-blend"":0.82,`r`n    ""atmosphere-blend"": 0.28`r`n  },`r`n};`r`n`r`nconst getSkyStyleForMode = (cameraMode, dayFactor = 0) => {`r`n  const key = cameraMode === CAMERA_MODES.IMMERSIVE ? ""immersive"" :`r`n              cameraMode === CAMERA_MODES.CINEMATIC  ? ""cinematic"" : ""top"";`r`n  const night = NIGHT_SKY_STYLES[key];`r`n  const day   = DAY_SKY_STYLES[key];`r`n  if (!day || dayFactor === 0) return cloneMapStyle(night);`r`n  return interpolateSkyStyle(night, day, dayFactor);`r`n};`r`n`r`nconst applyCameraAtmosphere = (mapInstance, cameraMode, dayFactor = 0) => {`r`n  if (!mapInstance?.setSky) return;`r`n  try {`r`n    mapInstance.setSky(getSkyStyleForMode(cameraMode, dayFactor), { validate: false });`r`n  } catch (error) {`r`n    console.warn(""Unable to apply camera atmosphere:"", error);`r`n  }`r`n};"

if ($c.Contains($oldBlock)) {
  $c = $c.Replace($oldBlock, $newBlock)
  Write-Host "Sky block replaced OK"
} else {
  Write-Warning "Sky block exact CRLF match failed - trying regex"
  # Use regex for flexibility
  $c = [regex]::Replace($c, 
    '(?s)// ── Sky & Atmosphere presets.*?console\.warn\("Unable to apply camera atmosphere:", error\);\s+\}\s+\};',
    $newBlock,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if ($c.Contains('NIGHT_SKY_STYLES')) {
    Write-Host "Sky block replaced via regex OK"
  } else {
    Write-Warning "Sky block replacement FAILED"
  }
}

[System.IO.File]::WriteAllText("$PWD\frontend\src\components\MapView.js", $c)
Write-Host "Done. NIGHT_SKY_STYLES: $($c.Contains('NIGHT_SKY_STYLES'))"
