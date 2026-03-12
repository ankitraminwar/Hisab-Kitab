import { useTheme as useAppTheme } from '@/hooks/useTheme';

export function useTheme() {
  const { colors } = useAppTheme();

  return {
    ...colors,
    text: colors.textPrimary,
    background: colors.bg,
    backgroundElement: colors.bgCard,
    backgroundSelected: colors.bgElevated,
    textSecondary: colors.textSecondary,
  };
}
