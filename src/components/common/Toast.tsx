import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Appearance, StyleSheet, Text, View } from 'react-native';
import Toast, { type BaseToastProps } from 'react-native-toast-message';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import { resolveThemeColors } from '@/hooks/useTheme';
import { useAppStore } from '@/store/appStore';

const getColors = () => {
  const theme = useAppStore.getState().theme;
  const systemTheme = Appearance.getColorScheme() ?? null;
  return resolveThemeColors(theme, systemTheme);
};

const TOAST_ICONS: Record<
  string,
  { name: string; color: (c: ReturnType<typeof getColors>) => string }
> = {
  success: { name: 'checkmark-circle', color: (c) => c.income },
  error: { name: 'close-circle', color: (c) => c.expense },
  info: { name: 'information-circle', color: (c) => c.primary },
};

const CompactToast: React.FC<BaseToastProps & { type: string }> = (props) => {
  const colors = getColors();
  const icon = TOAST_ICONS[props.type] ?? TOAST_ICONS.info;
  const tint = icon.color(colors);

  return (
    <View style={[toastStyles.pill, { backgroundColor: colors.bgCard, borderColor: tint + '30' }]}>
      <Ionicons name={icon.name as never} size={18} color={tint} />
      <Text style={[toastStyles.text, { color: colors.textPrimary }]} numberOfLines={1}>
        {props.text1}
      </Text>
    </View>
  );
};

const toastStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    maxWidth: '80%',
    alignSelf: 'center',
  },
  text: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    flexShrink: 1,
  },
});

const toastConfig = {
  success: (props: BaseToastProps) => <CompactToast {...props} type="success" />,
  error: (props: BaseToastProps) => <CompactToast {...props} type="error" />,
  info: (props: BaseToastProps) => <CompactToast {...props} type="info" />,
};

export const AppToast: React.FC = () => <Toast config={toastConfig} topOffset={54} />;

export const showToast = {
  success: (title: string, message?: string) => {
    Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 2000 });
  },
  error: (title: string, message?: string) => {
    Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 3000 });
  },
  info: (title: string, message?: string) => {
    Toast.show({ type: 'info', text1: title, text2: message, visibilityTime: 2000 });
  },
};
