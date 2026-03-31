import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { IoniconsName, TransactionType } from '../../utils/types';

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  glow?: boolean;
}
export const Card: React.FC<CardProps> = ({ children, style, onPress, glow }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const content = <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
  if (onPress)
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  return content;
};

// ─── Amount Display ───────────────────────────────────────────────────────────
interface AmountProps {
  amount: number;
  type?: TransactionType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: TextStyle;
}
export const AmountText: React.FC<AmountProps> = ({ amount, type, size = 'md', style }) => {
  const { colors } = useTheme();
  const color =
    type === 'income' ? colors.income : type === 'expense' ? colors.expense : colors.textPrimary;

  const fontSize = size === 'xl' ? 36 : size === 'lg' ? 24 : size === 'md' ? 18 : 14;
  const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : '';

  return (
    <Text style={[{ color, fontSize, fontWeight: '700' }, style]}>
      {prefix}
      {formatCurrency(amount)}
    </Text>
  );
};

// ─── Category Badge ───────────────────────────────────────────────────────────
interface CategoryBadgeProps {
  icon: string;
  color: string;
  name?: string;
  size?: number;
}
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ icon, color, name, size = 40 }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.badgeContainer}>
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color + '20',
            borderColor: color + '40',
          },
        ]}
      >
        <Ionicons name={icon as IoniconsName} size={size * 0.5} color={color} />
      </View>
      {name && (
        <Text style={styles.badgeName} numberOfLines={1}>
          {name}
        </Text>
      )}
    </View>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  style?: ViewStyle;
}
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color, height = 6, style }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const resolvedColor = color || colors.primary;

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const barColor =
    progress > 0.9 ? colors.expense : progress > 0.75 ? colors.warning : resolvedColor;
  return (
    <View style={[styles.progressBg, { height }, style]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: barColor,
            height,
          },
        ]}
      />
    </View>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action, onAction }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Empty State ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  action,
  onAction,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as IoniconsName} size={36} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={onAction}
          accessibilityLabel={action}
          accessibilityRole="button"
        >
          <Text style={styles.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Search Bar ───────────────────────────────────────────────────────────────
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export * from './Button';

// ─── FAB ─────────────────────────────────────────────────────────────────────
interface FABProps {
  onPress: () => void;
  icon?: string;
}
export const FAB: React.FC<FABProps> = ({ onPress, icon = 'add' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, false), [colors]);
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      activeOpacity={0.85}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Add new"
    >
      <View style={styles.fabInner}>
        <Ionicons name={icon as IoniconsName} size={28} color={colors.heroText} />
      </View>
    </TouchableOpacity>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  amount: number;
  type?: TransactionType;
  icon: string;
  change?: number;
}
export const StatCard: React.FC<StatCardProps> = ({ title, amount, type, icon, change }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <View
          style={[
            styles.statIconBg,
            {
              backgroundColor:
                (type === 'income'
                  ? colors.income
                  : type === 'expense'
                    ? colors.expense
                    : colors.primary) + '20',
            },
          ]}
        >
          <Ionicons
            name={icon as IoniconsName}
            size={16}
            color={
              type === 'income'
                ? colors.income
                : type === 'expense'
                  ? colors.expense
                  : colors.primary
            }
          />
        </View>
      </View>
      <AmountText amount={amount} type={type} size="lg" style={{ marginTop: 6 }} />
      {change !== undefined && (
        <Text style={[styles.statChange, { color: change >= 0 ? colors.income : colors.expense }]}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(1)}% from last month
        </Text>
      )}
    </View>
  );
};

export * from './CustomPopup';

// ─── Custom Switch ────────────────────────────────────────────────────────────
interface CustomSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}
export const CustomSwitch: React.FC<CustomSwitchProps> = ({ value, onValueChange, disabled }) => {
  const { colors } = useTheme();

  const trackAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withSpring(value ? colors.primary : colors.bgElevated, {
        mass: 1,
        damping: 15,
        stiffness: 120,
      }),
    };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: withSpring(value ? 20 : 0, {
            mass: 0.8,
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
      backgroundColor: value ? colors.heroText : colors.textMuted,
    };
  });

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          {
            width: 44,
            height: 24,
            borderRadius: 12,
            justifyContent: 'center',
            padding: 2,
          },
          trackAnimatedStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 20,
              height: 20,
              borderRadius: 10,
              ...SHADOWS.sm,
            },
            thumbAnimatedStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
export class ScreenErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('ScreenErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: SPACING.lg,
          }}
        >
          <Text
            style={{
              ...TYPOGRAPHY.h3,
              marginBottom: SPACING.sm,
              color: '#EF4444',
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              ...TYPOGRAPHY.body,
              color: '#64748B',
              textAlign: 'center',
            }}
          >
            An unexpected error occurred. Please go back and try again.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{
              marginTop: SPACING.lg,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
              backgroundColor: '#7C3AED',
              borderRadius: RADIUS.md,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardGlow: {
      ...SHADOWS.sm,
      borderColor: colors.primary + '30',
    },
    badgeContainer: {
      alignItems: 'center',
      gap: 6,
    },
    badge: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    badgeName: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      maxWidth: 64,
      textAlign: 'center',
    },
    progressBg: {
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      borderRadius: RADIUS.full,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
    },
    sectionAction: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    emptyTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    emptySubtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 22,
    },
    emptyAction: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.sm + 2,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.full,
    },
    emptyActionText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.heroText,
      fontWeight: '700',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
    searchIcon: {},
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      paddingVertical: 0,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.md,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      bottom: 88,
      right: SPACING.md,
      zIndex: 100,
    },
    fabInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.md,
    },
    statCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      flex: 1,
    },
    statHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statTitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statIconBg: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statChange: {
      ...TYPOGRAPHY.caption,
      marginTop: 4,
    },
    popupOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    popupCard: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(40, 40, 45, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      borderRadius: RADIUS.xxl,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      ...SHADOWS.lg,
    },
    popupIconBg: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    popupTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    popupMessage: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
  });
}

export * from './CustomModal';
export * from './PopupProvider';
