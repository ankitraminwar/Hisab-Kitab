import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '@/utils/constants';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
  secondRightIcon?: string;
  onSecondRightPress?: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showBack = true,
  rightIcon,
  onRightPress,
  secondRightIcon,
  onSecondRightPress,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {showBack ? (
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: 'transparent' }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      <Text
        style={[styles.title, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.rightActions}>
        {secondRightIcon && (
          <TouchableOpacity
            onPress={onSecondRightPress}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={secondRightIcon as never}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightPress}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={rightIcon as never}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  title: {
    ...TYPOGRAPHY.h3,
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
