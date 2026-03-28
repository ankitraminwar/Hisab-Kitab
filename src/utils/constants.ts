export const DARK_COLORS = {
  primary: '#8B5CF6',
  primaryLight: '#A78BFA',
  primaryDark: '#7C3AED',
  secondary: '#14B8A6',
  income: '#10B981',
  expense: '#F43F5E',
  transfer: '#38BDF8',
  warning: '#F59E0B',
  bg: '#0F0F1A',
  bgCard: '#1E1E2E',
  bgElevated: '#2D2D44',
  bgInput: '#1E1E2E',
  border: '#2D2D44',
  borderLight: '#3D3D5C',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#F8FAFC',
  chart: ['#8B5CF6', '#10B981', '#F59E0B', '#F43F5E', '#38BDF8', '#EAB308', '#14B8A6', '#F97316'],
} as const;

export const LIGHT_COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#6D28D9',
  secondary: '#06B6D4',
  income: '#059669',
  expense: '#E11D48',
  transfer: '#2563EB',
  warning: '#D97706',
  bg: '#F7F6F8',
  bgCard: '#FFFFFF',
  bgElevated: '#F1F0F3',
  bgInput: '#F1F0F3',
  border: '#E5E7EB',
  borderLight: '#D1D5DB',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#78839B',
  textInverse: '#F8FAFC',
  chart: ['#7C3AED', '#059669', '#D97706', '#E11D48', '#0D9488', '#CA8A04', '#06B6D4', '#EA580C'],
} as const;

// Legacy export for files not yet refactored to useTheme hook
// default to light mode colors until all screens are migrated to useTheme
export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const TYPOGRAPHY = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
} as const;

export const FONTS = {
  Manrope: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semiBold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extraBold: 'Manrope_800ExtraBold',
  },
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  primary: {
    shadowColor: 'rgba(139,92,246,0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const CURRENCY = {
  symbol: '₹',
  code: 'INR',
  locale: 'en-IN',
} as const;

export const SYNCABLE_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'assets',
  'liabilities',
  'net_worth_history',
  'recurring_templates',
  'split_expenses',
  'split_members',
  'split_friends',
  'user_profile',
  'payment_methods',
  'notes',
] as const;

export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

const currencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (amount: number, showSign = false): string => {
  const formatted = currencyFormatter.format(Math.abs(amount));

  if (showSign && amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `-${formatted}`;
  }
  return formatted;
};

export const formatCompact = (amount: number): string => {
  const absoluteAmount = Math.abs(amount);
  if (absoluteAmount >= 10000000) {
    return `${CURRENCY.symbol}${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (absoluteAmount >= 100000) {
    return `${CURRENCY.symbol}${(amount / 100000).toFixed(1)}L`;
  }
  if (absoluteAmount >= 1000) {
    return `${CURRENCY.symbol}${(amount / 1000).toFixed(1)}K`;
  }
  return `${CURRENCY.symbol}${amount.toFixed(0)}`;
};

/**
 * Generates a RFC-4122 compliant UUID v4 using the Hermes-native
 * `crypto.randomUUID()` API (available since RN 0.71 / Hermes 0.12).
 * Falls back to a random-based UUID if the native API is unavailable
 * (e.g., Jest / non-Hermes environments).
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC-4122 v4 UUID via Math.random (test environments)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
