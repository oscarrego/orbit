$c = [System.IO.File]::ReadAllText("$PWD\frontend\src\theme\cinematicDarkMapStyle.js")
$c = $c -replace "`r`n", "`n"

# Fix function signature - match without the problematic em-dash comment
$old = 'const styleGroundAndWater = (mapInstance) => {'
$new = @'
const styleGroundAndWater = (mapInstance, env) => {
  const bg=env?.background||"#1c2024", lcL=env?.landcoverLow||"#20242a", lcH=env?.landcoverHigh||"#343a43";
  const rlL=env?.residentialLow||"#232830", rlH=env?.residentialHigh||"#3a414b", lu=env?.landuse||"#333941";
  const pk=env?.park||"#263628", wL=env?.waterLow||"#101b24", wH=env?.waterHigh||"#203746";
  const wO=env?.waterOutline||"#2b4658", wS=env?.waterShadow||"#25465a", ww=env?.waterway||"#2b5668";
'@

if ($c.Contains($old)) {
  # Remove the old comment line that follows it
  $c = $c.Replace('const styleGroundAndWater = (mapInstance) => {', $new.TrimEnd())
  # Remove the now-orphaned comment + hardcoded background line
  $oldComment = @'

  // Base background -- deep warm-grey, not black
  setPaint(mapInstance, "background", "background-color", "#1c2024");
'@
  # Try with em-dash
  $c = $c -replace '(\n  // Base background [^\n]+\n  setPaint\(mapInstance, "background", "background-color", "#1c2024"\);)', "`n  setPaint(mapInstance, `"background`", `"background-color`", bg);"

  # Fix remaining hardcoded colour refs
  $c = $c.Replace('  setPaint(mapInstance, "landuse", "fill-color", "#333941");', '  setPaint(mapInstance, "landuse", "fill-color", lu);')
  $c = $c.Replace('  setPaint(mapInstance, "park_national_park", "fill-color", "#263628");', '  setPaint(mapInstance, "park_national_park", "fill-color", pk);')
  $c = $c.Replace('  setPaint(mapInstance, "park_nature_reserve", "fill-color", "#263628");', '  setPaint(mapInstance, "park_nature_reserve", "fill-color", pk);')
  $c = $c.Replace('  setPaint(mapInstance, "water", "fill-outline-color", "#2b4658");', '  setPaint(mapInstance, "water", "fill-outline-color", wO);')
  $c = $c.Replace('  setPaint(mapInstance, "water_shadow", "fill-color", "#25465a");', '  setPaint(mapInstance, "water_shadow", "fill-color", wS);')
  $c = $c.Replace('  setPaint(mapInstance, "waterway", "line-color", "#2b5668");', '  setPaint(mapInstance, "waterway", "line-color", ww);')
  # Fix landcover zoom expression
  $c = $c -replace '    6,  "#20242a",\n    10, "#252a31",\n    13, "#2c323a",\n    16, "#343a43"', '    6, lcL, 10, lcL, 13, lcL, 16, lcH'
  # Fix residential zoom expression
  $c = $c -replace '    6,  "#232830",\n    12, "#303640",\n    16, "#3a414b"', '    6, rlL, 12, rlL, 16, rlH'
  # Fix water zoom expression
  $c = $c -replace '    0,  "#101b24",\n    8,  "#142331",\n    12, "#182b3b",\n    16, "#203746"', '    0, wL, 8, wL, 12, wL, 16, wH'

  [System.IO.File]::WriteAllText("$PWD\frontend\src\theme\cinematicDarkMapStyle.js", $c)
  Write-Host "SUCCESS: signature and colours fixed"
  Write-Host "lcL present: $($c.Contains('lcL'))"
  Write-Host "env? present: $($c.Contains('env?'))"
} else {
  Write-Warning "FAIL: old signature not found"
}
