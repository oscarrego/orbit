export const darkTheme = {
  id: "dark",
  styleUrl: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  colors: {
    // Warm-dark grey base — not pure black, allows atmospheric depth to read
    background: "#1c2024",
    roadPrimary: "#ffd36b",
    roadSecondary: "#6a7a8a",
    label: "#d2dce8",
  },
  effects: {
    glow: "rgba(255,179,71,0.26)",
    shadow: "none",
    // Cinematic tone: warm slightly, retain rich contrast, don't crush blacks
    mapFilters: "brightness(1.06) contrast(1.05) saturate(0.82) sepia(0.035)",
  },
  ui: {
    glassBg: "rgba(10, 15, 25, 0.75)",
    glassBorder: "rgba(120, 160, 255, 0.2)",
    glassBlur: "blur(20px)",
    textPrimary: "#ffffff",
    textSecondary: "#c8d2e0",
  }
};
