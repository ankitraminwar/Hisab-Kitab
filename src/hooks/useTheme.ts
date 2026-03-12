import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/appStore';
import { LIGHT_COLORS, DARK_COLORS } from '../utils/constants';

export const useTheme = () => {
  const { theme } = useAppStore();
  const systemTheme = useColorScheme();

  const isDark =
    theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  return {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
  };
};

export type ThemeColors = typeof DARK_COLORS;
