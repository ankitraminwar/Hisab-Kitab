# AI Context

## Purpose

This repo is an Expo mobile finance app with offline-first storage and optional Supabase cloud sync.

## Important Constraints

- Do not put service-role keys, database passwords, or Resend secrets in the app.
- Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` belong in `.env`.
- Local SQLite is the source of truth while offline.
- Remote sync only runs for authenticated users.
- Local writes should not wait for Supabase; they must queue and sync later.
- Remote Supabase tables use snake_case; local SQLite tables use camelCase.
- Unauthenticated users should be sent to `/login`, not directly into tab routes.
- Logged-in users should always have a `user_profile` row locally and remotely.

## Critical Files

- [app/\_layout.tsx](./app/_layout.tsx)
- [app/login.tsx](./app/login.tsx)
- [src/database/index.ts](./src/database/index.ts)
- [src/services/syncService.ts](./src/services/syncService.ts)
- [src/services/syncTransform.ts](./src/services/syncTransform.ts)
- [src/services/transactionService.ts](./src/services/transactionService.ts)
- [src/services/dataService.ts](./src/services/dataService.ts)
- [src/services/auth.ts](./src/services/auth.ts)
- [src/services/sms.ts](./src/services/sms.ts)
- [src/screens/settings/SettingsScreen.tsx](./src/screens/settings/SettingsScreen.tsx)
- [supabase/schema.sql](./supabase/schema.sql)
- [supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql](./supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql)

## Known Operational Caveat

If Supabase migrations are not applied, sync requests return `PGRST205`. The app is coded to keep working locally and surface that state rather than crashing.

## Mobile Target

Native Android and iOS are the supported targets. Web export is not the primary target because `expo-sqlite` web support requires extra handling.

## SMS Caveat

Android SMS ingestion uses `react-native-get-sms-android`, so it requires a native Android build and will not work in Expo Go. iOS cannot offer full SMS inbox access for this app category.
