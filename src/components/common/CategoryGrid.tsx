import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { Category } from '@/utils/types';

interface CategoryGridProps {
  categories: Category[];
  selectedId?: string;
  onSelect: (category: Category) => void;
  columns?: number;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  selectedId,
  onSelect,
  columns = 4,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        CATEGORIES
      </Text>
      <View style={styles.grid}>
        {categories.map((cat) => {
          const isSelected = cat.id === selectedId;
          const catColor = cat.color || colors.primary;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => onSelect(cat)}
              style={[
                styles.item,
                {
                  width: `${100 / columns - 3}%`,
                  backgroundColor: isSelected ? catColor + '15' : colors.bgCard,
                  borderColor: isSelected ? catColor + '60' : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(cat.icon || 'ellipse') as never}
                size={22}
                color={isSelected ? catColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.itemLabel,
                  { color: isSelected ? catColor : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  item: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  itemLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
  },
});
