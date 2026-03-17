# Standard Operating Procedures — Hisab Kitab

> For AI coding agents. Read this entire document before making any changes.

---

## 0. Pre-Flight Checklist (Run Before Every Task)

Before writing a single line of code:

1. **Read `AI_CONTEXT.md`** — source of truth for stack, rules, and structure.
2. **Read `ARCHITECTURE.md`** — sync flow, state, service layer, routing.
3. **Identify the affected layer** — DB schema, service, screen, component, or route.
4. **Identify theme dependencies** — every screen must use `useTheme()`.
5. **Confirm TypeScript will pass** — `tsc --noEmit` must remain at 0 errors.
6. **Confirm ESLint will pass** — `eslint . --max-warnings 0` must remain at 0 warnings.

---

## 1. Non-Negotiable Hard Rules

These rules are absolute. Violating any of them breaks the codebase.

| Rule                                       | What To Do                                                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offline-first**                          | Always write to SQLite first. Call `enqueueSync()` after every write. Never await network before local write.                                                              |
| **No secrets in app**                      | Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. No service keys.                                                                            |
| **No `any` types**                         | Every type must be explicit. Use `IoniconsName` for icons, `ThemeColors` for color objects, `DimensionValue` for percentage widths.                                        |
| **No `Alert.alert`**                       | Use `CustomPopup` for all user-facing alerts. See §1a for known exceptions.                                                                                                |
| **No hardcoded colors**                    | All colors must come from `useTheme()`. Never import `COLORS` directly in screen files.                                                                                    |
| **Auth gating**                            | Unauthenticated → `/login`. Every authenticated user must have a `user_profile` row.                                                                                       |
| **UUIDs only**                             | All entity IDs are `TEXT` using `generateId()` from `src/utils/constants.ts`.                                                                                              |
| **camelCase locally, snake_case remotely** | SQLite columns = camelCase. **Exception:** `split_expenses` and `split_members` already use snake_case column names in SQLite (`transaction_id`, `paid_by_user_id`, etc.). |
| **FlashList v2**                           | Never pass `estimatedItemSize` prop — it was removed in v2.0.                                                                                                              |
| **SMS / Widgets**                          | Both require native Android builds. Never call SMS APIs on iOS.                                                                                                            |

### 1a. Known `Alert.alert` Exceptions (Tech Debt)

The following screens still use `Alert.alert`. When editing them, migrate to `CustomPopup`. Do NOT introduce new `Alert.alert` calls anywhere else.

- `src/screens/goals/GoalsScreen.tsx` — delete goal confirmation
- `src/screens/transactions/TransactionDetailScreen.tsx` — delete transaction confirmation
- `src/screens/reports/ReportsScreen.tsx` — export format picker
- `src/screens/settings/SettingsScreen.tsx` — import backup confirmation

---

## 2. Adding a New Screen

### Step-by-step

1. **Create the route file** in `app/` following expo-router file-based conventions.
   - Tab screen → `app/(tabs)/yourscreen.tsx`
   - Modal → `app/yourmodal.tsx` (register in `app/_layout.tsx` with `presentation: 'modal'`)
   - Nested screen → `app/section/index.tsx`

2. **Create the screen implementation** in `src/screens/domain/YourScreen.tsx`.

3. **Follow the mandatory screen structure:**

```tsx
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/appStore';
import type { ThemeColors } from '@/hooks/useTheme';

export default function YourScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);

  // fetch data on mount + when dataRevision changes

  return (
    <SafeAreaView style={styles.container}>
      {/* ScreenHeader if needed */}
      <ScrollView>{/* sections */}</ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.bgCard, borderColor: colors.border },
    text: { color: colors.textPrimary },
    muted: { color: colors.textMuted },
  });
}
```

4. **Wire the route file** — the standard pattern is a thin re-export:

```tsx
export { default } from '../../src/screens/domain/YourScreen';
```

**Exception:** `app/transactions/[id].tsx` is NOT a thin wrapper. It contains routing logic that conditionally renders `TransactionDetailScreen` (default) or `AddTransactionScreen` (when `?edit=1` query param is present). Do not simplify it.

5. **Update navigation map** in `AI_CONTEXT.md` if adding a new route.

---

## 3. Complete Navigation Map (Including Gaps in AI_CONTEXT.md)

These routes exist in the actual codebase but are missing from `AI_CONTEXT.md`:

| Route                            | Screen                             | Entry Point                                           |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `/faq`                           | `FaqScreen`                        | Settings screen → header help icon                    |
| `/transactions/[id]` (no params) | `TransactionDetailScreen`          | Transaction list tap                                  |
| `/transactions/[id]?edit=1`      | `AddTransactionScreen` (edit mode) | Detail screen edit button or "Split This Expense" row |

All other routes are documented in `AI_CONTEXT.md`.

---

## 4. Adding a New Database Table

1. **Add the table definition** to `src/database/index.ts` inside the schema init SQL.

2. **Decide if it syncs** — if yes, add the table name to `SYNCABLE_TABLES` in `src/utils/constants.ts`.

3. **Add column mappings** in `src/services/syncTransform.ts`. The actual format is:

```ts
// Inside tableLocalToRemote — list only the table-specific mappings.
// Base fields (userId, syncStatus, createdAt, updatedAt, etc.) are already
// handled by baseLocalToRemote and do NOT need to be repeated.
yourTable: {
  someField: 'some_field',
  anotherField: 'another_field',
},
```

The file automatically inverts this for the remote→local direction.

4. **Mirror the table in Supabase** — add it to `supabase/schema.sql` with snake_case columns, RLS policy (`USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`), `set_updated_at` trigger, and indexes.

5. **Create a service** in `src/services/dataService.ts` (or a new file) with typed CRUD functions.

6. **Never hard-delete rows** — set `deletedAt` timestamp (soft delete).

7. **Column naming note** — `split_expenses` and `split_members` use snake_case SQLite column names by design. If creating a new split-related table, follow that convention. All other tables use camelCase in SQLite.

---

## 5. Adding a New Service Function

### Correct imports

```ts
// Correct — these are the actual export names
import { getDatabase, enqueueSync } from '@/database';
import { generateId } from '@/utils/constants';
import { useAppStore } from '@/store/appStore';
import { triggerBackgroundSync } from '@/services/syncService';
```

> `getDatabase()` — **not** `getDb()`. It returns the SQLiteDatabase synchronously (no `await`).

### Full write pattern — `enqueueSync` takes FOUR arguments

`enqueueSync(entity, recordId, operation, payload)` — the `payload` is the full record as a plain object. Older 3-arg calls are wrong and will cause TypeScript errors.

```ts
export async function createItem(data: CreateItemInput): Promise<Item> {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  const item: Item = {
    id,
    name: data.name,
    createdAt: now,
    updatedAt: now,
    userId: null,
    syncStatus: 'pending',
    lastSyncedAt: null,
    deletedAt: null,
  };

  await db.runAsync(
    `INSERT INTO your_table (id, name, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.createdAt,
      item.updatedAt,
      null,
      'pending',
      null,
      null,
    ],
  );

  // 1. Queue sync — always pass full record as 4th arg
  await enqueueSync(
    'your_table',
    id,
    'upsert',
    item as unknown as Record<string, unknown>,
  );

  // 2. Bump revision so subscribed screens re-fetch
  useAppStore.getState().bumpDataRevision();

  // 3. Trigger background sync (fire and forget)
  void triggerBackgroundSync('your_table-created');

  return item;
}
```

### Soft delete pattern

```ts
async function deleteItem(id: string) {
  const deletedAt = new Date().toISOString();
  await getDatabase().runAsync(
    `UPDATE your_table SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
    [deletedAt, deletedAt, id],
  );
  await enqueueSync('your_table', id, 'delete', {
    id,
    deletedAt,
    updatedAt: deletedAt,
  });
  useAppStore.getState().bumpDataRevision();
  void triggerBackgroundSync('your_table-deleted');
}
```

### Boolean fields in payloads

For boolean fields that are stored as integers in SQLite (`isDefault`, `isRecurring`, `isCompleted`, `isCustom`, `notificationsEnabled`, `biometricEnabled`), convert them before passing as payload:

```ts
await enqueueSync('accounts', account.id, 'upsert', {
  ...account,
  isDefault: account.isDefault ? 1 : 0,
} as Record<string, unknown>);
```

### Transaction mutations also refresh widgets

`TransactionService.create/update/delete` also calls `refreshAllWidgets()`. This is done via a lazy import to avoid a circular dependency. Follow the same pattern if your new service mutates transaction-adjacent data:

```ts
const refreshAllWidgets = async () => {
  const { refreshAllWidgets: refresh } =
    await import('@/widgets/refreshWidgets');
  return refresh();
};
// After the write:
void refreshAllWidgets();
```

---

## 6. Modifying Existing UI Components

1. **Check `stitch_designs/`** for the reference mockup of the screen being modified.
2. **Only use `useTheme()` colors** — never hardcode hex values or reference `COLORS` directly.
3. **Use `useMemo` for styles** — `const styles = useMemo(() => createStyles(colors), [colors])`.
4. **Use `CustomPopup`** not `Alert.alert` for user-facing messages (see §1a for legacy exceptions).
5. **Use `ScreenHeader`** for back-navigation headers in non-tab screens.
6. **Use `EmptyState`** for empty list placeholders.
7. **Use `Button`** for all tappable actions (primary/secondary/danger/ghost variants).
8. **Use `AmountText`** for displaying monetary values.

---

## 7. Working with State (Zustand)

The store is in `src/store/appStore.ts`.

**Reading state in a component:**

```tsx
const dataRevision = useAppStore((s) => s.dataRevision);
const accounts = useAppStore((s) => s.accounts);
```

**Triggering re-fetch after a write (outside a component):**

```ts
useAppStore.getState().bumpDataRevision();
```

**Re-fetching in a screen when data changes:**

```tsx
const dataRevision = useAppStore((s) => s.dataRevision);

const fetchData = useCallback(
  async () => {
    // fetch from SQLite and set local state
  },
  [
    /* deps */
  ],
);

useEffect(() => {
  void fetchData();
}, [fetchData, dataRevision]);
```

> **Important:** Any `async` function used inside a `useEffect` dependency array must be wrapped in `useCallback` to satisfy `eslint exhaustive-deps`. Use `void` inside the effect body to suppress the no-floating-promises rule.

---

## 8. Navigation Patterns

**Navigating to a screen:**

```tsx
import { router } from 'expo-router';
import type { Href } from 'expo-router';

router.push('/(tabs)/goals');
router.push('/transactions/add');
router.push(`/transactions/${id}`); // view detail
router.push(`/transactions/${id}?edit=1` as Href); // edit mode
router.push('/splits' as Href); // use `as Href` for untyped routes
router.replace('/login');
```

**Reading route params:**

```tsx
import { useLocalSearchParams } from 'expo-router';
const { id, txId } = useLocalSearchParams<{ id: string; txId?: string }>();
```

**Modal routes** must be registered in `app/_layout.tsx`:

```tsx
<Stack.Screen
  name="your-modal"
  options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
/>
```

---

## 9. TypeScript Rules

- **No `any`** — ever. Not even `as any`.
- **Icons** → use `IoniconsName` type (`src/utils/types.ts`). Use `as IoniconsName` or `as never` for icon string literals.
- **Colors** → use `ThemeColors` (exported from `src/hooks/useTheme.ts`).
- **Percentage widths** → use `DimensionValue` (from `react-native`).
- **`PaymentMethod`** is typed as `string` in `types.ts` — not a union — because SMS import creates transactions with varied payment method strings. Do not change it to a union.
- **New interfaces** → add to `src/utils/types.ts`.
- **Run before committing:** `npm run typecheck` must be 0 errors.

**Import alias:** `tsconfig.json` maps `@/*` → `./src/*`:

| Import                     | Resolves to                       |
| -------------------------- | --------------------------------- |
| `@/database`               | `src/database/index.ts`           |
| `@/hooks/useTheme`         | `src/hooks/useTheme.ts`           |
| `@/store/appStore`         | `src/store/appStore.ts`           |
| `@/utils/types`            | `src/utils/types.ts`              |
| `@/utils/constants`        | `src/utils/constants.ts`          |
| `@/services/syncService`   | `src/services/syncService.ts`     |
| `@/components/common`      | `src/components/common/index.tsx` |
| `@/widgets/refreshWidgets` | `src/widgets/refreshWidgets.ts`   |

Do NOT write `@/src/...` — the `src/` is already included in the alias resolution.

---

## 10. ESLint Rules

- Run `npm run lint` — must output 0 warnings.
- Wrap async functions in `useCallback` when used as `useEffect` deps.
- All `useEffect` dependencies must be exhaustive.
- No unused variables or imports.
- `console.log` is not allowed in production code paths. `console.warn` is acceptable inside `catch` blocks in sync/SMS error handlers only.

---

## 11. Sync System — How to Use It

Every write to a syncable table follows this exact pattern. Steps 2-4 are all required.

```
1. Write to SQLite         →  db.runAsync(INSERT/UPDATE/soft-delete)
2. Queue the sync          →  await enqueueSync(table, recordId, 'upsert'|'delete', payloadObject)
3. Bump the revision       →  useAppStore.getState().bumpDataRevision()
4. Trigger background sync →  void triggerBackgroundSync(reason)
```

The `payload` (4th arg to `enqueueSync`) must be the full record as `Record<string, unknown>`. Convert booleans to 0/1 for SQLite boolean fields.

Tables in `SYNCABLE_TABLES` in `src/utils/constants.ts` participate in sync. Others are local-only.

---

## 12. Theme System

```tsx
import { useTheme } from '@/hooks/useTheme';
import type { ThemeColors } from '@/hooks/useTheme';

const { colors, isDark } = useTheme();
const styles = useMemo(() => createStyles(colors), [colors]);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.bgCard, borderColor: colors.border },
    elevated: { backgroundColor: colors.bgElevated },
    input: { backgroundColor: colors.bgInput },
    textPrimary: { color: colors.textPrimary },
    textMuted: { color: colors.textMuted },
  });
}
```

**Full color key reference:**

| Key             | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `bg`            | Screen background                               |
| `bgCard`        | Card / surface background                       |
| `bgElevated`    | Elevated surface (chips, secondary backgrounds) |
| `bgInput`       | Input field background                          |
| `border`        | Default border                                  |
| `borderLight`   | Lighter border variant                          |
| `textPrimary`   | Primary text                                    |
| `textSecondary` | Secondary / supporting text                     |
| `textMuted`     | Placeholder / muted text                        |
| `textInverse`   | Text on colored backgrounds                     |
| `primary`       | Brand purple (`#8B5CF6` dark / `#7C3AED` light) |
| `income`        | Green for income                                |
| `expense`       | Red/pink for expense                            |
| `transfer`      | Blue for transfers                              |
| `warning`       | Amber for warnings                              |
| `chart`         | Array of 8 chart colors                         |

**Wrong key names that will cause TypeScript errors:**

```tsx
// ❌ These keys do not exist
colors.background; // → use colors.bg
colors.text; // → use colors.textPrimary
colors.card; // → use colors.bgCard
```

---

## 13. Common Components — When to Use Each

| Component         | Use When                                 | Import From                         |
| ----------------- | ---------------------------------------- | ----------------------------------- |
| `Card`            | Any grouped content section              | `@/components/common`               |
| `Button`          | Any tappable action                      | `@/components/common`               |
| `FAB`             | Floating action (add/create)             | `@/components/common`               |
| `EmptyState`      | List has no items                        | `@/components/common`               |
| `CustomPopup`     | All user-facing alerts/feedback          | `@/components/common`               |
| `CustomSwitch`    | Toggle switch                            | `@/components/common`               |
| `SearchBar`       | Text filter input                        | `@/components/common`               |
| `ProgressBar`     | Budget or goal progress                  | `@/components/common`               |
| `SectionHeader`   | Section title with optional action       | `@/components/common`               |
| `StatCard`        | Dashboard metric display                 | `@/components/common`               |
| `AmountText`      | Monetary amount display                  | `@/components/common`               |
| `CategoryBadge`   | Category icon display                    | `@/components/common`               |
| `CategoryGrid`    | Category selection grid                  | `@/components/common/CategoryGrid`  |
| `NumericKeypad`   | Amount entry keypad                      | `@/components/common/NumericKeypad` |
| `PeriodTabs`      | Period switching tabs                    | `@/components/common/PeriodTabs`    |
| `ScreenHeader`    | Back-navigation header (non-tab screens) | `@/components/common/ScreenHeader`  |
| `TransactionItem` | Transaction list row (swipeable)         | `@/components/TransactionItem`      |

---

## 14. Adding Android Widget Data

1. Add a typed data fetcher to `src/services/widgetDataService.ts`.
2. Add the widget component to `src/widgets/`.
3. Add a case to `src/widgets/widgetTaskHandler.ts`.
4. Add it to `src/widgets/refreshWidgets.ts` — both in the `requestWidgetUpdate` calls and the data fetch.
5. Register the widget in `app.json` under `react-native-android-widget.widgets`.
6. Widgets require a native Android build — they do not run in Expo Go.

---

## 15. SMS Import (Android Only)

Two services handle SMS:

| Service                          | Purpose                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/services/smsReadService.ts` | UI-driven scan — used by `SmsImportScreen`, returns `ParsedSms[]` for user review before import |
| `src/services/sms.ts`            | Background polling — `smsImportService` runs silently on a 60-second interval                   |

Key rules:

- `SmsMessage` interface: `{ _id: number, address: string, body: string, date: number }`.
- `ParsedSms` interface: `{ id, sender, body, date, amount, type, merchant, categoryName }`.
- Keywords detected: `debited`, `credited`, `spent`, `received`, `payment`, `txn`, `transaction`.
- Amount regex: `INR 100.00` or `Rs. 100` patterns.
- Deduplicate using `TransactionService.hasImportedSms(messageId)` before creating.
- Imported transactions get `tags: ['sms-import', 'sms:{messageId}']`.
- Always guard with `Platform.OS !== 'android'` before calling any SMS API.

---

## 16. Email Reports

- Trigger via `sendMonthlyReport()` in `src/services/emailReportService.ts`.
- Calls Supabase Edge Function via `supabase.functions.invoke('send-email', { body: {...} })`.
- Requires `RESEND_API_KEY` secret in Supabase dashboard → Edge Functions → Secrets.
- Never put `RESEND_API_KEY` in the app bundle or `.env`.
- Edge function source: `supabase/functions/send-email/index.ts`.

---

## 17. File & Folder Conventions

| What                       | Where                                                        |
| -------------------------- | ------------------------------------------------------------ |
| Route files                | `app/` (thin re-exports, except `app/transactions/[id].tsx`) |
| Screen implementations     | `src/screens/<domain>/`                                      |
| Shared UI components       | `src/components/common/`                                     |
| Domain services            | `src/services/`                                              |
| TypeScript types           | `src/utils/types.ts`                                         |
| Constants & format helpers | `src/utils/constants.ts`                                     |
| Zustand store              | `src/store/appStore.ts`                                      |
| Theme hook                 | `src/hooks/useTheme.ts`                                      |
| SQLite schema + db helpers | `src/database/index.ts`                                      |
| Supabase schema            | `supabase/schema.sql`                                        |
| Sync column mappings       | `src/services/syncTransform.ts`                              |
| Widget components          | `src/widgets/`                                               |
| Widget data service        | `src/services/widgetDataService.ts`                          |

---

## 18. Supabase Schema Changes

All Supabase schema changes go into `supabase/schema.sql` — a **single idempotent file**. No separate migration files.

When modifying:

1. Use `DROP TRIGGER IF EXISTS` / `DROP POLICY IF EXISTS` before `CREATE` to stay idempotent.
2. Use snake_case column names.
3. Add RLS: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.
4. Add `updated_at` column with `timezone('utc', now())` default and a `set_updated_at` trigger.
5. Add `user_id`, `sync_status`, `last_synced_at`, `deleted_at` columns for sync support.
6. Add the corresponding column mappings in `src/services/syncTransform.ts`.
7. Add the table to `SYNCABLE_TABLES` in `src/utils/constants.ts`.

---

## 19. SQLite Migrations

For adding columns to existing SQLite tables without dropping user data, use `src/services/MigrationRunner.ts`:

```ts
const migrations: Migration[] = [
  {
    version: 2, // always increment from the highest existing version
    name: 'add_my_new_column',
    run: async (db) => {
      await db.execAsync(`ALTER TABLE your_table ADD COLUMN newColumn TEXT;`);
    },
  },
];
```

Migrations run on every app start, are tracked in the `_migrations` table, and are skipped if already applied.

---

## 20. Pre-Commit Quality Gate

Before considering any task done:

```bash
npm run typecheck   # Must output: Found 0 errors
npm run lint        # Must output: 0 warnings
npm run format      # Run Prettier (auto-fixes formatting)
```

If either of the first two commands fails, the task is **not complete**.

---

## 21. What NOT to Do

| ❌ Never Do This                         | ✅ Do This Instead                                          |
| ---------------------------------------- | ----------------------------------------------------------- |
| `Alert.alert(...)`                       | `<CustomPopup />` (see §1a for legacy exceptions)           |
| `style={{ color: '#fff' }}`              | `style={{ color: colors.textPrimary }}`                     |
| `colors.background`                      | `colors.bg`                                                 |
| `colors.text`                            | `colors.textPrimary`                                        |
| `colors.card`                            | `colors.bgCard`                                             |
| Pass `estimatedItemSize` to FlashList    | Remove it — v2 doesn't support it                           |
| Use `any` type                           | Use proper typed interface                                  |
| Hard-delete a row                        | Set `deletedAt` timestamp                                   |
| Write to Supabase directly               | Write to SQLite → enqueueSync → sync service pushes         |
| Import `COLORS` in a screen              | Use `useTheme()`                                            |
| Block UI on network call                 | Write locally first, sync in background                     |
| Add `RESEND_API_KEY` to `.env`           | Set it in Supabase dashboard → Edge Functions → Secrets     |
| Create a new type in a component file    | Add to `src/utils/types.ts`                                 |
| Use `async` directly in `useEffect` deps | Wrap in `useCallback`, call with `void` inside effect       |
| Call `enqueueSync` with 3 args           | Always pass the full record as the 4th argument             |
| Use `getDb()`                            | Use `getDatabase()` — that is the actual export name        |
| Import `@/src/hooks/useTheme`            | Import `@/hooks/useTheme` — alias maps to `src/` already    |
| `console.log` in production paths        | `console.warn` inside catch blocks only                     |
| New `Alert.alert` calls                  | Use `CustomPopup` — including for destructive confirmations |
