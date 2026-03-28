# HISAB KITAB — COMPREHENSIVE CODEBASE AUDIT REPORT

**Date:** 2025-07-18  
**Branch under review:** `audit-and-performace-testing` (commit `a9a9893`, 1 ahead of `master`)  
**Auditors:** Senior Architect, Security Engineer, Performance Engineer, QA Architect, Product/UX Reviewer  
**Stack:** Expo ~54, React Native 0.81.5, TypeScript strict, expo-sqlite (SQLite), Supabase, Zustand, React Query v5, FlashList v2, Reanimated ~4.1.1

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Critical Findings (P0 — Fix Before Release)](#2-critical-findings-p0)
3. [High Priority (P1)](#3-high-priority-p1)
4. [Medium Priority (P2)](#4-medium-priority-p2)
5. [Low Priority (P3)](#5-low-priority-p3)
6. [Security Audit](#6-security-audit)
7. [Architecture Review](#7-architecture-review)
8. [Database & Schema Parity Report](#8-database--schema-parity-report)
9. [Performance Audit](#9-performance-audit)
10. [Design System & Animation Review](#10-design-system--animation-review)
11. [Workflow & Business Logic Review](#11-workflow--business-logic-review)
12. [Code Quality & Conventions](#12-code-quality--conventions)
13. [Supabase & Backend Review](#13-supabase--backend-review)
14. [Testing Strategy](#14-testing-strategy)
15. [Branch Changes Review](#15-branch-changes-review)
16. [What's Working Well](#16-whats-working-well)
17. [Action Plan](#17-action-plan)

---

## 1. EXECUTIVE SUMMARY

Hisab Kitab is a well-structured offline-first personal finance app for the Indian market. The architecture demonstrates strong engineering decisions: SQLite as source of truth with cloud sync to Supabase, proper RLS on all 15 tables, a clean Zustand store with 3 slices, and a disciplined column-mapping transform layer.

However, the audit reveals **4 critical**, **9 high-priority**, **12 medium**, and **8 low-priority** findings that must be addressed before a fintech-grade production release. The most severe issues are: floating-point money representation, `SECURITY DEFINER` functions without row-level guards, missing crash reporting, and schema parity gaps between SQLite ↔ Supabase.

**Overall Health Score: 6.5/10** — Solid foundation, critical gaps in security and data integrity.

---

## 2. CRITICAL FINDINGS (P0 — Fix Before Release)

### C1. Floating-Point Money Representation

**Severity:** 🔴 CRITICAL  
**Location:** All tables (SQLite `REAL`, Supabase `double precision`)  
**Impact:** Financial calculation errors due to IEEE 754 floating-point. `0.1 + 0.2 ≠ 0.3`.

For a fintech app dealing with INR, amounts like ₹999.99 can silently lose paisa across operations, splits, and budget aggregations. This is the #1 data integrity risk.

**Current state:**

- SQLite: `amount REAL NOT NULL` across transactions, budgets, goals, assets, liabilities, splits
- Supabase: `double precision` across all amount columns

**Fix:** Store amounts as **integer paisa** (₹100.50 → 10050). This eliminates all floating-point drift.

```sql
-- Supabase migration
ALTER TABLE transactions ALTER COLUMN amount TYPE bigint USING (amount * 100)::bigint;
ALTER TABLE budgets ALTER COLUMN limit_amount TYPE bigint USING (limit_amount * 100)::bigint;
-- ... repeat for all money columns across all tables
```

```typescript
// SQLite: Change REAL → INTEGER in all CREATE TABLE statements
// Display layer: formatCurrency(amountPaisa / 100)
```

**Affected tables:** transactions (amount), budgets (limit_amount, spent), goals (target_amount, current_amount), assets (value), liabilities (amount), split_expenses (total_amount), split_members (share_amount), net_worth_history (total_assets, total_liabilities, net_worth), accounts (balance), user_profile (monthly_budget)

---

### C2. `SECURITY DEFINER` Functions Bypass RLS

**Severity:** 🔴 CRITICAL  
**Location:** `supabase/schema.sql` lines ~505-545

Three functions use `SECURITY DEFINER` which executes as the **function owner** (superuser), bypassing ALL RLS policies:

1. **`get_dashboard_stats()`** — Returns dashboard data. Currently filters by `auth.uid()` inside the query, BUT if the SQL is ever modified to remove that filter, ALL users' data would be exposed.
2. **`refresh_dashboard_stats()`** — Refreshes materialized view. Safe in isolation but grants privilege escalation vector.
3. **`trigger_refresh_dashboard_stats()`** — Fires on EVERY transaction INSERT/UPDATE/DELETE. Runs as superuser.

**Fix:**

```sql
-- Change get_dashboard_stats to SECURITY INVOKER (safe — RLS will apply)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_month text DEFAULT to_char(now(), 'YYYY-MM'))
RETURNS TABLE(...)
LANGUAGE sql STABLE
SECURITY INVOKER   -- ← Changed from DEFINER
SET search_path = public
AS $$ ... $$;

-- refresh_dashboard_stats MUST stay DEFINER (REFRESH MATERIALIZED VIEW requires owner)
-- BUT restrict execute grants:
REVOKE EXECUTE ON FUNCTION public.refresh_dashboard_stats() FROM public;
-- Only allow through trigger, not direct client call
```

---

### C3. No Crash Reporting / Error Monitoring

**Severity:** 🔴 CRITICAL  
**Location:** Entire application  
**Impact:** Silent failures in production with no visibility. Sync failures, DB corruption, auth errors — all invisible.

No Sentry, Bugsnag, or equivalent is configured. `console.log`/`console.error` statements exist (8+ instances) but these are invisible in production.

**Fix:** Install and configure Sentry:

```bash
npx expo install @sentry/react-native
```

Configure in `app/_layout.tsx` root, wrap with Sentry error boundary, instrument sync engine and DB operations.

---

### C4. Transaction Atomicity Gap — enqueueSync Outside Transaction

**Severity:** 🔴 CRITICAL  
**Location:** `src/services/transactionService.ts` — `create()` method

The branch correctly wraps INSERT + balance effect in `BEGIN IMMEDIATE TRANSACTION` / `COMMIT`, but `enqueueSync()` is called **after** the COMMIT. If the app crashes between COMMIT and `enqueueSync()`, the transaction exists locally but will **never sync** to Supabase.

```typescript
// Current code (branch):
await db.execAsync('COMMIT');
// ← App crash here = data loss for sync
await enqueueSync('transactions', transaction.id, 'upsert', { ... });
```

**Fix:** Move `enqueueSync` inside the transaction boundary:

```typescript
try {
  await db.runAsync(`INSERT INTO transactions ...`, [...]);
  await applyBalanceEffect(...);
  await enqueueSync('transactions', transaction.id, 'upsert', { ... });
  await db.execAsync('COMMIT');
} catch (error) {
  await db.execAsync('ROLLBACK');
  throw error;
}
```

---

## 3. HIGH PRIORITY (P1)

### H1. Notes Table — UUID Type Mismatch

**Severity:** 🟠 HIGH  
**Location:** SQLite `notes.id = TEXT` vs Supabase `notes.id = uuid` with `uuid_generate_v4()` default

SQLite generates IDs via `generateId()` (UUID v4 string). Supabase has `id uuid DEFAULT extensions.uuid_generate_v4()`. While UUID strings are compatible with the `uuid` type, the **default value generation** differs. On initial sync or conflict resolution, Supabase may auto-generate a UUID that doesn't match the local one, causing orphaned records.

**Fix:** Change Supabase `notes.id` to `text` (matching all other tables), or remove the server-side default and always supply the ID from the client.

---

### H2. `user_profile.avatar` Missing from syncTransform

**Severity:** 🟠 HIGH  
**Location:** `src/services/syncTransform.ts` — `tableLocalToRemote.user_profile` mapping

The `avatar` column exists in Supabase (confirmed via live schema) and in SQLite (added by MigrationRunner v2), but the syncTransform mapping for `user_profile` does NOT include `avatar`:

```typescript
user_profile: {
  monthlyBudget: 'monthly_budget',
  themePreference: 'theme_preference',
  notificationsEnabled: 'notifications_enabled',
  biometricEnabled: 'biometric_enabled',
  // ← MISSING: avatar: 'avatar'  (same name, but if omitted, it won't sync)
},
```

Since both local and remote use the same column name `avatar`, it would pass through as-is **only if** the transform layer passes through unmapped keys. Need to verify `mapLocalToRemoteRecord` behavior for unmapped keys.

**Fix:** Add `avatar: 'avatar'` to the mapping to be explicit, or verify pass-through behavior.

---

### H3. Split Column Name Mismatch — SQLite vs Supabase

**Severity:** 🟠 HIGH  
**Location:** `src/database/index.ts` (branch) vs Supabase live schema

The branch renames split columns to camelCase in SQLite:

- `split_expenses`: `transaction_id` → `transactionId`, `paid_by_user_id` → `paidByUserId`, etc.
- `split_members`: `split_expense_id` → `splitExpenseId`, `share_amount` → `shareAmount`, etc.

But Supabase still has snake_case: `transaction_id`, `paid_by_user_id`, `total_amount`, etc.

The `syncTransform` correctly maps these. **However**, MigrationRunner v4 (which handles this renaming for existing data) must execute **before** any sync. If a user has existing split data in the old column names and the migration fails, sync will silently drop data.

**Fix:** Verify MigrationRunner v4 handles:

1. Column renaming via `ALTER TABLE ... RENAME COLUMN`
2. Existing data preservation
3. Index recreation with new column names

---

### H4. Materialized View Refresh on EVERY Transaction

**Severity:** 🟠 HIGH  
**Location:** `supabase/schema.sql` — `trigger_refresh_dashboard_stats` trigger

```sql
CREATE TRIGGER refresh_dashboard_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_refresh_dashboard_stats();
```

`REFRESH MATERIALIZED VIEW CONCURRENTLY` is **expensive** — it takes a full table lock briefly and rewrites the entire view. This fires on EVERY transaction batch. During sync push (which may push 50+ transactions), this trigger fires once per statement, causing N refreshes.

**Fix:** Remove the trigger. Refresh the view on a schedule (pg_cron every 5 min) or call `refresh_dashboard_stats()` explicitly from the client after bulk operations:

```sql
DROP TRIGGER refresh_dashboard_stats_trigger ON public.transactions;
-- Use pg_cron instead:
SELECT cron.schedule('refresh-dashboard', '*/5 * * * *', 'SELECT refresh_dashboard_stats()');
```

---

### H5. No Input Validation on Financial Amounts

**Severity:** 🟠 HIGH  
**Location:** `src/services/transactionService.ts`, all service `create()` methods

No validation for:

- Negative amounts (except transfers)
- `NaN` or `Infinity` values
- Extremely large numbers (overflow)
- Zero-amount transactions

```typescript
// Current: amount goes directly from UI to INSERT
const transaction = { ...data, amount: data.amount }; // Could be NaN, Infinity, -1
```

**Fix:** Add validation at service boundary:

```typescript
const validateAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive finite number');
  }
  if (amount > 999_999_999) {
    throw new Error('Amount exceeds maximum allowed value');
  }
};
```

---

### H6. Missing Error Boundaries in All Screens

**Severity:** 🟠 HIGH  
**Location:** All screen files (0/9+ screens have error boundaries)

A single unhandled JS error in any screen crashes the entire app. No ErrorBoundary component exists anywhere in the codebase.

**Fix:** Create a reusable ErrorBoundary and wrap screen navigators:

```tsx
// src/components/common/ErrorBoundary.tsx
class ErrorBoundary extends React.Component { ... }
// In app/_layout.tsx: wrap <Stack> with <ErrorBoundary>
```

---

### H7. `anon` Role Has SELECT on All Tables

**Severity:** 🟠 HIGH  
**Location:** `supabase/schema.sql` — grants section

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
```

The `anon` role (unauthenticated API requests with the public `anon` key) can SELECT from all tables. While RLS should block access (all policies require `auth.uid() = user_id`), the `categories` policy allows `user_id IS NULL`:

```sql
CREATE POLICY "own_categories" ON public.categories FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
```

This means **any anonymous user** can read all shared default categories, and potentially write new `user_id = NULL` categories.

**Fix:**

```sql
-- Remove anon access entirely (this is a private app, not a public API)
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- Tighten categories policy: separate read from write
DROP POLICY "own_categories" ON public.categories;
CREATE POLICY "categories_read" ON public.categories FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "categories_write" ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update" ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "categories_delete" ON public.categories FOR DELETE
  USING (auth.uid() = user_id);
```

---

### H8. `clearLocalData` Missing `split_friends` (Fixed in Branch)

**Severity:** 🟠 HIGH (Fixed in branch — verify)  
**Location:** `src/database/index.ts` — `localTablesToClear` array

The branch correctly adds `split_friends` to the clear list. On `master`, clearing local data would leave orphan `split_friends` rows, causing FK issues on re-sync.

**Status:** ✅ Fixed in branch commit `a9a9893`.

---

### H9. No Rate Limiting on Auth Endpoints

**Severity:** 🟠 HIGH  
**Location:** `src/services/auth.ts`

`signIn`, `signUp`, `signInWithOtp`, `requestPasswordReset` — none have client-side rate limiting. A compromised device or automated script could brute-force PINs or spam OTP requests.

Supabase has server-side rate limiting, but the client should also implement:

- Exponential backoff after failed attempts
- Lockout after N failed PIN attempts
- Cooldown between OTP requests

---

## 4. MEDIUM PRIORITY (P2)

### M1. Hardcoded Hex Colors Outside Theme System

**Location:** Multiple screen files (15+ instances)

| File                   | Lines        | Colors                                           |
| ---------------------- | ------------ | ------------------------------------------------ |
| DashboardScreen.tsx    | 282, 442-445 | `#6D28D9`, `#4C1D95`, `#34D399`, `#FB7185`, etc. |
| GoalsScreen.tsx        | 19           | `GOAL_COLORS` array with 7 hardcoded colors      |
| NotesScreen.tsx        | 29-36        | `NOTE_COLORS` array with 8 hardcoded colors      |
| AccountsScreen.tsx     | 29-46        | `ACCOUNT_TYPES` and `ACCOUNT_COLORS`             |
| constants.ts (SHADOWS) | ~95          | `shadowColor: '#8B5CF6'`                         |

**Violation:** `.github/instructions/components.instructions.md` rule: "Never hardcode hex colors."

**Fix:** Move all accent/entity color arrays into the theme constants and reference via `useTheme()`.

---

### M2. `Alert.alert` Usage (Violates Instruction Rules)

**Location:**

- `src/screens/goals/GoalsScreen.tsx` line 93
- `src/screens/notes/NotesScreen.tsx` line 57

**Violation:** `.github/instructions/components.instructions.md` rule: "Never use Alert.alert. Use custom popup or modal from common components."

**Fix:** Replace with `showCustomPopup()` or `CustomModal` as used in other screens.

---

### M3. `console.log` / `console.error` in Production Paths

**Location:** 8+ instances across services

| File                | Type            | Purpose                    |
| ------------------- | --------------- | -------------------------- |
| syncService.ts      | `console.debug` | Tags parse failure logging |
| NotesScreen.tsx:151 | `console.error` | Delete error               |
| Various services    | `console.warn`  | Non-critical warnings      |

**Fix:** Replace with structured logging service that:

- No-ops in production (or routes to Sentry breadcrumbs)
- Provides context (table, operation, recordId)

---

### M4. `dataServices.ts` — Unnecessary Re-export Wrapper

**Location:** `src/services/dataServices.ts`

The entire file is `export * from './dataService'`. This creates import confusion and an unnecessary module.

**Fix:** Delete `dataServices.ts`. Update all imports to use `dataService` directly.

---

### M5. Missing `expo-updates` for OTA Updates

**Location:** `package.json`

No OTA update mechanism exists. Critical bugfixes require full app store review cycle.

**Fix:** Add `expo-updates` for emergency patches:

```bash
npx expo install expo-updates
```

---

### M6. Missing Accessibility Labels Across All Screens

**Location:** All 9+ screen files — 0 have `accessibilityLabel` or `accessibilityRole` on interactive elements

This violates WCAG compliance and makes the app unusable for screen reader users.

**Fix:** Systematic pass to add `accessibilityLabel` to all Touchable/Pressable/Button components and `accessibilityRole` to semantic elements.

---

### M7. TransactionsScreen Uses ScrollView Instead of FlashList

**Location:** `src/screens/transactions/TransactionsScreen.tsx` lines 276-290

Large transaction lists rendered via `ScrollView` + `.map()` — no virtualization. For users with 100+ transactions, this causes:

- High memory usage (all items rendered at once)
- Slow initial render
- Janky scrolling

**Fix:** Replace with FlashList (already a dependency):

```tsx
<FlashList data={transactions} renderItem={renderTransaction} keyExtractor={(item) => item.id} />
```

Note: FlashList v2 removed `estimatedItemSize` — no need to add it.

---

### M8. PIN Storage — No Hashing

**Location:** `src/services/auth.ts` — `setPin()` / `getPin()`

PIN is stored in plaintext in SecureStore:

```typescript
await SecureStore.setItemAsync(PIN_KEY, pin, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

While SecureStore uses Keychain/Keystore (hardware-backed), a compromised device could extract the raw PIN. Best practice is to store a hash.

**Fix:** Hash before storage:

```typescript
import * as Crypto from 'expo-crypto';
const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + SALT);
await SecureStore.setItemAsync(PIN_KEY, hash, { ... });
```

---

### M9. `react-native-worklets` Still in Dependencies

**Location:** `package.json`

`react-native-worklets-core: 0.5.1` is listed but appears unused. Dead dependencies increase bundle size and attack surface.

**Fix:** Verify no imports reference it, then remove:

```bash
npm uninstall react-native-worklets-core
```

---

### M10. Missing `initializeDatabase` Error Handling in Bootstrap

**Location:** `app/_layout.tsx` — bootstrap sequence

If `initializeDatabase()` fails (disk full, schema error), the app continues with a broken database. No user-facing error, no retry.

**Fix:** Catch and display a fatal error screen:

```typescript
try {
  await initializeDatabase();
} catch (e) {
  Sentry.captureException(e);
  setFatalError('Database initialization failed. Please restart the app.');
  return;
}
```

---

### M11. Deep Link Path Whitelist — Regex Injection Risk

**Location:** `app/_layout.tsx` — deep link handling

Currently uses an `ALLOWED_DEEP_LINK_PATHS` array with string matching. Verify that paths are compared via exact match (not regex) to prevent path traversal:

```typescript
if (!ALLOWED_DEEP_LINK_PATHS.includes(path)) return; // Good — exact match
```

---

### M12. No Offline Queue Size Limit

**Location:** `src/database/index.ts` — sync_queue table

If a user stays offline for weeks, sync_queue grows unbounded. Large queues cause:

- Slow sync start (listing all pending items)
- Memory pressure (loading all payloads)
- Potential sync timeout (60s watchdog)

**Fix:** Add a configurable limit (e.g., 10,000 items) and show a warning when approaching it.

---

## 5. LOW PRIORITY (P3)

### L1. `as never` Type Casts for Icon Names

**Location:** 6+ screen files (GoalsScreen, NotesScreen, AccountsScreen, TransactionItem, tabs \_layout)

Used to satisfy Ionicons type checking. Acceptable pattern but consider creating a typed icon wrapper.

---

### L2. Missing `useMemo` for Derived Data

**Location:**

- GoalsScreen.tsx lines 39-46 (filter + sort recreated every render)
- NotesScreen.tsx lines 80-125 (`renderNoteCard` recreated every render)

Minor perf impact — only matters with large lists.

---

### L3. Legacy `COLORS` Export

**Location:** `src/utils/constants.ts` line ~48

```typescript
export const COLORS = LIGHT_COLORS;
```

Documented as "Legacy export for files not yet refactored to useTheme hook." Should be removed once migration is complete.

---

### L4. `SHADOWS` Use Hardcoded Color

**Location:** `src/utils/constants.ts` lines ~95+

```typescript
shadowColor: '#8B5CF6',
```

Should reference theme primary color.

---

### L5. SMS Polling Interval Hardcoded

**Location:** `src/services/sms.ts` — 60-second polling interval

Should be configurable via constants or user profile setting.

---

### L6. Email Report — Resend API Key in Edge Function Env

**Location:** `supabase/functions/send-email/index.ts`

Uses `Deno.env.get('RESEND_API_KEY')`. Ensure it's set only in Supabase secrets, not committed anywhere.

---

### L7. No Pagination for Dashboard Stats RPC

**Location:** `supabase/schema.sql` — `get_dashboard_stats()` function

Returns single month only. For historical views, consider adding date range parameters.

---

### L8. Missing `FOREIGN KEY` Constraints in Supabase

**Location:** Supabase live schema

Transactions, budgets, goals — no FK to categories/accounts in Supabase (intentionally removed per project instructions). This is documented and acceptable, but means data integrity relies entirely on the client.

---

## 6. SECURITY AUDIT

### 6.1 Authentication & Authorization

| Check                | Status     | Notes                                            |
| -------------------- | ---------- | ------------------------------------------------ |
| RLS on all tables    | ✅ PASS    | All 15 tables have RLS enabled                   |
| RLS policies correct | ⚠️ PARTIAL | Categories allows `user_id IS NULL` — see H7     |
| Session management   | ✅ PASS    | Supabase handles JWT refresh                     |
| PIN security         | ⚠️ WARN    | Plaintext in SecureStore — see M8                |
| Biometric fallback   | ✅ PASS    | Proper fallback to PIN                           |
| Deep link whitelist  | ✅ PASS    | `ALLOWED_DEEP_LINK_PATHS` array with exact match |
| Auth rate limiting   | ❌ FAIL    | No client-side rate limiting — see H9            |

### 6.2 Data Security

| Check                      | Status  | Notes                                          |
| -------------------------- | ------- | ---------------------------------------------- |
| SQL injection (SQLite)     | ✅ PASS | Parameterized queries throughout               |
| SQL injection (Supabase)   | ✅ PASS | supabase-js client handles parameterization    |
| XSS                        | ✅ PASS | React Native auto-escapes Text content         |
| Sensitive data in logs     | ⚠️ WARN | 8+ console.log/error in services               |
| API keys in code           | ✅ PASS | Supabase keys loaded from env (expo-constants) |
| SSRF                       | N/A     | No server-side URL fetching from user input    |
| `search_path` on functions | ✅ PASS | All functions use `SET search_path = public`   |

### 6.3 Supabase Security Functions

| Function                            | Mode             | Risk     | Recommendation                                                                      |
| ----------------------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `set_updated_at()`                  | SECURITY DEFINER | LOW      | Trigger-only, no user input. Acceptable.                                            |
| `handle_new_user()`                 | SECURITY DEFINER | MEDIUM   | Creates profile on signup. Uses `NEW.id` directly. Review for privilege escalation. |
| `get_dashboard_stats()`             | SECURITY DEFINER | **HIGH** | Bypasses RLS. Has `auth.uid()` filter but fragile. **Change to INVOKER.**           |
| `refresh_dashboard_stats()`         | SECURITY DEFINER | MEDIUM   | Required for REFRESH MATERIALIZED VIEW. Restrict direct execute grant.              |
| `trigger_refresh_dashboard_stats()` | SECURITY DEFINER | MEDIUM   | Fires as superuser on every tx. Ensure no injection via `EXECUTE`.                  |

---

## 7. ARCHITECTURE REVIEW

### 7.1 Overall Architecture Assessment

```
┌─────────────────────────────────────────────┐
│                 React Screens                │
│   (Expo Router · FlashList · Reanimated)     │
├─────────────────────────────────────────────┤
│              Zustand Store                   │
│   AuthSlice │ UISlice │ DataSlice            │
│   bumpDataRevision() (100ms debounce)        │
├─────────────────────────────────────────────┤
│            Service Layer                     │
│   transactionService · splitService · etc.   │
├─────────────────────────────────────────────┤
│        Database Layer (expo-sqlite)          │
│   getDatabase() sync · enqueueSync()         │
│   WAL mode · FK enforcement                  │
├─────────────────────────────────────────────┤
│           Sync Engine                        │
│   push → queue · pull → upsert               │
│   Conflict: server-wins + rebaseLocalId      │
│   Tiered parallel pull · FK-ordered push     │
├─────────────────────────────────────────────┤
│              Supabase                        │
│   15 tables · RLS · Edge Functions           │
└─────────────────────────────────────────────┘
```

**Strengths:**

- Clean separation: UI → Store → Service → DB → Sync
- `getDatabase()` is synchronous (per instructions), eliminating async races
- `enqueueSync()` 4-arg signature enforced consistently
- `syncTransform.ts` provides explicit bidirectional column mapping
- Tiered parallel pulling (3 tiers based on FK dependencies)
- FK-ordered pushing (`TABLE_PUSH_ORDER`) prevents constraint violations

**Concerns:**

- No dependency injection — services import `getDatabase()` directly (testability issue)
- Single-file sync engine (~700 lines) — could benefit from decomposition
- `dataRevision` counter with 100ms debounce is an indirect change notification — React Query's `invalidateQueries` would be more idiomatic

### 7.2 Data Flow Correctness

```
CREATE transaction:
  UI → TransactionService.create()
    → BEGIN IMMEDIATE TRANSACTION
    → INSERT INTO transactions
    → applyBalanceEffect() (account balance ±)
    → COMMIT
    → enqueueSync('transactions', id, 'upsert', payload)  ← OUTSIDE TRANSACTION (C4)
    → bumpDataRevision()
    → refreshWidgets()
```

The `enqueueSync` outside transaction boundary is the C4 critical finding.

---

## 8. DATABASE & SCHEMA PARITY REPORT

### 8.1 SQLite ↔ Supabase Column Mapping

| Table             | SQLite Column         | Supabase Column                | Transform                           | Status                |
| ----------------- | --------------------- | ------------------------------ | ----------------------------------- | --------------------- |
| transactions      | `date TEXT`           | `transaction_date timestamptz` | `date → transaction_date`           | ✅                    |
| transactions      | `tags TEXT '[]'`      | `tags jsonb '[]'`              | JSON.stringify on push              | ✅                    |
| budgets           | `limitAmount REAL`    | `limit_amount float8`          | `limitAmount → limit_amount`        | ✅ (Fixed in branch)  |
| budgets           | `spent REAL`          | `spent float8`                 | pass-through                        | ✅                    |
| notes             | `id TEXT`             | `id uuid`                      | pass-through                        | ⚠️ Type mismatch (H1) |
| user_profile      | `avatar TEXT`         | `avatar text`                  | **NOT MAPPED**                      | ⚠️ (H2)               |
| split_expenses    | `transactionId TEXT`  | `transaction_id text`          | `transactionId → transaction_id`    | ✅                    |
| split_members     | `splitExpenseId TEXT` | `split_expense_id text`        | `splitExpenseId → split_expense_id` | ✅                    |
| net_worth_history | `date TEXT`           | `transaction_date timestamptz` | `date → transaction_date`           | ✅                    |

### 8.2 Tables Present

| Table               | SQLite | Supabase | Sync Enabled | Notes                          |
| ------------------- | ------ | -------- | ------------ | ------------------------------ |
| accounts            | ✅     | ✅       | ✅           |                                |
| categories          | ✅     | ✅       | ✅           | Shared defaults (user_id=NULL) |
| transactions        | ✅     | ✅       | ✅           |                                |
| budgets             | ✅     | ✅       | ✅           |                                |
| goals               | ✅     | ✅       | ✅           |                                |
| assets              | ✅     | ✅       | ✅           |                                |
| liabilities         | ✅     | ✅       | ✅           |                                |
| net_worth_history   | ✅     | ✅       | ✅           |                                |
| user_profile        | ✅     | ✅       | ✅           |                                |
| split_expenses      | ✅     | ✅       | ✅           |                                |
| split_members       | ✅     | ✅       | ✅           |                                |
| split_friends       | ✅     | ✅       | ✅           |                                |
| payment_methods     | ✅     | ✅       | ✅           |                                |
| notes               | ✅     | ✅       | ✅           |                                |
| recurring_templates | ✅     | ✅       | ✅           | New in branch                  |
| sync_queue          | ✅     | ❌       | N/A          | Local-only                     |
| sync_state          | ✅     | ❌       | N/A          | Local-only                     |

### 8.3 Sync Transform Boolean Conversion List

Columns requiring `Boolean()` conversion (SQLite INTEGER ↔ Supabase boolean):

| Column                                 | In Boolean List? | Status               |
| -------------------------------------- | ---------------- | -------------------- |
| isDefault (accounts)                   | ✅               | OK                   |
| isCustom (categories, payment_methods) | ✅               | OK                   |
| isRecurring (transactions)             | ✅               | OK                   |
| isCompleted (goals)                    | ✅               | OK                   |
| isActive (recurring_templates)         | ✅               | OK (Added in branch) |
| isPinned (notes)                       | ✅               | OK                   |
| notificationsEnabled (user_profile)    | ✅               | OK                   |
| biometricEnabled (user_profile)        | ✅               | OK                   |

### 8.4 Live Schema vs schema.sql Drift

Compared live Supabase schema (via MCP `list_tables`) against `supabase/schema.sql`:

| Check                              | Status                                        |
| ---------------------------------- | --------------------------------------------- |
| Table count match                  | ✅ 15 tables in both                          |
| Column count per table             | ✅ Match                                      |
| RLS enabled on all                 | ✅ All 15 enabled                             |
| `recurring_templates` present live | ✅ Present (migration applied)                |
| `notes` sync columns present live  | ✅ `sync_status` and `last_synced_at` present |
| FK constraints match               | ✅ All `user_id → auth.users.id` present      |

**No schema drift detected.** Live schema matches `schema.sql` + applied migrations.

---

## 9. PERFORMANCE AUDIT

### 9.1 Database Performance

| Check                        | Status | Notes                                                         |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| WAL mode                     | ✅     | `PRAGMA journal_mode = WAL`                                   |
| FK enforcement               | ✅     | `PRAGMA foreign_keys = ON`                                    |
| Synchronous mode             | ✅     | `PRAGMA synchronous = NORMAL` (good balance)                  |
| Index coverage               | ✅     | 25+ indexes covering common queries                           |
| Query parameterization       | ✅     | All queries use bind parameters                               |
| `BEGIN IMMEDIATE` for writes | ✅     | Branch uses explicit txn for creates                          |
| Unique constraint index      | ✅     | `idx_budgets_unique_cat_month` with `WHERE deletedAt IS NULL` |

**Missing indexes:**

- `transactions.merchant` — no index for merchant search/grouping
- `transactions.paymentMethod` — filtered in queries but not indexed

### 9.2 React Native Performance

| Check                     | Status     | Notes                                        |
| ------------------------- | ---------- | -------------------------------------------- |
| FlashList usage           | ⚠️ PARTIAL | TransactionsScreen uses ScrollView (M7)      |
| `memo()` on list items    | ✅         | TransactionItem wrapped with `memo`          |
| `useCallback` on handlers | ✅         | Most screens use useCallback properly        |
| Image optimization        | N/A        | No heavy image usage                         |
| Reanimated worklets       | ✅         | Used for gestures (TransactionItem swipe)    |
| `dataRevision` debounce   | ✅         | 100ms debounce prevents rapid re-renders     |
| Bundle size               | ⚠️         | `react-native-worklets-core` unused dep (M9) |

### 9.3 Sync Engine Performance

| Check                     | Status | Notes                                             |
| ------------------------- | ------ | ------------------------------------------------- |
| Parallel pull (tiered)    | ✅     | 3 tiers based on FK dependencies                  |
| FK-ordered push           | ✅     | `TABLE_PUSH_ORDER` prevents constraint violations |
| Exponential backoff       | ✅     | Base 1s, max 60s, 30% jitter                      |
| Sync watchdog             | ✅     | 60s timeout prevents infinite sync                |
| Batch operations          | ⚠️     | Sync pushes items one-by-one (not batched)        |
| Network check before sync | ✅     | NetInfo check with listener                       |

**Optimization opportunity:** Batch push operations into a single Supabase `upsert` call per table instead of individual record pushes.

---

## 10. DESIGN SYSTEM & ANIMATION REVIEW

### 10.1 Theme System

| Check                     | Status  | Notes                                      |
| ------------------------- | ------- | ------------------------------------------ |
| Dark/Light themes defined | ✅      | `DARK_COLORS` / `LIGHT_COLORS`             |
| `useTheme()` hook         | ✅      | Returns current theme colors               |
| System theme preference   | ✅      | Uses `useColorScheme()` with user override |
| Hardcoded colors          | ❌ FAIL | 15+ instances (M1)                         |
| Legacy `COLORS` export    | ⚠️      | Still exists, defaults to light mode       |

### 10.2 Typography & Spacing

| Check                 | Status | Notes                               |
| --------------------- | ------ | ----------------------------------- |
| Font system (Manrope) | ✅     | 5 weights defined                   |
| Spacing scale         | ✅     | xs/sm/md/lg/xl/xxl                  |
| Radius scale          | ✅     | sm/md/lg/xl/xxl/full                |
| Typography scale      | ✅     | display/h1/h2/h3/body/caption/label |

### 10.3 Animations

| Check                 | Status       | Notes                                  |
| --------------------- | ------------ | -------------------------------------- |
| Reanimated ~4.1.1     | ✅           | Used for gesture-based interactions    |
| TransactionItem swipe | ✅           | Proper GestureDetector + Animated.View |
| Screen transitions    | ✅           | Expo Router default animations         |
| Layout animations     | Not observed | Could enhance list add/remove          |

---

## 11. WORKFLOW & BUSINESS LOGIC REVIEW

### 11.1 Transaction Lifecycle

```
Create → INSERT + Balance Effect → Sync Queue → Push to Supabase
Update → Reverse Old Balance → INSERT New → Apply New Balance → Sync Queue
Delete → Soft Delete (deletedAt) → Reverse Balance → Sync Queue
```

**Issue:** Update uses "reverse + apply" pattern which is correct but not atomic across the full chain. If crash occurs between reverse and apply, account balance is wrong.

### 11.2 Split Expense Logic

```
Create Split → Create Transaction → Create SplitExpense → Create N SplitMembers
```

Each step enqueues separately. If any step fails, partial data exists.

**Recommendation:** Wrap entire split creation in a single SQLite transaction.

### 11.3 Sync Conflict Resolution

- **Strategy:** Server-wins (Supabase data overwrites local on conflict)
- **Unique constraint (23505):** Triggers `rebaseLocalRecordId()` — generates new local ID and retries
- **RLS violation (42501):** Skips item (shared defaults like `cat_*`)
- **Network error:** Exponential backoff with jitter

This is a reasonable strategy for a single-user app.

### 11.4 Budget Tracking

Budgets use `spent` field that's updated by trigger/query. No direct coupling to transaction service — `spent` is recalculated. This is resilient to sync conflicts.

---

## 12. CODE QUALITY & CONVENTIONS

### 12.1 Style Guide Compliance

| Rule (from instructions)  | Compliance | Notes                                       |
| ------------------------- | ---------- | ------------------------------------------- |
| `getDatabase()` sync call | ✅ PASS    | All usages are synchronous                  |
| `enqueueSync()` 4 args    | ✅ PASS    | Consistent `(table, id, op, payload)`       |
| No `Alert.alert`          | ❌ FAIL    | 2 instances (M2)                            |
| No hardcoded hex colors   | ❌ FAIL    | 15+ instances (M1)                          |
| `generateId()` for UUIDs  | ✅ PASS    | All services use it                         |
| camelCase SQLite          | ✅ PASS    | Branch normalizes split columns             |
| snake_case Supabase       | ✅ PASS    | Live schema confirmed                       |
| No `@ts-ignore`           | ✅ PASS    | 0 instances in source                       |
| No unused `as any`        | ⚠️ PARTIAL | Some `as never` for icon names (acceptable) |

### 12.2 TypeScript Analysis

| Check                    | Status | Notes                                   |
| ------------------------ | ------ | --------------------------------------- |
| `strict: true`           | ✅     | tsconfig.json                           |
| `as any` usage           | ✅     | 0 found in source files                 |
| `@ts-ignore` usage       | ✅     | 0 found in source files                 |
| `as never` usage         | ⚠️     | ~6 instances for Ionicons type coercion |
| Proper interface exports | ✅     | All types in `src/utils/types.ts`       |

### 12.3 Code Smell Summary

| Smell                                   | Count       | Severity |
| --------------------------------------- | ----------- | -------- |
| `console.log/error/debug` in services   | 8+          | Medium   |
| Missing error boundaries                | 9/9 screens | High     |
| Dead re-export file (`dataServices.ts`) | 1           | Low      |
| Missing memoization                     | 2 screens   | Low      |
| Hardcoded polling interval (SMS)        | 1           | Low      |
| Legacy `COLORS` export                  | 1           | Low      |

---

## 13. SUPABASE & BACKEND REVIEW

### 13.1 Database Functions

| Function                    | Assessment                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `set_updated_at()`          | ✅ Simple trigger, correct                                                                                     |
| `handle_new_user()`         | ⚠️ SECURITY DEFINER — creates profile row on signup. Correct but review for injection via `raw_user_meta_data` |
| `get_dashboard_stats()`     | ❌ Should be SECURITY INVOKER (C2)                                                                             |
| `refresh_dashboard_stats()` | ⚠️ Expensive — fires on every tx (H4)                                                                          |

### 13.2 Edge Functions

| Function     | Assessment                                               |
| ------------ | -------------------------------------------------------- |
| `send-email` | ✅ Uses Resend API, proper error handling, HTML template |
|              | ⚠️ Verify CORS headers set correctly                     |
|              | ⚠️ No input validation on request body fields            |

### 13.3 RLS Policy Audit

| Table               | Policy                                    | Verdict                   |
| ------------------- | ----------------------------------------- | ------------------------- |
| accounts            | `auth.uid() = user_id`                    | ✅ Correct                |
| categories          | `auth.uid() = user_id OR user_id IS NULL` | ⚠️ Allows anon reads (H7) |
| transactions        | `auth.uid() = user_id`                    | ✅ Correct                |
| budgets             | `auth.uid() = user_id`                    | ✅ Correct                |
| goals               | `auth.uid() = user_id`                    | ✅ Correct                |
| assets              | `auth.uid() = user_id`                    | ✅ Correct                |
| liabilities         | `auth.uid() = user_id`                    | ✅ Correct                |
| net_worth_history   | `auth.uid() = user_id`                    | ✅ Correct                |
| user_profile        | `auth.uid() = user_id`                    | ✅ Correct                |
| split_expenses      | `auth.uid() = user_id`                    | ✅ Correct                |
| split_members       | `auth.uid() = user_id`                    | ✅ Correct                |
| split_friends       | `auth.uid() = user_id`                    | ✅ Correct                |
| payment_methods     | `auth.uid() = user_id`                    | ✅ Correct                |
| notes               | `auth.uid() = user_id`                    | ✅ Correct                |
| recurring_templates | `auth.uid() = user_id`                    | ✅ Correct                |

---

## 14. TESTING STRATEGY

### 14.1 Current State

**No automated tests exist.** Zero test files found in the repository.

### 14.2 Recommended Test Plan

#### Unit Tests (Jest + React Native Testing Library)

```
Priority 1 — Financial Logic:
├── transactionService.create()     — Amount validation, balance effects
├── transactionService.update()     — Reverse/apply balance atomicity
├── splitService.createSplit()      — Share calculation (equal/exact/percent)
├── formatCurrency()                — INR formatting edge cases
├── generateId()                    — UUID v4 format, uniqueness
└── syncTransform                   — All table mappings bidirectional

Priority 2 — Sync Engine:
├── pushPendingChanges()            — FK ordering, error handling
├── pullRemoteChanges()             — Conflict resolution, server-wins
├── rebaseLocalRecordId()           — Unique constraint recovery
├── ensureDefaultsSynced()          — Idempotent default push
└── backoffDelay()                  — Exponential with jitter

Priority 3 — Database:
├── initializeDatabase()            — Idempotent, race condition (new guard)
├── enqueueSync()                   — 4 args, payload serialization
├── upsertLocalRecord()             — Insert vs update
├── softDeleteLocalRecord()         — Sets deletedAt, enqueues
└── seedDefaultData()               — 23 categories, payment methods
```

#### Integration Tests

```
├── Transaction → Balance → Sync → Pull → Verify round-trip
├── Split Expense → Members → Friend aggregation
├── Auth → PIN/Biometric → Lock/Unlock cycle
├── Offline mode → Queue → Come online → Sync drain
└── Schema migration v1 → v2 → v3 → v4 → verify data
```

#### E2E Tests (Detox or Maestro)

```
├── Onboarding: Signup → Create account → First transaction
├── Full CRUD: Create → Read → Update → Delete transaction
├── Split flow: Create → Assign members → Mark paid
├── Budget alert: Set budget → Exceed → Notification
└── Sync: Offline create → Airplane mode off → Verify cloud
```

### 14.3 Test Infrastructure Requirements

```json
// package.json additions
"jest": "^29.0.0",
"@testing-library/react-native": "^12.0.0",
"@testing-library/jest-native": "^5.0.0"
```

Mock strategy:

- `expo-sqlite`: In-memory SQLite via `better-sqlite3` for unit tests
- `supabase`: Mock client with `.from().select().eq()` chain stubs
- `SecureStore`: Jest mock returning predictable values
- `NetInfo`: Mock online/offline states

---

## 15. BRANCH CHANGES REVIEW

### Branch: `audit-and-performace-testing` (commit `a9a9893`)

**17 files changed, +587 insertions, -213 deletions**

### 15.1 Changes Assessment

| Change                                        | File                  | Verdict                                          |
| --------------------------------------------- | --------------------- | ------------------------------------------------ |
| Race-guard `initializingPromise`              | database/index.ts     | ✅ **Excellent** — Prevents double-init          |
| `split_friends` added to `localTablesToClear` | database/index.ts     | ✅ **Correct** — Was missing                     |
| Split columns → camelCase                     | database/index.ts     | ✅ **Good** — Matches convention                 |
| `BEGIN IMMEDIATE TRANSACTION` for tx create   | transactionService.ts | ✅ **Good** — Atomic INSERT + balance            |
| `limitAmount` mapping added                   | syncTransform.ts      | ✅ **Critical fix** — Budgets would fail to sync |
| `recurring_templates` transform added         | syncTransform.ts      | ✅ **New feature support**                       |
| `isActive` added to boolean list              | syncTransform.ts      | ✅ **Necessary for recurring_templates**         |
| `clearTimeout` in sync `stop()`               | syncService.ts        | ✅ **Leak fix** — Timer cleanup                  |
| `as never` → proper types                     | syncService.ts        | ✅ **Type safety improvement**                   |
| `console.debug` for tags parse failure        | syncService.ts        | ⚠️ Remove for production                         |
| `resetAppState` clears `revisionTimer`        | appStore.ts           | ✅ **Leak fix** — Timer cleanup                  |
| Currency `'Rs'` → `'₹'`                       | constants.ts          | ✅ **Correct** — Proper INR symbol               |
| `generateId()` → `crypto.randomUUID()`        | constants.ts          | ✅ **Major improvement** — RFC 4122 UUID v4      |
| `recurring_templates` in `SYNCABLE_TABLES`    | constants.ts          | ✅ **Required for new table**                    |
| MigrationRunner v5 (column normalization)     | MigrationRunner.ts    | ✅ **Required for split column rename**          |
| `add_recurring_templates_table.sql`           | Supabase migration    | ✅ **New table**                                 |
| `add_sync_columns_to_notes.sql`               | Supabase migration    | ✅ **Enables notes sync**                        |
| `fix_function_search_path_security.sql`       | Supabase migration    | ✅ **Security fix** — `set search_path`          |

### 15.2 Branch Issues

1. **C4 still present:** `enqueueSync` outside transaction boundary in `transactionService.create()`
2. **`console.debug`** added in syncService — should be behind a debug flag
3. **MigrationRunner v5** — need to verify handles existing data correctly for column renames (renaming columns with data in SQLite can be tricky — verify `ALTER COLUMN RENAME` works on the SQLite version used)

### 15.3 Branch Verdict

**Overall: 👍 APPROVE with conditions** — The branch fixes several real bugs (limitAmount mapping, timer leaks, UUID generation, race condition guard) and adds proper recurring_templates support. Address C4 and remove debug logging before merge.

---

## 16. WHAT'S WORKING WELL

1. **Offline-first architecture** — SQLite as source of truth with sync queue is textbook correct for a mobile finance app
2. **RLS on all 15 tables** — Zero tables without row-level security
3. **Explicit column mapping** — `syncTransform.ts` prevents silent column name mismatches
4. **FK-ordered push / Tiered pull** — Prevents constraint violations during sync
5. **Conflict resolution** — `rebaseLocalRecordId()` for unique constraint conflicts is clever and correct
6. **UUID v4 generation** — Branch upgrade to `crypto.randomUUID()` is the gold standard
7. **WAL mode + NORMAL sync** — Optimal balance of performance and durability
8. **Deep link path whitelist** — Prevents unauthorized navigation
9. **Idempotent schema** — All `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`
10. **Type safety** — `strict: true`, zero `as any`, comprehensive type definitions
11. **Database init race guard** (branch) — `initializingPromise` prevents double initialization
12. **Clean Zustand architecture** — 3 focused slices with 100ms debounced `bumpDataRevision()`

---

## 17. ACTION PLAN

### Phase 1 — Pre-Release Critical (P0)

| #   | Action                                             | File(s)                                                  | Effort |
| --- | -------------------------------------------------- | -------------------------------------------------------- | ------ |
| 1   | Move `enqueueSync` inside transaction boundary     | transactionService.ts, all services with similar pattern | S      |
| 2   | Change `get_dashboard_stats()` to SECURITY INVOKER | supabase/schema.sql, new migration                       | S      |
| 3   | Install Sentry crash reporting                     | package.json, app/\_layout.tsx, services                 | M      |
| 4   | Plan integer-paisa migration for money fields      | All tables, services, UI formatting                      | L      |

### Phase 2 — High Priority (P1)

| #   | Action                                             | File(s)                                           | Effort |
| --- | -------------------------------------------------- | ------------------------------------------------- | ------ |
| 5   | Fix notes table UUID type mismatch                 | Supabase migration                                | S      |
| 6   | Add `avatar` to syncTransform mapping              | syncTransform.ts                                  | S      |
| 7   | Verify MigrationRunner v5 for split column renames | MigrationRunner.ts, test on device                | M      |
| 8   | Replace matview trigger with pg_cron schedule      | Supabase migration                                | S      |
| 9   | Add input validation on all amount fields          | All service create/update methods                 | M      |
| 10  | Add ErrorBoundary component                        | components/common/ErrorBoundary.tsx, \_layout.tsx | S      |
| 11  | Revoke `anon` SELECT grant, tighten categories RLS | Supabase migration                                | S      |
| 12  | Add auth rate limiting (client-side)               | auth.ts or auth screen                            | M      |

### Phase 3 — Medium Priority (P2)

| #   | Action                                                  | File(s)                  | Effort |
| --- | ------------------------------------------------------- | ------------------------ | ------ |
| 13  | Remove all hardcoded colors → theme system              | 5+ screen files          | M      |
| 14  | Replace `Alert.alert` with `CustomPopup`                | GoalsScreen, NotesScreen | S      |
| 15  | Replace `console.log/error` with structured logging     | All services             | S      |
| 16  | Delete `dataServices.ts` re-export wrapper              | dataServices.ts, imports | S      |
| 17  | Add `expo-updates` for OTA                              | package.json, app.json   | M      |
| 18  | Add accessibility labels to all screens                 | All screen files         | L      |
| 19  | Replace ScrollView with FlashList in TransactionsScreen | TransactionsScreen.tsx   | M      |
| 20  | Hash PIN before SecureStore storage                     | auth.ts                  | S      |
| 21  | Remove `react-native-worklets-core`                     | package.json             | S      |
| 22  | Add fatal error handling for DB init failure            | \_layout.tsx             | S      |

### Phase 4 — Testing (Ongoing)

| #   | Action                                        | Effort |
| --- | --------------------------------------------- | ------ |
| 23  | Set up Jest + RNTL + mocks                    | M      |
| 24  | Write financial logic unit tests (Priority 1) | L      |
| 25  | Write sync engine unit tests (Priority 2)     | L      |
| 26  | Write E2E smoke tests (Detox/Maestro)         | L      |

### Effort Key

- **S** = Small (< 1 hour)
- **M** = Medium (1-4 hours)
- **L** = Large (4+ hours)

---

_End of Audit Report_
