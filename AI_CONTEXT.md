# AI Context

## Purpose

This repo is an Expo mobile finance app with offline-first storage and optional Supabase cloud sync.

## Important Constraints

- Do not put service-role keys, database passwords, or Resend secrets in the app.
- Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` belong in `.env`.
- Local SQLite is the source of truth while offline.
- Remote sync only runs for authenticated users.

## Critical Files

- [app/_layout.tsx](./app/_layout.tsx)
- [src/database/index.ts](./src/database/index.ts)
- [src/services/syncService.ts](./src/services/syncService.ts)
- [src/services/transactionService.ts](./src/services/transactionService.ts)
- [src/services/dataService.ts](./src/services/dataService.ts)
- [src/services/auth.ts](./src/services/auth.ts)
- [src/screens/settings/SettingsScreen.tsx](./src/screens/settings/SettingsScreen.tsx)
- [supabase/schema.sql](./supabase/schema.sql)

## Known Operational Caveat

If Supabase migrations are not applied, sync requests return `PGRST205`. The app is coded to keep working locally and surface that state rather than crashing.

## Mobile Target

Native Android and iOS are the supported targets. Web export is not the primary target because `expo-sqlite` web support requires extra handling.
