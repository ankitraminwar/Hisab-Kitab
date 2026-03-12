# Hisab Kitab

Offline-first personal finance manager built with Expo, React Native, TypeScript, SQLite, and Supabase.

## Stack

- Expo Router
- SQLite for primary local persistence
- Supabase auth and cloud sync
- Expo Notifications, Secure Store, Local Authentication, File System, Sharing
- Zustand and React Query

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
