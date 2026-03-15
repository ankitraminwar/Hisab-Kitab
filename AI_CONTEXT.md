# AI Context — Hisab Kitab

> Primary reference for AI coding agents. Read this before modifying any code.

## What This App Is

Offline-first personal finance manager for Android/iOS. Expo + React Native + TypeScript + SQLite + Supabase.

## Tech Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Framework  | Expo ~54.0.0, React Native 0.81.5                   |
| Routing    | expo-router ~6.0.23 (file-based, typed routes)      |
| Local DB   | expo-sqlite ~16.0.10 (source of truth)              |
| Remote DB  | Supabase (PostgreSQL + Auth + Edge Functions)       |
| State      | Zustand (`src/store/appStore.ts`) + React Query     |
| Styling    | StyleSheet with dynamic theme via `useTheme()` hook |
| Animations | react-native-reanimated, expo-linear-gradient       |
| Charts     | @shopify/react-native-skia                          |
| Lists      | @shopify/flash-list                                 |

## Hard Rules

1. **Offline-first**: Write to SQLite first, queue for sync. Never block on network.
2. **No secrets in app code**: Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
3. **Column naming**: Local SQLite = camelCase, Supabase = snake_case. Mapping in `src/services/syncTransform.ts`.
4. **Auth gating**: Unauthenticated users → `/login`. Every authenticated user must have a `user_profile` row.
5. **Theme**: All screens must use `useTheme()` colors, never hardcoded `COLORS`. Styles via `createStyles(colors)` pattern.
6. **Popups**: Use `CustomPopup` component, never `Alert.alert`.
7. **IDs**: All entity IDs are `TEXT` (UUID strings from `generateId()`).
8. **Native features**: SMS import requires native Android build (not Expo Go). iOS cannot read SMS inbox.

## Project Structure

```
app/                          # Expo Router file-based routes
  _layout.tsx                 # Root Stack with auth gating, biometric lock
  (tabs)/                     # Bottom tabs: Dashboard, History, FAB, Budgets, Profile
    _layout.tsx               # Tab config — goals & reports tabs hidden (href: null)
  auth/                       # Login, signup, forgot/reset password
  transactions/               # add.tsx (modal), [id].tsx (edit modal)
  split-expense/[id].tsx      # Split create (id='new') or detail (id=splitId)
  splits/index.tsx            # Split list screen
  accounts/index.tsx          # Bank accounts
  settings/index.tsx          # App settings
  sms-import.tsx              # SMS import (modal)

src/
  components/
    common/                   # Button, Card, FAB, EmptyState, CustomPopup, etc.
    TransactionItem.tsx       # Shared transaction row component
  database/index.ts           # SQLite schema, table creation, enqueueSync()
  hooks/useTheme.ts           # Theme hook → ThemeColors object
  screens/                    # Screen implementations (domain-grouped)
    dashboard/                # DashboardScreen (hero card, quick actions, charts)
    transactions/             # AddTransactionScreen, TransactionsScreen
    split/                    # SplitExpenseScreen (create+detail), SplitListScreen
    budgets/                  # BudgetsScreen
    goals/                    # GoalsScreen
    reports/                  # ReportsScreen, NetWorthScreen
    settings/                 # SettingsScreen
    auth/                     # AuthScreen (login/signup/forgot/reset)
    sms/                      # SmsImportScreen
    accounts/                 # AccountsScreen
    notifications/            # NotificationsScreen
    profile/                  # EditProfileScreen
  services/
    transactionService.ts     # Transaction CRUD
    splitService.ts           # Split expenses CRUD (createSplit, getAll, getById, markSharePaid, deleteSplit)
    syncService.ts            # Push/pull sync with Supabase
    syncTransform.ts          # camelCase ↔ snake_case column maps
    auth.ts                   # Supabase auth + biometric helpers
    sms.ts                    # Android SMS polling & bank message parsing
    dataServices.ts           # UserProfileService, CategoryService, AccountService, etc.
    notifications.ts          # Expo notification scheduling
    exportService.ts          # CSV/JSON data export
  store/appStore.ts           # Zustand: theme, auth, dashboard state, dataRevision
  utils/
    constants.ts              # SPACING, RADIUS, TYPOGRAPHY, COLORS, formatCurrency, generateId, SYNCABLE_TABLES
    types.ts                  # TypeScript interfaces (Transaction, SplitExpense, SplitMember, Budget, etc.)

supabase/
  schema.sql                  # Complete idempotent schema (all tables, indexes, triggers, RLS)
  functions/send-email/       # Resend email edge function

stitch_designs/               # Reference UI mockups (PNG) — light + dark per screen
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

- **dataRevision**: Zustand counter bumped after writes. Screens subscribe to trigger re-fetches.
- **Screen structure**: `SafeAreaView` → header → `ScrollView` → sections, styled via `useMemo(() => createStyles(colors), [colors])`.
- **Route params**: `useLocalSearchParams<{ id: string }>()` for dynamic routes.
- **Modals**: Transaction add/edit and split screens use `presentation: 'modal'` in `_layout.tsx`.
- **Animations**: `Animated.View` with `FadeInDown` from reanimated for staggered section entry.

## Navigation Map

| Route                   | Screen                      | Type       |
| ----------------------- | --------------------------- | ---------- |
| `/`                     | DashboardScreen             | Tab        |
| `/(tabs)/transactions`  | TransactionsScreen          | Tab        |
| `/(tabs)/budgets`       | BudgetsScreen               | Tab        |
| `/(tabs)/profile`       | SettingsScreen              | Tab        |
| `/(tabs)/goals`         | GoalsScreen                 | Hidden tab |
| `/(tabs)/reports`       | ReportsScreen               | Hidden tab |
| `/transactions/add`     | AddTransactionScreen        | Modal      |
| `/transactions/[id]`    | AddTransactionScreen (edit) | Modal      |
| `/split-expense/new`    | SplitExpenseScreen (create) | Modal      |
| `/split-expense/[id]`   | SplitExpenseScreen (detail) | Modal      |
| `/splits`               | SplitListScreen             | Screen     |
| `/accounts`             | AccountsScreen              | Screen     |
| `/settings`             | SettingsScreen              | Screen     |
| `/sms-import`           | SmsImportScreen             | Modal      |
| `/login`                | AuthScreen                  | Screen     |
| `/auth/signup`          | AuthScreen                  | Screen     |
| `/auth/forgot-password` | AuthScreen                  | Screen     |
| `/auth/reset-password`  | AuthScreen                  | Screen     |
| `/notifications`        | NotificationsScreen         | Screen     |
| `/profile/edit`         | EditProfileScreen           | Screen     |

## Entry Points to Split Expenses

Split feature is reachable from 3 places:

1. **Dashboard** → Quick Actions row → "Split Expense" card → `/splits`
2. **Settings** → DATA & SYNC section → "Split Expenses" → `/splits`
3. **Transaction Detail** → "Split This Expense" button → `/split-expense/new?txId={transactionId}`

## Design References

`stitch_designs/` has PNG mockups per screen (light + dark variants). Check corresponding folder when modifying UI.

## Supabase Schema

Run `supabase/schema.sql` in the Supabase SQL editor. This single file contains all tables,
indexes, triggers, RLS policies, and backfill logic. No separate migration files needed.

## Caveats

- If Supabase schema isn't applied, sync returns `PGRST205`. App continues locally.
- SMS import only works on native Android builds, not Expo Go or iOS.
- `NetWorthScreen` exists but has no route — not yet linked.
- `NotificationsScreen` route exists but has no discoverable entry point from UI.
