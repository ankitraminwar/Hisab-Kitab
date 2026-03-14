# Architecture — Hisab Kitab

## Runtime Model

```
Mobile App (Expo/RN)
  → SQLite (local source of truth)
  → Sync Service (background push/pull)
  → Supabase (PostgreSQL + Auth + RLS)
  → Edge Functions (email via Resend)
```

## Data Layer

### Local SQLite

Schema defined in `src/database/index.ts`. Tables:

| Table                 | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `accounts`            | Bank/wallet accounts                     |
| `categories`          | Transaction categories with icons/colors |
| `transactions`        | Income/expense records                   |
| `budgets`             | Monthly category budgets                 |
| `goals`               | Savings goals with progress              |
| `assets`              | Net worth assets                         |
| `liabilities`         | Net worth liabilities                    |
| `net_worth_history`   | Monthly net worth snapshots              |
| `user_profile`        | User settings, theme, notification prefs |
| `recurring_templates` | Recurring transaction definitions        |
| `split_expenses`      | Split expense headers                    |
| `split_members`       | Split expense member shares              |
| `payment_methods`     | Payment method definitions               |
| `sync_queue`          | Pending sync operations                  |
| `sync_state`          | Per-table sync timestamps                |

### Supabase Remote

Mirrors local tables with snake_case columns. Schema in `supabase/schema.sql`.
RLS policies enforce per-user data isolation via `auth.uid()`.

### Column Mapping

`src/services/syncTransform.ts` maps between local camelCase and remote snake_case:

- `transactionId` ↔ `transaction_id`
- `splitExpenseId` ↔ `split_expense_id`
- `paidByUserId` ↔ `paid_by_user_id`
- (and so on for all synced tables)

## Sync Flow

```
Local Write → SQLite → enqueueSync() → sync_queue
                                           ↓
                              syncService.requestSync()
                                           ↓
                              Push pending queue to Supabase
                                           ↓
                              Pull remote changes (by updated_at)
                                           ↓
                              Merge into local SQLite
                                           ↓
                              bumpDataRevision() → UI re-renders
```

- Sync triggers: app start, auth change, network reconnect, manual sync button, after local writes.
- Conflict resolution: latest `updated_at` wins.
- Soft deletes: `deletedAt` timestamp set, row preserved.
- `SYNCABLE_TABLES` in `src/utils/constants.ts` controls which tables sync.

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
3. Session exists + biometrics enabled → lock screen
4. Logout → clears SQLite, resets Zustand, redirects to `/login`

## State Management

Single Zustand store in `src/store/appStore.ts`:

- `theme` — dark/light/system
- `isLocked` / `biometricsEnabled` — auth lock state
- `userProfile` — cached user profile
- `dataRevision` — counter bumped on data changes → triggers screen re-renders
- `notificationPreferences` — notification settings

## Service Layer

| Service              | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `transactionService` | Transaction CRUD, filtered queries                                      |
| `splitService`       | Split expense create/read/update/delete                                 |
| `syncService`        | Background push/pull sync orchestration                                 |
| `syncTransform`      | Column name mapping for sync                                            |
| `dataServices`       | UserProfile, Category, Account, Budget, Goal, Asset, Liability services |
| `auth`               | Sign in/up/out, biometric, session management                           |
| `sms`                | Android SMS polling, bank message parsing, transaction creation         |
| `notifications`      | Scheduled notification management                                       |
| `exportService`      | CSV/JSON data export                                                    |
| `permissions`        | Android permission requests                                             |

## Screen Architecture

Every screen follows this pattern:

```tsx
export default function XScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore(s => s.dataRevision);
  // ... fetch data, subscribe to dataRevision
  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <ScrollView>{/* content */}</ScrollView>
    </SafeAreaView>
  );
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ ... });
}
```

## Routing

File-based routing via expo-router. Route → screen mapping:

- `app/(tabs)/` — Bottom tab screens (Dashboard, Transactions, Budgets, Profile)
- `app/transactions/` — Add/edit transaction modals
- `app/split-expense/[id].tsx` — Split create (`id=new`) or detail view
- `app/splits/index.tsx` — Split expense list
- `app/auth/` — Auth flow screens
- `app/settings/`, `app/accounts/`, `app/sms-import.tsx` — Feature screens

Modal routes use `presentation: 'modal'` with `slide_from_bottom` animation.

## SMS Import (Android Only)

- Uses `react-native-get-sms-android` (native build required)
- Background polling every ~60 seconds
- Parses bank/UPI SMS → creates local transactions
- Deduplicates via SMS-derived tags
- Imported transactions sync to Supabase like any other
