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
  chart: [
    '#8B5CF6',
    '#10B981',
    '#F59E0B',
    '#F43F5E',
    '#38BDF8',
    '#EAB308',
    '#14B8A6',
    '#F97316',
  ],
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
  textMuted: '#94A3B8',
  textInverse: '#F8FAFC',
  chart: [
    '#7C3AED',
    '#059669',
    '#D97706',
    '#E11D48',
    '#0D9488',
    '#CA8A04',
    '#06B6D4',
    '#EA580C',
  ],
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

export const SHADOWS = {
  sm: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#7C3AED',
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
} as const;

export const CURRENCY = {
  symbol: 'Rs',
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
  'user_profile',
] as const;

export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

export const formatCurrency = (amount: number, showSign = false): string => {
  const formatted = new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

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

export const generateId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
