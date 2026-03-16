# Architecture — Hisab Kitab

## Runtime Model

```
Mobile App (Expo/RN)
  → SQLite (local source of truth, always available)
  → Sync Service (background push/pull queue)
  → Supabase (PostgreSQL + Auth + RLS)
  → Edge Functions (email reports via Resend)
  → Android Widget Host (react-native-android-widget)
```

## Data Layer

### Local SQLite

Schema defined in `src/database/index.ts`. Tables:

| Table                 | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `accounts`            | Bank/wallet/UPI/credit card accounts      |
| `categories`          | Transaction categories with icons/colors  |
| `transactions`        | Income/expense/transfer records           |
| `budgets`             | Monthly per-category budgets              |
| `goals`               | Savings goals with progress               |
| `assets`              | Net worth assets (bank, stocks, gold, …)  |
| `liabilities`         | Net worth liabilities (loan, mortgage, …) |
| `net_worth_history`   | Monthly net worth snapshots               |
| `user_profile`        | User settings, theme, notification prefs  |
| `recurring_templates` | Recurring transaction definitions         |
| `split_expenses`      | Split expense headers                     |
| `split_members`       | Split expense member shares               |
| `payment_methods`     | Payment method definitions                |
| `sync_queue`          | Pending sync operations                   |
| `sync_state`          | Per-table last-synced timestamps          |

### Supabase Remote

Mirrors local tables with snake_case columns. Full idempotent schema in `supabase/schema.sql`.
RLS policies enforce per-user data isolation via `auth.uid()`.

### Column Mapping

`src/services/syncTransform.ts` maps between local camelCase and remote snake_case:

- `transactionId` ↔ `transaction_id`
- `splitExpenseId` ↔ `split_expense_id`
- `paidByUserId` ↔ `paid_by_user_id`
- `limit_amount` ↔ `limit_amount` (unchanged — shared name)
- (all synced tables have full mappings defined)

## Sync Flow

```
Local Write → SQLite → enqueueSync() → sync_queue table
                                             ↓
                               triggerBackgroundSync() called
                                             ↓
                          syncService.pushPendingChanges()
                           Push queue items → Supabase
                                             ↓
                          syncService.pullRemoteChanges()
                           Pull rows updated since last sync
                                             ↓
                          Merge into local SQLite (upsert)
                                             ↓
                          bumpDataRevision() → UI re-renders
```

- **Triggers**: app start, auth state change, network reconnect, manual sync button, after each local write.
- **Conflict resolution**: latest `updated_at` wins.
- **Soft deletes**: `deletedAt` timestamp set, row never hard-deleted locally.
- **Offline guarantee**: all writes succeed locally; sync retries automatically when connectivity is restored.
- `SYNCABLE_TABLES` in `src/utils/constants.ts` controls which tables participate in sync.

## Auth

| Component       | Location                                           |
| --------------- | -------------------------------------------------- |
| Supabase client | `src/lib/supabase.ts`                              |
| Auth service    | `src/services/auth.ts`                             |
| Biometric lock  | `src/services/auth.ts` (expo-local-authentication) |
| Auth screens    | `src/screens/auth/AuthScreen.tsx`                  |

Flow:

1. Root layout (`app/_layout.tsx`) checks session on boot
2. No session → redirect to `/login`
3. Session exists + biometrics enabled → lock screen shown
4. Biometrics pass or disabled → app unlocked
5. Logout → clears SQLite, resets Zustand store, redirects to `/login`

## State Management

Single Zustand store in `src/store/appStore.ts`:

| Key                                                                        | Purpose                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------- |
| `theme`                                                                    | `'dark' \| 'light' \| 'system'`                           |
| `isLocked` / `biometricsEnabled` / `pinEnabled`                            | Auth lock state                                           |
| `biometricsPrompted`                                                       | Whether the biometrics prompt has been shown this session |
| `isOnline`                                                                 | NetInfo connectivity flag                                 |
| `syncInProgress` / `lastSyncAt` / `lastSyncError`                          | Sync status                                               |
| `userProfile`                                                              | Cached user profile row                                   |
| `accounts` / `categories` / `budgets` / `goals` / `assets` / `liabilities` | Cached lists                                              |
| `dashboardStats`                                                           | Cached income/expense/net worth summary                   |
| `recentTransactions`                                                       | Cached recent transaction list for dashboard              |
| `dataRevision`                                                             | Counter bumped after every write — screens re-fetch data  |
| `notificationPreferences`                                                  | Local notification settings                               |
| `smsEnabled`                                                               | Whether SMS background polling is active                  |
| `selectedMonth`                                                            | Currently selected month for month-scoped screens         |

## Type System

All types defined in `src/utils/types.ts`. No `any` in the codebase.

| Type / Interface     | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `IoniconsName`       | Strict type for `@expo/vector-icons` Ionicons icon names  |
| `ThemeColors`        | Union of `DARK_COLORS \| LIGHT_COLORS` from `useTheme.ts` |
| `TransactionType`    | `'expense' \| 'income' \| 'transfer'`                     |
| `AccountType`        | `'cash' \| 'bank' \| 'upi' \| …`                          |
| `SplitMethod`        | `'equal' \| 'exact' \| 'percent'`                         |
| `SyncQueueItem`      | Local sync queue entry                                    |
| `DashboardStats`     | Aggregated balance/income/expense/netWorth                |
| `PaginatedResult<T>` | Generic paginated query result                            |
| `TransactionFilters` | Filter params for transaction queries                     |

## Service Layer

| Service                | File                    | Purpose                                                       |
| ---------------------- | ----------------------- | ------------------------------------------------------------- |
| `AccountService`       | `dataService.ts`        | Account CRUD                                                  |
| `CategoryService`      | `dataService.ts`        | Category CRUD                                                 |
| `BudgetService`        | `dataService.ts`        | Budget CRUD + spent calculation                               |
| `GoalService`          | `dataService.ts`        | Goal CRUD + fund/withdraw                                     |
| `NetWorthService`      | `dataService.ts`        | Asset, Liability, NetWorthHistory CRUD                        |
| `UserProfileService`   | `dataService.ts`        | Profile read/upsert                                           |
| `PaymentMethodService` | `dataService.ts`        | Payment method CRUD                                           |
| `DataService`          | `dataServices.ts`       | Re-export umbrella + aggregate helpers                        |
| `TransactionService`   | `transactionService.ts` | Transaction CRUD, filtered queries, CSV export, monthly stats |
| `SplitService`         | `splitService.ts`       | Split expense create/read/update/delete, mark share paid      |
| `SyncService`          | `syncService.ts`        | Background push/pull sync orchestration                       |
| `syncTransform`        | `syncTransform.ts`      | camelCase ↔ snake_case column mapping for all synced tables   |
| `authService`          | `auth.ts`               | Sign in/up/out, biometric, session management, profile create |
| `SmsReadService`       | `smsReadService.ts`     | Android SMS list + bank message parser (regex-based)          |
| `SmsService`           | `sms.ts`                | SMS polling, deduplication, transaction creation from SMS     |
| `NotificationService`  | `notifications.ts`      | Expo scheduled notification management                        |
| `exportService`        | `exportService.ts`      | CSV export, PDF export, full JSON backup, JSON import         |
| `emailReportService`   | `emailReportService.ts` | Monthly summary email via Supabase Edge Function + Resend     |
| `WidgetDataService`    | `widgetDataService.ts`  | Data fetchers for Android home screen widgets                 |
| `MigrationRunner`      | `MigrationRunner.ts`    | SQLite schema migration helper                                |
| `permissions`          | `permissions.ts`        | Android runtime permission requests                           |

## Component Library (`src/components/common/`)

| Component         | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `Card`            | Rounded bordered container with optional press + glow      |
| `Button`          | Primary/secondary/danger/ghost button with loading state   |
| `FAB`             | Floating action button                                     |
| `EmptyState`      | Centered empty list placeholder with icon, title, action   |
| `CategoryBadge`   | Circular icon badge with category color                    |
| `CategoryGrid`    | Responsive grid of selectable category tiles               |
| `SearchBar`       | Controlled search input with clear button                  |
| `ProgressBar`     | Horizontal progress bar with color-coded overflow states   |
| `SectionHeader`   | Section title row with optional action link                |
| `StatCard`        | Metric card showing amount + type icon + trend             |
| `CustomPopup`     | Animated modal popup (success/error/info) — replaces Alert |
| `CustomSwitch`    | Animated toggle switch with spring physics                 |
| `AmountText`      | Currency-formatted text with income/expense color coding   |
| `PeriodTabs`      | Month/year period selector tabs                            |
| `ScreenHeader`    | Consistent back-button header bar                          |
| `NumericKeypad`   | Custom number keypad for amount entry                      |
| `TransactionItem` | Swipeable transaction row with gesture + animation         |

## Screen Architecture

Every screen follows this pattern:

```tsx
export default function XScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);
  // fetch data on mount + when dataRevision changes
  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <ScrollView>{/* sections */}</ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ ... });
}
```

## Routing

File-based routing via expo-router. Route → screen mapping:

- `app/(tabs)/` — Bottom tab bar (Dashboard, History, [FAB center], Budgets, Profile)
- `app/(tabs)/goals.tsx` — Goals screen (hidden tab, `href: null` — navigated to directly)
- `app/(tabs)/reports.tsx` — Reports screen (hidden tab, `href: null` — navigated to directly)
- `app/transactions/add.tsx` — Add transaction modal
- `app/transactions/[id].tsx` — Edit transaction modal
- `app/split-expense/[id].tsx` — Split create (`id=new`) or detail view
- `app/splits/index.tsx` — Split expense list
- `app/auth/` — Login, signup, forgot/reset password
- `app/settings/index.tsx` — Settings
- `app/accounts/index.tsx` — Accounts management
- `app/sms-import.tsx` — SMS import modal
- `app/notifications.tsx` — Notifications screen
- `app/profile/edit.tsx` — Edit profile screen

Modal routes: `presentation: 'modal'` with `slide_from_bottom` or `slide_from_right`.

## Android Widgets

Three home screen widgets via `react-native-android-widget`:

| Widget           | Data Source         | Shows                                           |
| ---------------- | ------------------- | ----------------------------------------------- |
| `ExpenseSummary` | `WidgetDataService` | Current month income, expense, top 4 categories |
| `QuickAdd`       | —                   | Deep-link button to `/transactions/add`         |
| `BudgetHealth`   | `WidgetDataService` | Budget usage bars, overall spend percent        |

Widget task handler: `src/widgets/widgetTaskHandler.ts`

## SMS Import (Android Only)

- Uses `react-native-get-sms-android` (native build only — not Expo Go)
- `SmsReadService` parses bank/UPI messages with regex: detects `debited/credited/spent/received` keywords, extracts INR/Rs amounts and merchant names
- `SmsMessage` interface typed: `{ _id, address, body, date }`
- Imported transactions are deduplicated via SMS-derived tags before creation
- Background polling runs via `sms.ts`; user can also trigger manually from SMS Import screen
- Imported transactions sync to Supabase like any other transaction

## Export & Email

- **CSV**: current month transactions via `TransactionService.exportToCSV()`
- **PDF**: HTML template rendered via `expo-print`, shared via `expo-sharing`
- **JSON backup**: full database export as JSON, importable to restore data
- **Email report**: monthly income/expense summary sent to user's email via Supabase Edge Function (`send-email`) + Resend API

## Code Quality

- **TypeScript**: strict mode, `tsc --noEmit` = 0 errors
- **ESLint**: `eslint . --max-warnings 0` = 0 warnings
- **No `any`**: all `as any` and `: any` eliminated; replaced with `IoniconsName`, `ThemeColors`, `SmsMessage`, `DimensionValue`, `SyncableTable` proper types
- **Formatting**: Prettier enforced via `npm run format`; pre-commit hook via husky + lint-staged
