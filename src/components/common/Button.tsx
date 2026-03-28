import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import type { IoniconsName } from '../../utils/types';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bgColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.expense
        : variant === 'secondary'
          ? colors.bgElevated
          : 'transparent';
  const contentColor =
    variant === 'primary' || variant === 'danger' ? colors.textInverse : colors.textPrimary;

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.bgElevated : bgColor,
          opacity: disabled ? 0.6 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon as IoniconsName}
              size={18}
              color={contentColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.buttonText, { color: contentColor }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.md,
    },
    buttonText: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
    },
  });
