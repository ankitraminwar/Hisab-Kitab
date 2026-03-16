# AI Context — Hisab Kitab

> Primary reference for AI coding agents. Read this before modifying any code.

## What This App Is

Offline-first personal finance manager for Android/iOS. Expo + React Native + TypeScript + SQLite + Supabase. Current version: **2.0.0** — zero TypeScript errors, zero ESLint warnings, no `any` types.

## Tech Stack

| Layer       | Technology                                                   |
| ----------- | ------------------------------------------------------------ |
| Framework   | Expo ~54.0.0, React Native 0.81.5                            |
| Language    | TypeScript strict (`tsc --noEmit` = 0 errors)                |
| Routing     | expo-router ~6.0.23 (file-based, typed routes)               |
| Local DB    | expo-sqlite ~16.0.10 (source of truth)                       |
| Remote DB   | Supabase (PostgreSQL + Auth + Edge Functions)                |
| State       | Zustand ^4.4.0 (`src/store/appStore.ts`) + React Query ^5    |
| Styling     | StyleSheet with dynamic theme via `useTheme()` hook          |
| Animations  | react-native-reanimated ~4.1.1, expo-linear-gradient         |
| Charts      | @shopify/react-native-skia ^2.2.12, react-native-svg         |
| Lists       | @shopify/flash-list 2.0.2 (v2 — no `estimatedItemSize` prop) |
| Widgets     | react-native-android-widget ^0.20.1                          |
| SMS parsing | react-native-get-sms-android ^2.1.0                          |
| Linting     | ESLint 9 (`eslint . --max-warnings 0` = 0 warnings)          |
| Formatting  | Prettier (pre-commit via husky + lint-staged)                |

## Hard Rules

1. **Offline-first**: Write to SQLite first, queue for sync. Never block on network.
2. **No secrets in app code**: Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
3. **Column naming**: Local SQLite = camelCase, Supabase = snake_case. Mapping in `src/services/syncTransform.ts`.
4. **Auth gating**: Unauthenticated users → `/login`. Every authenticated user must have a `user_profile` row.
5. **Theme**: All screens must use `useTheme()` colors, never hardcoded `COLORS`. Styles via `createStyles(colors: ThemeColors)` pattern.
6. **Popups**: Use `CustomPopup` component, never `Alert.alert`.
7. **IDs**: All entity IDs are `TEXT` (UUID strings from `generateId()`).
8. **Native features**: SMS import and Android widgets require native builds (not Expo Go). iOS cannot read SMS inbox.
9. **No `any`**: Every type must be explicit. Use `IoniconsName` for Ionicons icon names, `ThemeColors` for color objects, `DimensionValue` for percentage widths, proper interfaces for external data.
10. **FlashList v2**: Do NOT pass `estimatedItemSize` — that prop was removed in v2.0.

## Project Structure

```
app/                             # Expo Router file-based routes
  _layout.tsx                    # Root Stack with auth gating, biometric lock, sync init
  index.tsx                      # Redirects to /(tabs)/
  login.tsx                      # Auth entry — renders AuthScreen in login mode
  (tabs)/
    _layout.tsx                  # Animated tab bar: Dashboard, History, [FAB], Budgets, Profile
    index.tsx                    # Dashboard tab
    transactions.tsx             # History tab
    budgets.tsx                  # Budgets tab
    profile.tsx                  # Profile/Settings shortcut tab
    goals.tsx                    # Goals screen (hidden tab: href: null)
    reports.tsx                  # Reports screen (hidden tab: href: null)
    add-placeholder.tsx          # Placeholder for center FAB tab slot
  auth/                          # login (index), signup, forgot-password, reset-password
  transactions/
    add.tsx                      # Add transaction modal
    [id].tsx                     # Edit transaction modal
  split-expense/[id].tsx         # Split create (id='new') or detail (id=splitId)
  splits/index.tsx               # Split list screen
  accounts/index.tsx             # Bank accounts screen
  settings/index.tsx             # App settings screen
  sms-import.tsx                 # SMS import modal
  notifications.tsx              # Notifications screen
  profile/edit.tsx               # Edit profile screen

src/
  components/
    common/                      # Shared UI components (see component library below)
      index.tsx                  # Card, Button, FAB, EmptyState, CategoryBadge, SearchBar,
                                 # ProgressBar, SectionHeader, StatCard, CustomPopup,
                                 # CustomSwitch, AmountText
      CategoryGrid.tsx           # Responsive category selector grid
      NumericKeypad.tsx          # Custom number entry keypad
      PeriodTabs.tsx             # Month/year period selector
      ScreenHeader.tsx           # Consistent back-button header
    TransactionItem.tsx          # Swipeable transaction row (gesture + animation)
  database/
    index.ts                     # SQLite schema init, table creation, enqueueSync(), migrations
  hooks/
    useTheme.ts                  # resolveThemeColors(), useTheme() hook, ThemeColors type
  lib/
    env.ts                       # Environment variable helpers
    queryClient.ts               # React Query client config
    supabase.ts                  # Supabase client init
  screens/                       # Screen implementations (domain-grouped)
    dashboard/DashboardScreen.tsx
    transactions/
      AddTransactionScreen.tsx
      TransactionsScreen.tsx
    split/
      SplitExpenseScreen.tsx      # Handles both create (isNewSplit) and view modes
      SplitListScreen.tsx
    budgets/BudgetsScreen.tsx
    goals/GoalsScreen.tsx
    reports/
      ReportsScreen.tsx
      NetWorthScreen.tsx
    settings/SettingsScreen.tsx
    auth/AuthScreen.tsx           # login / signup / forgot-password / reset-password modes
    sms/SmsImportScreen.tsx
    accounts/AccountsScreen.tsx
    notifications/NotificationsScreen.tsx
    profile/EditProfileScreen.tsx
  services/
    transactionService.ts        # Transaction CRUD, filtered queries, monthly stats, CSV export
    splitService.ts              # Split expenses CRUD (createSplit, getAll, getById, markSharePaid, deleteSplit)
    syncService.ts               # Push/pull sync with Supabase
    syncTransform.ts             # camelCase ↔ snake_case column maps
    auth.ts                      # Supabase auth + biometric helpers
    sms.ts                       # Android SMS polling & deduplication
    smsReadService.ts            # SMS list + bank message regex parser (SmsMessage interface)
    dataService.ts               # Account, Category, Budget, Goal, Asset, Liability, NetWorth, UserProfile, PaymentMethod services
    dataServices.ts              # Re-exports dataService.ts + aggregate DataService helper
    notifications.ts             # Expo notification scheduling
    exportService.ts             # CSV, PDF, JSON backup export + JSON import
    emailReportService.ts        # Monthly email via Supabase Edge Function + Resend
    widgetDataService.ts         # Data fetchers for Android home screen widgets
    MigrationRunner.ts           # SQLite migration helper
    permissions.ts               # Android permission requests
  store/
    appStore.ts                  # Zustand store (see state fields in ARCHITECTURE.md)
  utils/
    constants.ts                 # SPACING, RADIUS, TYPOGRAPHY, COLORS, formatCurrency,
                                 # formatCompact, generateId, SYNCABLE_TABLES
    types.ts                     # All TypeScript types and interfaces (IoniconsName lives here)
  widgets/
    BudgetHealthWidget.tsx       # Android widget: budget usage bars
    ExpenseSummaryWidget.tsx     # Android widget: monthly income/expense
    QuickAddWidget.tsx           # Android widget: deep-link to add transaction
    refreshWidgets.ts            # Trigger widget re-render
    widgetTaskHandler.ts         # Widget event router

supabase/
  schema.sql                     # Complete idempotent schema (tables, RLS, triggers, seeds)
  functions/send-email/          # Resend email edge function

stitch_designs/                  # Reference UI mockups (PNG) — light + dark per screen
```

## SQLite Tables

`accounts`, `categories`, `transactions`, `budgets`, `goals`, `assets`, `liabilities`, `net_worth_history`, `user_profile`, `recurring_templates`, `split_expenses`, `split_members`, `payment_methods`, `sync_queue`, `sync_state`

## Sync System

- Local writes call `enqueueSync(table, id, 'upsert'|'delete')` → adds to `sync_queue`.
- `syncService` pushes pending queue items → pulls remote changes by `updated_at`.
- Only tables in `SYNCABLE_TABLES` (constants.ts) are synced.
- Soft-delete: `deletedAt` timestamp, not row removal.
- Unreachable Supabase → app works locally; sync retries on reconnect.

## Key Patterns

- **dataRevision**: Zustand counter bumped after writes. Screens subscribe to it to trigger re-fetches.
- **Screen structure**: `SafeAreaView` → header → `ScrollView` → sections, styled via `useMemo(() => createStyles(colors), [colors])`.
- **Route params**: `useLocalSearchParams<{ id: string }>()` for dynamic routes.
- **Modals**: Transaction add/edit and split screens use `presentation: 'modal'` in `_layout.tsx`.
- **Animations**: `Animated.View` with `FadeInDown` from reanimated for staggered section entry.
- **useCallback for async effects**: Any `async` function used inside a `useEffect` dependency array must be wrapped in `useCallback` to satisfy the eslint `exhaustive-deps` rule.

## Navigation Map

| Route                   | Screen                        | Type       |
| ----------------------- | ----------------------------- | ---------- |
| `/`                     | redirect → `/(tabs)/`         | —          |
| `/(tabs)/`              | DashboardScreen               | Tab        |
| `/(tabs)/transactions`  | TransactionsScreen            | Tab        |
| `/(tabs)/budgets`       | BudgetsScreen                 | Tab        |
| `/(tabs)/profile`       | SettingsScreen (profile view) | Tab        |
| `/(tabs)/goals`         | GoalsScreen                   | Hidden tab |
| `/(tabs)/reports`       | ReportsScreen                 | Hidden tab |
| `/transactions/add`     | AddTransactionScreen          | Modal      |
| `/transactions/[id]`    | AddTransactionScreen (edit)   | Modal      |
| `/split-expense/new`    | SplitExpenseScreen (create)   | Modal      |
| `/split-expense/[id]`   | SplitExpenseScreen (detail)   | Modal      |
| `/splits`               | SplitListScreen               | Screen     |
| `/accounts`             | AccountsScreen                | Screen     |
| `/settings`             | SettingsScreen                | Screen     |
| `/sms-import`           | SmsImportScreen               | Modal      |
| `/login`                | AuthScreen (login)            | Screen     |
| `/auth/signup`          | AuthScreen (signup)           | Screen     |
| `/auth/forgot-password` | AuthScreen (forgot)           | Screen     |
| `/auth/reset-password`  | AuthScreen (reset)            | Screen     |
| `/notifications`        | NotificationsScreen           | Screen     |
| `/profile/edit`         | EditProfileScreen             | Screen     |

## Entry Points to Key Screens

**Split Expenses** (3 entry points):

1. Dashboard → Quick Actions → "Split Expense" → `/splits`
2. Settings → DATA & SYNC section → "Split Expenses" → `/splits`
3. Transaction Detail → "Split This Expense" → `/split-expense/new?txId={id}`

**Goals & Reports** (hidden tabs — navigated directly):

- Dashboard → "Goals" card → `/(tabs)/goals`
- Dashboard → "Reports" card → `/(tabs)/reports`
- Settings → various section links

**Notifications**: Navigated from a bell icon button in the dashboard header.

**Net Worth**: Accessible from ReportsScreen → "Net Worth" section link → `NetWorthScreen`.

## Design References

`stitch_designs/` has PNG mockups per screen (light + dark variants). Check corresponding folder when modifying UI.

## Supabase Schema

Run `supabase/schema.sql` in the Supabase SQL editor. Single file — all tables, indexes, triggers, RLS policies, and backfill logic. No separate migration files.

## Caveats & Known State

- Supabase schema not applied → sync returns `PGRST205`. App continues locally — this is expected.
- SMS import only works on native Android builds, not Expo Go or iOS.
- Android widgets only work on native Android builds.
- `NotificationsScreen` has no persistent bell icon in the tab bar — entry is from dashboard header only.
- `NetWorthScreen` is reached from within `ReportsScreen`, not from a direct route shown in tab bar.
- `/(tabs)/goals` and `/(tabs)/reports` are valid navigable routes but excluded from the tab bar (`href: null`).

## Code Quality Status

| Check          | Command             | Status        |
| -------------- | ------------------- | ------------- |
| TypeScript     | `npm run typecheck` | ✅ 0 errors   |
| ESLint         | `npm run lint`      | ✅ 0 warnings |
| `as any` casts | —                   | ✅ 0          |
| `: any` types  | —                   | ✅ 0          |
| Formatting     | `npm run format`    | ✅ Prettier   |
