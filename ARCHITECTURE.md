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

- uses SQLite as the write path first
- pushes pending local queue items
- auto-starts on app boot and on network reconnect
- triggers background sync after local writes while online
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
- if a logged-in user is missing a local profile row, the app creates one and queues it for sync

## Settings and Preferences

Profile and preferences are persisted in `user_profile` and mirrored into Zustand state.

Relevant files:

- [src/screens/settings/SettingsScreen.tsx](./src/screens/settings/SettingsScreen.tsx)
- [src/store/appStore.ts](./src/store/appStore.ts)
- [src/hooks/use-theme.ts](./src/hooks/use-theme.ts)
- [src/services/sms.ts](./src/services/sms.ts)

SMS behavior:

- Android inbox SMS reading uses `react-native-get-sms-android`
- bank/payment SMS messages are parsed into transactions and stored locally first
- imported messages are deduplicated using SMS-derived tags
- background polling runs on Android while the app is active
- Expo Go cannot use this because the SMS package requires a native build
- iOS cannot expose full inbox SMS reading for this app

## Notifications

Notification scheduling lives in [src/services/notifications.ts](./src/services/notifications.ts).

Android caveat:

- monthly reminders are scheduled as the next monthly `Date` trigger, not a calendar trigger, because Android rejected the calendar-based trigger used earlier.
