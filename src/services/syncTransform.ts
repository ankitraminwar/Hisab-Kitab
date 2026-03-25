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
      'isPinned',
      'notificationsEnabled',
      'biometricEnabled',
    ].includes(key)
  ) {
    return Boolean(value);
  }

  return value;
};

export const mapLocalToRemoteRecord = (
  table: SyncableTable,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const mapping = {
    ...baseLocalToRemote,
    ...(tableLocalToRemote[table] ?? {}),
  };

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !LOCAL_ONLY_COLUMNS.has(key))
      .map(([key, value]) => [mapping[key] ?? key, value]),
  );
};

export const mapRemoteToLocalRecord = (
  table: SyncableTable,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const mapping = tableRemoteToLocal[table] ?? invert(baseLocalToRemote);

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      const localKey = mapping[key] ?? key;
      return [localKey, toBooleanIfNeeded(localKey, value)];
    }),
  );
};
