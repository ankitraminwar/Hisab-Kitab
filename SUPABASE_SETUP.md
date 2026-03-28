# Supabase Setup

## 1. Environment Variables

Create `.env` in the project root with:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use `EXPO_PUBLIC_SUPABASE_ANON_KEY` (not `EXPO_PUBLIC_SUPABASE_KEY`).

These are the only secrets needed in the app. Never add service role keys or other secrets.

## 2. Apply Schema

Paste the following file into the Supabase SQL editor and run it:

- [supabase/schema.sql](./supabase/schema.sql)

This single idempotent file creates:

- All tables (accounts, categories, transactions, budgets, goals, assets, liabilities, net_worth_history, user_profile, split_expenses, split_members, payment_methods, notes)
- All indexes and triggers (including GIN index on `tags`, composite indexes for dashboard/filter queries)
- RLS policies (per-user isolation via `auth.uid()`; categories read policy allows default rows with `user_id IS NULL`)
- `handle_new_user` trigger (auto-creates `user_profile` on new auth user with `theme_preference: 'system'`)
- `dashboard_monthly_stats` materialized view (pre-aggregated monthly income/expenses/net per user, refreshed explicitly by client — no auto-refresh trigger)
- `get_dashboard_stats(month)` RPC function (`security invoker`) for accessing dashboard aggregates
- Backfill for existing auth users missing `user_profile`

**Design decisions**:

- **No inter-table FK constraints** — e.g. `transactions.category_id → categories.id` is intentionally absent. SQLite enforces FK integrity locally. Removing them from Supabase prevents FK violations when offline-first sync pushes records out of dependency order.
- **`user_id → auth.users(id)`** FK is retained on all tables.
- **`payment_method`** column on `transactions` has no CHECK constraint — accepts any string (SMS imports use varied values).
- **`user_profile.avatar`** — `TEXT` column for profile photo URI.
- **`notes.id`** — `TEXT` primary key (UUID string), not `uuid` type, consistent with all other entity IDs.

Safe to run multiple times — triggers and policies are dropped and recreated.

Without this schema the app will log errors like:

```
PGRST205
Could not find the table 'public.accounts' in the schema cache
```

The app still works locally in offline mode — sync errors are non-fatal.

## 3. Edge Function — Email Reports

Deploy the email edge function:

```bash
supabase functions deploy send-email
```

Add the required secret in the Supabase dashboard → Edge Functions → Secrets:

| Secret              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| `RESEND_API_KEY`    | Your Resend API key from resend.com                      |
| `RESEND_FROM_EMAIL` | A verified sender address in Resend, e.g. `no-reply@...` |
| `RESEND_FROM_NAME`  | Optional display name, e.g. `Hisab Kitab`                |

Source file: [supabase/functions/send-email/index.ts](./supabase/functions/send-email/index.ts)

This function is called from `src/services/emailReportService.ts` to send monthly financial summary emails to the signed-in user.

## 4. Auth Settings

In Supabase dashboard → Authentication → Providers:

- Enable **Email** provider (email + password)

Optional settings:

| Setting                     | Notes                                                      |
| --------------------------- | ---------------------------------------------------------- |
| Email confirmation          | Optional — app works either way                            |
| Password reset redirect URL | Set to `hisabkitab://reset-password` for deep-link support |

Current auth behavior in the app:

- Unauthenticated users → redirected to `/login`
- Authenticated users → redirected away from auth screens
- Logout → clears local SQLite data, resets app store, returns to `/login`
- Biometric lock preference stored locally and mirrored to `user_profile`
- If local user data is missing after sign-in, the app forces a full pull from Supabase before showing finance data

## 5. Sync Behavior

The app is fully offline-first:

- All writes go to SQLite immediately and are queued in `sync_queue`
- Push: queued writes are sent to Supabase when internet is available
- Pull: remote rows updated since last sync are merged into local SQLite
- Conflict resolution: latest `updated_at` wins
- Soft deletes: `deletedAt` field set — rows are never hard-deleted
- Only tables listed in `SYNCABLE_TABLES` (in `src/utils/constants.ts`) participate in sync
- Sync triggers: app start, auth change, network reconnect, manual sync button, after each local write

## 6. Android SMS Import

SMS import requires a **native Android build** (not Expo Go):

```bash
yarn android   # expo run:android
```

- Uses `react-native-get-sms-android ^2.1.0`
- Required permissions declared in `app.json` (`READ_SMS`)
- Parser scans inbox for bank/UPI keywords (`debited`, `credited`, `spent`, `received`, etc.)
- Extracts INR amounts with regex (`INR 100.00` / `Rs. 100` patterns)
- Deduplicates imported messages before creating transactions
- Imported transactions sync to Supabase like any other transaction

## 7. Android Home Screen Widgets

Widgets also require a native Android build:

```bash
yarn android
```

Three widgets available:

| Widget          | Description                                    |
| --------------- | ---------------------------------------------- |
| Expense Summary | Current month income, expenses, top categories |
| Budget Health   | Per-budget spend bars, overall percent         |
| Quick Add       | Tap-to-open shortcut to add a new transaction  |

Widgets are powered by `react-native-android-widget` and read data via `WidgetDataService`.

## 8. After Initial Setup

Restart the app after applying the schema:

```bash
npx expo start -c
```

To verify sync is working, sign in, add a transaction, and check the Supabase table editor — the row should appear within seconds.

If the `send-email` edge function returns an error, check:

1. `RESEND_API_KEY` secret is set in Supabase
2. `RESEND_FROM_EMAIL` is set in Supabase
3. The domain used by `RESEND_FROM_EMAIL` is verified in Resend
4. Open Supabase Dashboard -> Edge Functions -> `send-email` -> Logs / Invocations and inspect the exact error
