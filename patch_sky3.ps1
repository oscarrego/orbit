$c = [System.IO.File]::ReadAllText("$PWD\frontend\src\components\MapView.js")

# Replace ONLY the function implementations (not the constants above)
$oldGetSky = @"
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

$newGetSky = @"
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

# Normalise to LF for comparison
$cLF = $c -replace "`r`n", "`n"
$oldLF = $oldGetSky -replace "`r`n", "`n"
$newLF = $newGetSky -replace "`r`n", "`n"

if ($cLF.Contains($oldLF)) {
  $cLF = $cLF.Replace($oldLF, $newLF)
  [System.IO.File]::WriteAllText("$PWD\frontend\src\components\MapView.js", $cLF)
  Write-Host "SUCCESS: sky functions replaced"
  Write-Host "NIGHT_SKY_STYLES: $($cLF.Contains('NIGHT_SKY_STYLES'))"
} else {
  Write-Warning "FAIL: exact match not found even with LF normalisation"
  # Show what we find around getSkyStyleForMode
  $idx = $cLF.IndexOf("const getSkyStyleForMode")
  if ($idx -ge 0) {
    Write-Host "Found at $idx. Context:"
    Write-Host $cLF.Substring([Math]::Max(0,$idx-50), 200)
  }
}
