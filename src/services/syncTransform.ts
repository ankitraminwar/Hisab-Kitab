import type { SyncableTable } from '../utils/constants';

/** Columns that exist locally (added by MigrationRunner v1) but not in Supabase. */
const LOCAL_ONLY_COLUMNS = new Set([
  'last_modified',
  'server_id',
  'version_hash',
  'sync_status', // migration v1 duplicate — base schema uses camelCase syncStatus
]);

const baseLocalToRemote: Record<string, string> = {
  userId: 'user_id',
  syncStatus: 'sync_status',
  lastSyncedAt: 'last_synced_at',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const tableLocalToRemote: Partial<Record<SyncableTable, Record<string, string>>> = {
  accounts: {
    isDefault: 'is_default',
  },
  categories: {
    isCustom: 'is_custom',
    parentId: 'parent_id',
  },
  transactions: {
    categoryId: 'category_id',
    accountId: 'account_id',
    toAccountId: 'to_account_id',
    paymentMethod: 'payment_method',
    isRecurring: 'is_recurring',
    recurringId: 'recurring_id',
    date: 'transaction_date',
  },
  budgets: {
    categoryId: 'category_id',
    limitAmount: 'limit_amount',
    alertAt: 'alert_at',
  },
  goals: {
    targetAmount: 'target_amount',
    currentAmount: 'current_amount',
    accountId: 'account_id',
    isCompleted: 'is_completed',
  },
  assets: {
    lastUpdated: 'last_updated',
  },
  liabilities: {
    interestRate: 'interest_rate',
    dueDate: 'due_date',
    lastUpdated: 'last_updated',
  },
  net_worth_history: {
    totalAssets: 'total_assets',
    totalLiabilities: 'total_liabilities',
    netWorth: 'net_worth',
    date: 'transaction_date',
  },
  user_profile: {
    monthlyBudget: 'monthly_budget',
    themePreference: 'theme_preference',
    notificationsEnabled: 'notifications_enabled',
    biometricEnabled: 'biometric_enabled',
    avatar: 'avatar',
  },
  split_expenses: {
    transactionId: 'transaction_id',
    paidByUserId: 'paid_by_user_id',
    totalAmount: 'total_amount',
    splitMethod: 'split_method',
  },
  split_members: {
    splitExpenseId: 'split_expense_id',
    friendId: 'friend_id',
    shareAmount: 'share_amount',
    sharePercent: 'share_percent',
  },
  split_friends: {},
  payment_methods: {
    isCustom: 'is_custom',
  },
  notes: {
    isPinned: 'is_pinned',
  },
  recurring_templates: {
    categoryId: 'category_id',
    accountId: 'account_id',
    isActive: 'is_active',
    startDate: 'start_date',
    nextDue: 'next_due',
  },
};

const invert = (mapping: Record<string, string>) =>
  Object.fromEntries(Object.entries(mapping).map(([localKey, remoteKey]) => [remoteKey, localKey]));

const tableRemoteToLocal = Object.fromEntries(
  (Object.entries(tableLocalToRemote) as [SyncableTable, Record<string, string>][]).map(
    ([table, mapping]) => [table, invert({ ...baseLocalToRemote, ...mapping })],
  ),
) as Partial<Record<SyncableTable, Record<string, string>>>;

const toBooleanIfNeeded = (key: string, value: unknown) => {
  if (
    [
      'isDefault',
      'isCustom',
      'isRecurring',
      'isCompleted',
      'isActive',
      'isPinned',
      'notificationsEnabled',
      'biometricEnabled',
    ].includes(key)
  ) {
    return Boolean(value);
  }

  return value;
};

/**
 * Columns that are NOT NULL in Supabase but nullable in SQLite.
 * Map remote column name → default value to coalesce nulls before sync.
 */
const REMOTE_NOT_NULL_DEFAULTS: Partial<Record<SyncableTable, Record<string, unknown>>> = {
  accounts: { is_default: false, color: '#7C3AED', icon: 'wallet' },
  categories: { is_custom: false },
  transactions: { tags: '[]', is_recurring: false },
  budgets: { alert_at: 80 },
  goals: { is_completed: false, icon: 'flag', color: '#7C3AED' },
  liabilities: { interest_rate: 0 },
  recurring_templates: { tags: '[]', is_active: true },
  payment_methods: { is_custom: false },
};

export const mapLocalToRemoteRecord = (
  table: SyncableTable,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const mapping = {
    ...baseLocalToRemote,
    ...(tableLocalToRemote[table] ?? {}),
  };

  const mapped = Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !LOCAL_ONLY_COLUMNS.has(key))
      .map(([key, value]) => [mapping[key] ?? key, value]),
  );

  // Coalesce nulls to Supabase NOT NULL defaults
  const defaults = REMOTE_NOT_NULL_DEFAULTS[table];
  if (defaults) {
    for (const [col, fallback] of Object.entries(defaults)) {
      if (mapped[col] === null || mapped[col] === undefined) {
        mapped[col] = fallback;
      }
    }
  }

  return mapped;
};

export const mapRemoteToLocalRecord = (
  table: SyncableTable,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const mapping = tableRemoteToLocal[table] ?? invert(baseLocalToRemote);

  const localRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      const localKey = mapping[key] ?? key;
      return [localKey, toBooleanIfNeeded(localKey, value)];
    }),
  );

  // Finding: Protect system-default records from remote deletion or custom overrides
  // (e.g., cat_food, pm_cash, acc_cash)
  const id = String(localRecord.id || '');
  if (id.startsWith('cat_') || id.startsWith('pm_') || id === 'acc_cash') {
    localRecord.deletedAt = null;
    if (table === 'categories' || table === 'payment_methods') {
      localRecord.isCustom = 0;
    }
    if (table === 'accounts' && id === 'acc_cash') {
      localRecord.isDefault = 1;
    }
  }

  return localRecord;
};
