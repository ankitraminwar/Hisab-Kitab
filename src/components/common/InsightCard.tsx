import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { IoniconsName, SpendingInsight } from '@/utils/types';

interface InsightCardProps {
  insight: SpendingInsight;
}

export const InsightCard: React.FC<InsightCardProps> = React.memo(({ insight }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bgColor = insight.color + '10';
  const borderColor = insight.color + '25';

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor }]}>
      <View style={[styles.iconWrap, { backgroundColor: insight.color + '20' }]}>
        <Ionicons name={insight.icon as IoniconsName} size={18} color={insight.color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {insight.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {insight.description}
        </Text>
      </View>
    </View>
  );
});

InsightCard.displayName = 'InsightCard';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      marginBottom: SPACING.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    description: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}
