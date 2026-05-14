$c = [System.IO.File]::ReadAllText("$PWD\frontend\src\components\MapView.js")

$newBlock = @"
// Night sky presets (per camera mode)
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

# Use regex to replace the whole sky block
$pattern = '(?s)// [─-]+ Sky & Atmosphere presets [─-]+.*?console\.warn\("Unable to apply camera atmosphere:", error\);\r?\n  \}\r?\n\};'
$result = [regex]::Replace($c, $pattern, $newBlock)

if ($result.Contains('NIGHT_SKY_STYLES')) {
  [System.IO.File]::WriteAllText("$PWD\frontend\src\components\MapView.js", $result)
  Write-Host "SUCCESS: sky section replaced"
} else {
  Write-Host "FAIL: trying simpler anchor approach"
  # Find getSkyStyleForMode and replace from there
  $anchor = 'const getSkyStyleForMode = (cameraMode) => {'
  $anchorNew = 'const NIGHT_SKY_STYLES = {'
  if ($c.Contains($anchor)) {
    Write-Host "Anchor found, manual replacement..."
  } else {
    Write-Host "Anchor not found either"
  }
}
