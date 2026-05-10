import { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';

export const getThemeConfig = (themeId) => {
  return themeId === 'light' ? lightTheme : darkTheme;
};

export const getRoadColor = (themeId, type = 'primary') => {
  const config = getThemeConfig(themeId);
  return type === 'secondary' ? config.colors.roadSecondary : config.colors.roadPrimary;
};

export const getBackgroundColor = (themeId) => {
  return getThemeConfig(themeId).colors.background;
};

export const getLabelColor = (themeId) => {
  return getThemeConfig(themeId).colors.label;
};

export const getMapFilters = (themeId) => {
  return getThemeConfig(themeId).effects.mapFilters;
};

export const getGlowOrShadow = (themeId) => {
  const config = getThemeConfig(themeId);
  return {
    glow: config.effects.glow,
    shadow: config.effects.shadow
  };
};
