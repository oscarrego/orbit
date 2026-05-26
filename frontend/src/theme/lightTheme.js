export const lightTheme = {
  id: "light",
  styleUrl: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  colors: {
    background: "#eef1f4",
    roadPrimary: "#737f8c",
    roadSecondary: "#a0a9b4",
    label: "#1f2933",
  },
  effects: {
    glow: "rgba(255, 255, 255, 0.42)",
    shadow: "rgba(15, 23, 42, 0.12)",
    mapFilters: "brightness(0.99) contrast(1.09) saturate(0.48)",
  },
  ui: {
    glassBg: "rgba(255, 255, 255, 0.72)",
    glassBorder: "rgba(15, 23, 42, 0.12)",
    glassBlur: "blur(22px)",
    textPrimary: "#111827",
    textSecondary: "#4b5563",
  }
};
