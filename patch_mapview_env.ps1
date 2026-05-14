$mv = Get-Content 'frontend\src\components\MapView.js' -Raw

# Add envRef after initialCenterSet line
$mv = $mv -replace '(const initialCenterSet = useRef\(false\);)', ($Matches[0] + "`r`n  const envRef = useRef(getEnvironmentValues(getDayFactor()));")

# Add environment tick after the onAutoDisableFollowing effect closing bracket
$tickBlock = "

  // Environment tick - smooth day/night every 60s
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
"

$mv = $mv.Replace(
  "  }, [onAutoDisableFollowing]);",
  "  }, [onAutoDisableFollowing]);" + $tickBlock
)

# Update calls to pass envRef.current
$mv = $mv.Replace(
  "applyThemeToMap(map.current, themeRef.current, cameraModeRef.current);",
  "applyThemeToMap(map.current, themeRef.current, cameraModeRef.current, envRef.current);"
)
$mv = $mv.Replace(
  "applyThemeToMap(map.current, theme, cameraModeRef.current);",
  "applyThemeToMap(map.current, theme, cameraModeRef.current, envRef.current);"
)
$mv = $mv.Replace(
  "applyCameraAtmosphere(map.current, cameraMode, themeRef.current);",
  "applyCameraAtmosphere(map.current, cameraMode, envRef.current?.dayFactor ?? 0);"
)

Set-Content 'frontend\src\components\MapView.js' $mv -NoNewline

$check = ($mv.Contains('envRef')) -and ($mv.Contains('Environment tick'))
Write-Host "Patch check passed: $check"
