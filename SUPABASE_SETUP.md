# Supabase Setup

## 1. Environment Variables

Create `.env` with:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Do not use `EXPO_PUBLIC_SUPABASE_KEY`.

## 2. Apply Schema

Run the SQL in:

- [supabase/schema.sql](./supabase/schema.sql)

If your project already exists and you only need the user-profile bootstrap fix, also run:

- [supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql](./supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql)

Without this, the app will log errors like:

- `PGRST205`
- `Could not find the table 'public.accounts' in the schema cache`

The current schema is intentionally idempotent:

- triggers are dropped and recreated
- RLS policies are dropped and recreated
- transaction indexes are created only if missing
- budget uniqueness is enforced per `user_id + category_id + month + year`
- new auth users automatically get a `public.user_profile` row
- existing auth users missing `public.user_profile` are backfilled by the migration

## 3. Edge Function

Deploy:

- [supabase/functions/send-email/index.ts](./supabase/functions/send-email/index.ts)

Required secret in Supabase:

- `RESEND_API_KEY`

## 4. Auth Settings

Enable email/password auth in Supabase.

Optional:

- email confirmation
- password reset redirect to `hisabkitab://reset-password`

Current mobile auth behavior:

- unauthenticated users are redirected to `/login`
- authenticated users are redirected away from auth screens
- logout clears local SQLite data before returning to login
- biometric preference is stored locally and mirrored to `user_profile`
- if a signed-in user is missing `user_profile`, the app creates it locally and syncs it

## 5. Sync Behavior

- SQLite remains the source of truth for active app usage
- writes are saved locally first and queued in `sync_queue`
- the app automatically pushes queued writes when internet is available
- remote changes are pulled back into SQLite during sync
- SMS-imported transactions follow the same offline-first flow

## 6. Android SMS Import

- the app uses `react-native-get-sms-android`
- required Android permissions are declared in [app.json](./app.json)
- this feature requires a native Android build and does not work in Expo Go
- imported messages are deduplicated with SMS tags before transaction creation

## 7. After Deployment

Restart the app or trigger sync again from an authenticated session.

Recommended restart command:

```bash
npx expo start -c
```
