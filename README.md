# Hisab Kitab

Offline-first personal finance manager built with Expo, React Native, TypeScript, SQLite, and Supabase.

## Stack

- Expo Router
- SQLite for primary local persistence
- Supabase auth and cloud sync
- Expo Notifications, Secure Store, Local Authentication, File System, Sharing
- Zustand and React Query

## Current App Flow

- App startup route is `/`
- Unauthenticated users are redirected to `/login`
- Sign-up / reset flows live under `/auth/*`
- Local SQLite data is cleared on logout
- Supabase sync only runs for authenticated users
- First authenticated session can prompt for biometric unlock

## SMS Import Status

- Android permission requests are wired for SMS access
- Current code only exposes the permission/import entry point
- Full inbox reading still requires adding a native Android SMS module
- iOS does not support full SMS inbox access for third-party apps

## Local Setup

1. Create `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

2. Install dependencies:

```bash
npm install
```

3. Start Expo:

```bash
npm run start
```

## Required Backend Step

The mobile app will not sync until the Supabase schema is deployed.

Apply:

- [supabase/schema.sql](./supabase/schema.sql)

If the schema is not deployed, the app now falls back to local-only mode and reports the sync error instead of crashing.

After applying the schema, restart the app with a clean cache:

```bash
npx expo start -c
```

## Validation Commands

```bash
npm run typecheck
npm run lint
npm run doctor
```

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AI_CONTEXT.md](./AI_CONTEXT.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
