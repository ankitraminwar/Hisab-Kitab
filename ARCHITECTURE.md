# Architecture — Hisab Kitab

> **Last Updated:** 2026-04-01

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
| `split_friends`       | Native friend tracker for split balancing |
| `split_members`       | Split expense member shares               |
| `notes`               | User notes / memos                        |
| `payment_methods`     | Payment method definitions                |
| `sync_queue`          | Pending sync operations                   |
| `sync_state`          | Per-table last-synced timestamps          |

### Supabase Remote

Mirrors local tables with snake_case columns. Full idempotent schema in `supabase/schema.sql`.
RLS policies enforce per-user data isolation via `auth.uid()`.

**FK constraint design**: Inter-table foreign keys (e.g. `transactions.category_id → categories.id`) have been intentionally removed from Supabase. Only the `user_id → auth.users(id)` FK is retained on each table. This allows offline-first sync to push records in any order without FK violations. SQLite enforces relational integrity locally via its own FK constraints.

**Materialized view**: `dashboard_monthly_stats` pre-aggregates monthly income/expenses/net per user. Refreshed explicitly by the client (no auto-refresh trigger — removed to avoid write-path overhead). Access via `get_dashboard_stats(month)` RPC function (`security invoker`). Eliminates expensive client-side aggregation.

**Optimized indexes**: GIN index on `tags` column for fast tag-based analytics. Composite indexes on `(transaction_date DESC, type)` and `(type, category_id, account_id)` for dashboard and filter queries.

### Column Mapping

`src/services/syncTransform.ts` maps between local camelCase and remote snake_case:

- `transactionId` ↔ `transaction_id`
- `splitExpenseId` ↔ `split_expense_id`
- `paidByUserId` ↔ `paid_by_user_id`
- `limit_amount` ↔ `limit_amount` (unchanged — shared name)
- (all synced tables have full mappings defined)
- Null-safe coalescing for 10 columns that are nullable in SQLite but NOT NULL in Supabase (e.g. `isDefault`, `isCustom`, `tags`, `alertAt`, `isCompleted`, `interestRate`, `isActive`, `isRecurring`, `isPinned`)

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
- **Parallel pulls**: `pullRemoteChanges()` and `initialSync()` pull tables in parallel by dependency tier (tier 0: independent tables like accounts/categories, tier 1: transactions/budgets, tier 2-3: splits) using `Promise.allSettled()`.
- **Sync queue compaction**: `enqueueSync()` merges multiple mutations for the same `entity+recordId` into a single queue entry, so only the latest payload is pushed.
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
3. Session exists + biometrics enabled → lock screen shown (hardware back button blocked via `BackHandler`)
4. Biometrics pass or disabled → app unlocked
5. Logout → clears SQLite, resets Zustand store, redirects to `/login`

## State Management

Zustand store in `src/store/appStore.ts`, organized into three slices:

| Slice         | Keys                                                                                       | Purpose                                       |
| ------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **AuthSlice** | `isLocked`, `biometricsEnabled`, `biometricsPrompted`, `pinEnabled`, `userProfile`         | Auth & biometric lock state                   |
| **UISlice**   | `isLoading`, `theme`, `notificationPreferences`, `selectedMonth`                           | UI preferences & loading state                |
| **DataSlice** | `isOnline`, `syncInProgress`, `lastSyncAt`, `lastSyncError`, accounts, categories,         | All data caches, sync state, revision counter |
|               | recentTransactions, budgets, goals, assets, liabilities, `dashboardStats`, `dataRevision`, |                                               |
|               | `smsEnabled`                                                                               |                                               |

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

| Service                | File                    | Purpose                                                                     |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `AccountService`       | `dataService.ts`        | Account CRUD                                                                |
| `CategoryService`      | `dataService.ts`        | Category CRUD                                                               |
| `BudgetService`        | `dataService.ts`        | Budget CRUD + spent calculation                                             |
| `GoalService`          | `dataService.ts`        | Goal CRUD + fund/withdraw + update                                          |
| `NetWorthService`      | `dataService.ts`        | Asset, Liability, NetWorthHistory CRUD                                      |
| `UserProfileService`   | `dataService.ts`        | Profile read/upsert                                                         |
| `PaymentMethodService` | `dataService.ts`        | Payment method CRUD                                                         |
| `DataService`          | `dataServices.ts`       | Re-export umbrella + aggregate helpers                                      |
| `TransactionService`   | `transactionService.ts` | Transaction CRUD, filtered queries, CSV export, monthly stats               |
| `SplitService`         | `splitService.ts`       | Split CRUD, friend management, Google Pay style balance aggregation         |
| `SyncService`          | `syncService.ts`        | Background push/pull sync orchestration                                     |
| `syncTransform`        | `syncTransform.ts`      | camelCase ↔ snake_case column mapping for all synced tables                 |
| `authService`          | `auth.ts`               | Sign in/up/out, biometric, session management, profile create               |
| `SmsReadService`       | `smsReadService.ts`     | Android SMS list + bank message parser (regex-based)                        |
| `SmsService`           | `sms.ts`                | SMS polling, deduplication, transaction creation from SMS                   |
| `NotificationService`  | `notifications.ts`      | Expo scheduled notification management                                      |
| `exportService`        | `exportService.ts`      | CSV export, PDF export, full JSON backup, JSON import                       |
| `emailReportService`   | `emailReportService.ts` | Monthly summary email via Supabase Edge Function + Resend                   |
| `WidgetDataService`    | `widgetDataService.ts`  | Data fetchers for Android home screen widgets                               |
| `NoteService`          | `noteService.ts`        | Notes CRUD                                                                  |
| `Analytics`            | `analytics.ts`          | Firebase Analytics wrapper (screen views, events, user properties)          |
| `MigrationRunner`      | `MigrationRunner.ts`    | SQLite migration runner + orphaned table cleanup (consolidated base schema) |
| `permissions`          | `permissions.ts`        | Android runtime permission requests                                         |

## Component Library (`src/components/common/`)

| Component         | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `Card`            | Rounded bordered container with optional press + glow                |
| `Button`          | Primary/secondary/danger/ghost button with loading state             |
| `FAB`             | Simple floating action button (single action)                        |
| `SpeedDialFAB`    | Multi-action FAB with animated overlay, label pills, and `hideMainButton` option |
| `Toast` (AppToast)| Compact pill-style toast (icon + text, themed) — replaces react-native-toast-message defaults |
| `EmptyState`      | Centered empty list placeholder with icon, title, action             |
| `CategoryBadge`   | Circular icon badge with category color                              |
| `CategoryGrid`    | Responsive grid of selectable category tiles                         |
| `SearchBar`       | Controlled search input with clear button                            |
| `ProgressBar`     | Horizontal progress bar with color-coded overflow states             |
| `SectionHeader`   | Section title row with optional action link                          |
| `StatCard`        | Metric card showing amount + type icon + trend                       |
| `CustomPopup`     | Animated modal popup (success/error/info) — replaces Alert           |
| `CustomSwitch`    | Animated toggle switch with spring physics                           |
| `AmountText`      | Currency-formatted text with income/expense color coding             |
| `PeriodTabs`      | Month/year period selector tabs                                      |
| `ScreenHeader`    | Consistent back-button header bar                                    |
| `NumericKeypad`   | Custom number keypad for amount entry                                |
| `TransactionItem` | Swipeable transaction row with gesture + animation + haptic feedback |

### Haptic Feedback

`expo-haptics` light impact feedback is wired into:

- `Button` component (every press)
- `NumericKeypad` keys and backspace
- `TransactionItem` long press

### Skeleton Loaders

`src/components/common/SkeletonLoader.tsx` provides `SkeletonTransactionItem` and `SkeletonList` components for loading states using reanimated opacity pulse.

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

- `app/(tabs)/` — Bottom tab bar (Dashboard, History, [SpeedDialFAB center], Budgets, Profile)
- `app/(tabs)/goals.tsx` — Goals screen (hidden tab, `href: null` — navigated to directly)
- `app/(tabs)/reports.tsx` — Reports screen (hidden tab, `href: null` — navigated to directly)
- `app/transactions/add.tsx` — Add transaction modal
- `app/transactions/[id].tsx` — Edit transaction modal
- `app/split-expense/[id].tsx` — Split create (`id=new`) or detail view
- `app/split-expense/friend-detail/[id].tsx` — Friend timeline and settlement
- `app/splits/index.tsx` — Split expense list
- `app/auth/` — Login, signup, forgot/reset password
- `app/settings/index.tsx` — Settings
- `app/accounts/index.tsx` — Accounts management
- `app/sms-import.tsx` — SMS import modal
- `app/notifications.tsx` — Notifications screen
- `app/notes.tsx` — Notes screen
- `app/profile/edit.tsx` — Edit profile screen

Modal routes: `presentation: 'modal'` with `slide_from_bottom` or `slide_from_right`.

### Lazy Loading

Chart-heavy tabs (`reports.tsx`, `budgets.tsx`, `goals.tsx`) use `React.lazy()` + `Suspense` wrappers to defer loading their screen bundles until the user navigates to them.

## Android Widgets

Three home screen widgets via `react-native-android-widget`:

| Widget           | Data Source         | Shows                                           |
| ---------------- | ------------------- | ----------------------------------------------- |
| `ExpenseSummary` | `WidgetDataService` | Current month income, expense, top 4 categories |
| `QuickAdd`       | —                   | Deep-link button to `/transactions/add`         |
| `BudgetHealth`   | `WidgetDataService` | Budget usage bars, overall spend percent        |

Widget deep links use `hisabkitab://` scheme (double slash, no triple slash). e.g. `hisabkitab://transactions/add`.

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
- **Formatting**: Prettier enforced via `yarn format`; pre-commit hook via husky + lint-staged

## Build Optimizations

- **R8/ProGuard**: Enabled via `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` in `android/gradle.properties`. Reduces bundle size by removing unused code and resources.
- **AAB production builds**: EAS production profile builds Android App Bundle (`.aab`) for Play Store distribution, enabling Google Play's dynamic delivery.
- **Hermes**: `jsEngine: "hermes"` set in `app.json`. Bytecode compilation for faster startup.
- **Dashboard chart**: Donut chart uses SQL-backed `getCategoryBreakdownByDateRange()` for accurate full-month category data instead of aggregating from limited recent transactions.
