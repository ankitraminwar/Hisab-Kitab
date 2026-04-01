import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { FABAction, IoniconsName } from '@/utils/types';

interface SpeedDialFABProps {
  actions: FABAction[];
  isOpen: boolean;
  onToggle: () => void;
  /** When true, only renders overlay + action items (no main "+" button). */
  hideMainButton?: boolean;
}

const SPRING_CONFIG = { damping: 14, stiffness: 150, mass: 0.8 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SpeedDialFAB: React.FC<SpeedDialFABProps> = ({
  actions,
  isOpen,
  onToggle,
  hideMainButton,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(isOpen ? 1 : 0, SPRING_CONFIG);
  }, [isOpen, progress]);

  const handleToggle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  }, [onToggle]);

  const handleAction = useCallback(
    (action: FABAction) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle();
      // Small delay so close animation starts before navigation
      setTimeout(() => action.onPress(), 150);
    },
    [onToggle],
  );

  const fabRotateStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` },
      { scale: interpolate(progress.value, [0, 1], [1, 0.9]) },
    ],
  }));

  const bottomOffset = Math.max(insets.bottom, 16) + 80; // above tab bar

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, styles.overlay]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
        </Animated.View>
      )}

      {/* Action items */}
      <View style={[styles.container, { bottom: bottomOffset }]}>
        {isOpen &&
          actions.map((action, index) => (
            <ActionItem
              key={action.id}
              action={action}
              index={index}
              total={actions.length}
              progress={progress}
              onPress={() => handleAction(action)}
              colors={colors}
            />
          ))}

        {/* Main FAB — hidden when an external trigger (e.g. tab bar button) is used */}
        {!hideMainButton && (
          <AnimatedPressable
            onPress={handleToggle}
            style={[styles.mainFab, { backgroundColor: colors.primary }, fabRotateStyle]}
            accessibilityLabel={isOpen ? 'Close quick actions' : 'Open quick actions'}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={28} color={colors.heroText} />
          </AnimatedPressable>
        )}
      </View>
    </>
  );
};

interface ActionItemProps {
  action: FABAction;
  index: number;
  total: number;
  progress: SharedValue<number>;
  onPress: () => void;
  colors: ThemeColors;
}

const ActionItem: React.FC<ActionItemProps> = ({
  action,
  index,
  total,
  progress,
  onPress,
  colors,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [40, 0]);
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]);
    const scale = interpolate(progress.value, [0, 1], [0.6, 1]);
    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: SPACING.md,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
        }}
        accessibilityLabel={action.label}
        accessibilityRole="button"
      >
        {/* Label */}
        <View
          style={{
            backgroundColor: colors.bgCard,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
            borderRadius: RADIUS.md,
            ...SHADOWS.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              ...TYPOGRAPHY.bodyMedium,
              color: colors.textPrimary,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {action.label}
          </Text>
        </View>

        {/* Mini FAB */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: action.color,
            alignItems: 'center',
            justifyContent: 'center',
            ...SHADOWS.sm,
          }}
        >
          <Ionicons name={action.icon as IoniconsName} size={22} color={colors.heroText} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
      zIndex: 998,
    },
    container: {
      position: 'absolute',
      right: SPACING.md,
      zIndex: 999,
      alignItems: 'flex-end',
    },
    mainFab: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.md,
    },
  });
}
