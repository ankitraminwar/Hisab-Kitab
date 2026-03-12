/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppStore } from '@/store/appStore';

export function useTheme() {
  const scheme = useColorScheme();
  const storedTheme = useAppStore((state) => state.theme);
  const theme = storedTheme ?? (scheme === 'dark' ? 'dark' : 'light');

  return Colors[theme];
}
