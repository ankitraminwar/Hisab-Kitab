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

- All tables (accounts, categories, transactions, budgets, goals, assets, liabilities, net_worth_history, user_profile, recurring_templates, split_expenses, split_members, payment_methods, sync_queue, sync_state)
- All indexes and foreign keys
- RLS policies (per-user isolation via `auth.uid()`)
- Triggers (e.g. auto-create `user_profile` on new auth user)
- Seed data for default categories and payment methods
- Backfill for existing auth users missing `user_profile`

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

| Secret           | Value                               |
| ---------------- | ----------------------------------- |
| `RESEND_API_KEY` | Your Resend API key from resend.com |

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
- If a signed-in user is missing `user_profile`, the app creates it locally and syncs on next connection

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
npm run android   # npx expo run:android
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
npm run android
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
2. The email address is verified in your Resend account (if in sandbox mode)
