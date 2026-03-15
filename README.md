# Hisab Kitab

Offline-first personal finance manager built with Expo, React Native, TypeScript, SQLite, and Supabase.

## Features

- **Dashboard** — Income/expense summary, savings progress, budget alerts, spending charts, quick actions
- **Transactions** — Add/edit income & expenses with categories, accounts, tags, notes
- **Split Expenses** — Split bills with friends (equal/exact/percent), track payments
- **Budgets** — Monthly category budgets with progress tracking
- **Goals** — Savings goals with target amounts and deadlines
- **Reports** — Spending distribution charts, category breakdowns
- **SMS Import** — Auto-import bank/UPI transactions from SMS (Android native builds)
- **Accounts** — Manage bank accounts and wallets
- **Cloud Sync** — Real-time sync with Supabase (offline-first, works without internet)
- **Dark/Light Theme** — System-aware theming
- **Biometric Lock** — Fingerprint/face unlock
- **Data Export** — CSV and JSON export

## Stack

- **Expo** ~54.0.0 + **React Native** 0.81.5
- **expo-router** for file-based navigation
- **expo-sqlite** for local persistence
- **Supabase** for auth, cloud database, edge functions
- **Zustand** + **React Query** for state management
- **react-native-reanimated** for animations
- **@shopify/react-native-skia** for charts

## Local Setup

1. Create `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Install and start:

```bash
npm install
npm run start
```

3. For SMS import, use a native Android build (not Expo Go):

```bash
npx expo run:android
```

## Backend Setup

Apply Supabase schema before sync will work:

```bash
# Apply in Supabase SQL editor:
supabase/schema.sql
```

Deploy edge function:

```bash
supabase functions deploy send-email
# Set secret: RESEND_API_KEY
```

Enable email/password auth in Supabase dashboard.

Without backend setup, app works in local-only mode.

## Commands

```bash
npm run start        # Start Expo dev server
npm run typecheck    # TypeScript check (npx tsc --noEmit)
npm run lint         # ESLint
npm run doctor       # Expo doctor
```

## Docs

- [AI_CONTEXT.md](./AI_CONTEXT.md) — AI agent reference (read this first for coding)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture details
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Backend setup guide
