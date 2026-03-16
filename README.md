# Hisab Kitab

> v2.0.0 — Offline-first personal finance manager for Android & iOS

Built with Expo 54, React Native 0.81.5, TypeScript, SQLite, and Supabase. Zero TypeScript errors, zero ESLint warnings.

## Features

- **Dashboard** — Animated hero card, donut chart for category breakdown, savings ring, budget progress, quick actions, recent transactions
- **Transactions** — Add/edit income, expense & transfer with categories, accounts, payment methods, tags, notes, recurring support
- **Split Expenses** — Split bills with friends (equal/exact/percent), track member payment status
- **Budgets** — Monthly per-category budgets with progress bars and over-budget alerts
- **Goals** — Savings goals with target amounts, deadlines, and fund tracking
- **Reports** — Spending trend charts, category distribution, net worth tracker (assets vs liabilities)
- **Net Worth** — Asset and liability management with history snapshots
- **Notifications** — In-app budget-exceeded and goal-completion alerts
- **SMS Import** — Auto-import bank/UPI transactions from SMS (Android native builds only)
- **Accounts** — Manage bank, UPI, wallet, credit card, and investment accounts
- **Cloud Sync** — Bidirectional sync with Supabase (offline-first with sync queue)
- **Email Reports** — Monthly summary email via Supabase Edge Function + Resend
- **Dark/Light Theme** — Explicit or system-aware theming
- **Biometric Lock** — Fingerprint/face unlock on app resume
- **Data Export** — CSV transactions, PDF transactions, full JSON backup
- **Data Import** — Restore from JSON backup
- **Android Widgets** — Home screen widgets: Expense Summary, Budget Health, Quick Add

## Stack

| Layer       | Technology                                           |
| ----------- | ---------------------------------------------------- |
| Framework   | Expo ~54.0.0 + React Native 0.81.5                   |
| Language    | TypeScript (strict, 0 errors)                        |
| Routing     | expo-router ~6.0.23 (file-based, typed routes)       |
| Local DB    | expo-sqlite ~16.0.10 (source of truth)               |
| Remote DB   | Supabase (PostgreSQL + Auth + Edge Functions)        |
| State       | Zustand ^4.4.0 + @tanstack/react-query ^5.28.0       |
| Animations  | react-native-reanimated ~4.1.1, expo-linear-gradient |
| Charts      | @shopify/react-native-skia ^2.2.12, react-native-svg |
| Lists       | @shopify/flash-list 2.0.2                            |
| Widgets     | react-native-android-widget ^0.20.1                  |
| SMS parsing | react-native-get-sms-android ^2.1.0                  |
| Linting     | ESLint ^9.0.0 + eslint-config-expo                   |
| Formatting  | Prettier (pre-commit via husky + lint-staged)        |

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

3. For SMS import or Android widgets, use a native build:

```bash
npm run android   # npx expo run:android
```

## Backend Setup

Apply Supabase schema before sync will work:

```bash
# Paste into Supabase SQL editor:
supabase/schema.sql
```

Deploy email edge function:

```bash
supabase functions deploy send-email
# Add secret in Supabase dashboard: RESEND_API_KEY
```

Enable email/password auth in Supabase dashboard.

Without backend setup the app runs in full local-only mode.

## Commands

```bash
npm run start        # Start Expo dev server
npm run android      # Native Android build & run
npm run typecheck    # tsc --noEmit (must stay at 0 errors)
npm run lint         # ESLint --max-warnings 0 (must stay at 0)
npm run format       # Prettier
npm run doctor       # Expo doctor
npm test             # Alias for typecheck
```

## Docs

- [AI_CONTEXT.md](./AI_CONTEXT.md) — AI agent reference (read this first for coding)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture details
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Backend setup guide
