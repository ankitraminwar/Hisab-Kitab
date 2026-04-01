import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { IoniconsName } from '@/utils/types';

interface AnimatedEmptyStateProps {
  icon: IoniconsName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const AnimatedEmptyState: React.FC<AnimatedEmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.container}>
      {/* Animated icon with pulse ring */}
      <View style={styles.iconContainer}>
        <View style={styles.outerRing} />
        <View style={styles.innerRing}>
          <Ionicons name={icon} size={40} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.actionRow}>
        {actionLabel && onAction && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onAction}
            activeOpacity={0.85}
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.heroText} />
            <Text style={styles.primaryBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onSecondaryAction}
            activeOpacity={0.85}
            accessibilityLabel={secondaryActionLabel}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    iconContainer: {
      width: 100,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    outerRing: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary + '08',
    },
    innerRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 22,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.md,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md - 2,
      minHeight: 44,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.full,
    },
    primaryBtnText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.heroText,
      fontWeight: '700',
    },
    secondaryBtn: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md - 2,
      minHeight: 44,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
