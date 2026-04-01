import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { IoniconsName } from '@/utils/types';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: IoniconsName;
  leftIconColor?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  rightText?: string;
  rightTextColor?: string;
  onPress?: () => void;
  showChevron?: boolean;
  borderBottom?: boolean;
}

export const ListItem: React.FC<ListItemProps> = React.memo(
  ({
    title,
    subtitle,
    leftIcon,
    leftIconColor,
    leftElement,
    rightElement,
    rightText,
    rightTextColor,
    onPress,
    showChevron = false,
    borderBottom = true,
  }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const resolvedColor = leftIconColor || colors.primary;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          borderBottom && styles.borderBottom,
          pressed && onPress && styles.pressed,
        ]}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={title}
      >
        {/* Left */}
        {(leftIcon || leftElement) && (
          <View style={styles.leftWrap}>
            {leftElement ||
              (leftIcon && (
                <View style={[styles.iconBg, { backgroundColor: resolvedColor + '15' }]}>
                  <Ionicons name={leftIcon} size={18} color={resolvedColor} />
                </View>
              ))}
          </View>
        )}

        {/* Center */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right */}
        {rightElement}
        {rightText && (
          <Text style={[styles.rightText, rightTextColor ? { color: rightTextColor } : undefined]}>
            {rightText}
          </Text>
        )}
        {showChevron && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
      </Pressable>
    );
  },
);

ListItem.displayName = 'ListItem';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      gap: SPACING.md,
      minHeight: 56,
    },
    borderBottom: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pressed: {
      backgroundColor: colors.bgElevated,
    },
    leftWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBg: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    subtitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    rightText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
