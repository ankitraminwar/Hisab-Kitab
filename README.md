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
- Local changes are written first and then queued for background sync
- When internet returns, queued changes are pushed to Supabase automatically
- First authenticated session can prompt for biometric unlock
- If a logged-in user has no local `user_profile`, one is created automatically

## SMS Import Status

- Android uses `react-native-get-sms-android` to read inbox SMS in native builds
- Bank/payment SMS messages are parsed into local expense or income transactions
- Imported SMS transactions are tagged to prevent duplicates
- Background SMS polling runs roughly every 60 seconds on Android
- If the device is online, imported SMS transactions are synced to Supabase automatically
- The app remains offline-first: SMS imports are stored locally even when offline
- iOS does not support full SMS inbox access for third-party apps
- Expo Go cannot use this feature because the package requires a native Android build

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

For Android SMS import, use a native Android build or dev client instead of Expo Go.

## Required Backend Step

The mobile app will not sync until the Supabase schema is deployed.

Apply:

- [supabase/schema.sql](./supabase/schema.sql)
- [supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql](./supabase/migrations/20260312_221818_bank_sms_auto_sync_profile_bootstrap.sql)

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

## AI & Development Notes

- App is built with theme toggles in `Settings` (dark / light / system) via `src/hooks/useTheme.ts`.
- Most screens use themed colors. Screens still using `COLORS` from `src/utils/constants.ts` are now upgraded to dynamic colors in light mode to avoid dark-only styling.
- For future AI tools or code assistants, ask for ‘theme-based color override’ and ‘useTheme usage’ if a component appears hardcoded to `COLORS`.

## SMS Import Package Recommendation

The project is already wired to use `react-native-get-sms-android` in native Android builds. If you want better Expo managed workflow, use `@maniac-tech/react-native-expo-read-sms` (but this may require custom native config and not work in Expo Go without dev client). For OTP-only verification use `react-native-sms-retriever`.
