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

Without this, the app will log errors like:

- `PGRST205`
- `Could not find the table 'public.accounts' in the schema cache`

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

## 5. After Deployment

Restart the app or trigger sync again from an authenticated session.
