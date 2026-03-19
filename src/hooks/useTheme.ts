import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/appStore';
import { DARK_COLORS, LIGHT_COLORS } from '../utils/constants';

export type ThemePreference = 'light' | 'dark' | 'system';

export const resolveThemeColors = (
  theme: ThemePreference,
  systemTheme: 'dark' | 'light' | null,
) => {
  const resolvedTheme =
    theme === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : theme;

  return resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
};

export const useTheme = () => {
  const { theme } = useAppStore();
  const systemTheme = useColorScheme();

  const canonicalSystemTheme =
    systemTheme === 'dark' ? 'dark' : systemTheme === 'light' ? 'light' : null;

  const effectiveTheme =
    theme === 'system'
      ? canonicalSystemTheme === 'dark'
        ? 'dark'
        : 'light'
      : theme;

  const isDark = effectiveTheme === 'dark';

  const colors = useMemo(
    () => resolveThemeColors(theme, canonicalSystemTheme),
    [theme, canonicalSystemTheme],
  );

  return {
    isDark,
    theme: effectiveTheme as ThemePreference,
    colors,
  };
};

export type ThemeColors = typeof DARK_COLORS | typeof LIGHT_COLORS;
