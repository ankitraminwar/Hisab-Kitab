# Architecture

## Runtime Model

Mobile App
-> SQLite
-> Sync Service
-> Supabase
-> Edge Functions
-> Resend

## Local Data

Primary local persistence lives in [src/database/index.ts](./src/database/index.ts).

Core tables:

- `accounts`
- `categories`
- `transactions`
- `budgets`
- `goals`
- `assets`
- `liabilities`
- `net_worth_history`
- `user_profile`
- `sync_queue`

## Sync

Sync orchestration lives in [src/services/syncService.ts](./src/services/syncService.ts).
Field mapping between local SQLite camelCase records and Supabase snake_case rows lives in [src/services/syncTransform.ts](./src/services/syncTransform.ts).

Behavior:

- pushes pending local queue items
- pulls remote changes by `updated_at`
- maps local camelCase fields to remote snake_case fields
- resolves conflicts by latest update timestamp
- skips remote work when no authenticated user exists
- degrades to local-only mode if Supabase schema is not deployed

## Auth

Auth client:

- [src/lib/supabase.ts](./src/lib/supabase.ts)
- [src/services/auth.ts](./src/services/auth.ts)

UI routes:

- `/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/reset-password`

Behavior:

- root layout redirects unauthenticated users to `/login`
- logout clears local SQLite data and resets app store state
- first authenticated session can prompt the user to enable biometrics

## Settings and Preferences

Profile and preferences are persisted in `user_profile` and mirrored into Zustand state.

Relevant files:

- [src/screens/settings/SettingsScreen.tsx](./src/screens/settings/SettingsScreen.tsx)
- [src/store/appStore.ts](./src/store/appStore.ts)
- [src/hooks/use-theme.ts](./src/hooks/use-theme.ts)
- [src/services/sms.ts](./src/services/sms.ts)

Current caveat:

- SMS import UI and Android permission flow exist, but full inbox reading still requires a native Android SMS reader module

## Notifications

Notification scheduling lives in [src/services/notifications.ts](./src/services/notifications.ts).

Android caveat:

- monthly reminders are scheduled as the next monthly `Date` trigger, not a calendar trigger, because Android rejected the calendar-based trigger used earlier.
