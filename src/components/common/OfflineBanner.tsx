import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/appStore';
import { SPACING, TYPOGRAPHY } from '../../utils/constants';

export function OfflineBanner() {
  const isOnline = useAppStore((s) => s.isOnline);
  const { colors } = useTheme();

  if (isOnline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(250)}
      style={[styles.container, { backgroundColor: colors.warning }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>You are offline</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  text: {
    ...TYPOGRAPHY.caption,
    color: '#fff',
    fontWeight: '600',
  },
});
