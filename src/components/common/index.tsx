import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, ViewStyle, TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOWS, formatCurrency } from '../utils/constants';
import { TransactionType } from '../utils/types';

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  glow?: boolean;
}
export const Card: React.FC<CardProps> = ({ children, style, onPress, glow }) => {
  const content = (
    <View style={[styles.card, glow && styles.cardGlow, style]}>
      {children}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>;
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
  const color = type === 'income' ? COLORS.income
    : type === 'expense' ? COLORS.expense
    : COLORS.textPrimary;

  const fontSize = size === 'xl' ? 36 : size === 'lg' ? 24 : size === 'md' ? 18 : 14;
  const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : '';

  return (
    <Text style={[{ color, fontSize, fontWeight: '700' }, style]}>
      {prefix}{formatCurrency(amount)}
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
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ icon, color, name, size = 40 }) => (
  <View style={styles.badgeContainer}>
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Ionicons name={icon as any} size={size * 0.5} color={color} />
    </View>
    {name && <Text style={styles.badgeName} numberOfLines={1}>{name}</Text>}
  </View>
);

// ─── Progress Bar ─────────────────────────────────────────────────────────────
interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  style?: ViewStyle;
}
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = COLORS.primary, height = 6, style }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const barColor = progress > 0.9 ? COLORS.expense : progress > 0.75 ? COLORS.warning : color;
  return (
    <View style={[styles.progressBg, { height }, style]}>
      <View style={[styles.progressFill, { width: `${clampedProgress * 100}%`, backgroundColor: barColor, height }]} />
    </View>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Empty State ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Ionicons name={icon as any} size={32} color={COLORS.textMuted} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    {action && (
      <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
        <Text style={styles.emptyActionText}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Search Bar ───────────────────────────────────────────────────────────────
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}
export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search...' }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      style={styles.searchInput}
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')}>
        <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    )}
  </View>
);

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
}
export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', loading, disabled, icon, style }) => {
  const bgColor = variant === 'primary' ? COLORS.primary
    : variant === 'danger' ? COLORS.expense
    : variant === 'secondary' ? COLORS.bgElevated
    : 'transparent';

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: bgColor, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: COLORS.border }, style, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.textPrimary} />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={18} color={COLORS.textPrimary} style={{ marginRight: 8 }} />}
          <Text style={styles.buttonText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ─── FAB ─────────────────────────────────────────────────────────────────────
interface FABProps {
  onPress: () => void;
  icon?: string;
}
export const FAB: React.FC<FABProps> = ({ onPress, icon = 'add' }) => (
  <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.fabInner}>
      <Ionicons name={icon as any} size={28} color="#fff" />
    </View>
  </TouchableOpacity>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  amount: number;
  type?: TransactionType;
  icon: string;
  change?: number;
}
export const StatCard: React.FC<StatCardProps> = ({ title, amount, type, icon, change }) => (
  <View style={styles.statCard}>
    <View style={styles.statHeader}>
      <Text style={styles.statTitle}>{title}</Text>
      <View style={[styles.statIconBg, { backgroundColor: (type === 'income' ? COLORS.income : type === 'expense' ? COLORS.expense : COLORS.primary) + '20' }]}>
        <Ionicons name={icon as any} size={16} color={type === 'income' ? COLORS.income : type === 'expense' ? COLORS.expense : COLORS.primary} />
      </View>
    </View>
    <AmountText amount={amount} type={type} size="lg" style={{ marginTop: 6 }} />
    {change !== undefined && (
      <Text style={[styles.statChange, { color: change >= 0 ? COLORS.income : COLORS.expense }]}>
        {change >= 0 ? '+' : ''}{change.toFixed(1)}% from last month
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardGlow: {
    ...SHADOWS.sm,
    borderColor: COLORS.primary + '30',
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
    color: COLORS.textSecondary,
    maxWidth: 64,
    textAlign: 'center',
  },
  progressBg: {
    backgroundColor: COLORS.bgElevated,
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
    color: COLORS.textPrimary,
  },
  sectionAction: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '20',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  emptyActionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
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
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  statCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
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
});
