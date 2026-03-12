# Hisab Kitab v2.0 — Upgrade Guide

## How to Apply the Patch

```bash
# 1. Clone the original repo
git clone https://github.com/ankitraminwar/Hisab-Kitab.git
cd Hisab-Kitab

# 2. Apply the patch
git apply hisab-kitab-upgrade.patch

# 3. Install dependencies
npm install

# 4. Start the app
npx expo start
```

---

## What's New in v2.0

### Architecture

- Full modular `src/` folder with modules for transactions, accounts, budgets, goals, reports
- TypeScript strict mode throughout
- Zustand global state management
- SQLite offline-first database with WAL mode for performance

### Screens Added

| Screen          | Features                                                                               |
| --------------- | -------------------------------------------------------------------------------------- |
| Dashboard       | Net worth hero card, savings rate, account cards, budget overview, recent transactions |
| Transactions    | FlashList with 50K+ support, search, filters by type/category/account/date             |
| Add Transaction | Income / Expense / Transfer, category picker, account selector, tags, notes            |
| Budgets         | Monthly budget tracking, category-wise progress bars, alerts                           |
| Goals           | Savings goals with progress, fund tracking, deadlines                                  |
| Reports         | Victory Native pie charts, bar charts, category breakdown table                        |
| Net Worth       | Assets & liabilities tracker, net worth calculation                                    |
| Accounts        | Multi-account support (cash, bank, UPI, credit card, wallet)                           |
| Settings        | Biometric lock, CSV/JSON export, notification toggles                                  |

### Database Schema

- **transactions** — Full CRUD with automatic account balance sync and budget tracking
- **accounts** — Multi-currency, typed accounts
- **categories** — 17 default + custom categories
- **budgets** — Monthly per-category budgets with auto-spent calculation
- **goals** — Savings goals with fund tracking
- **assets** — 8 asset types (bank, cash, stocks, mutual funds, crypto, gold, real estate, other)
- **liabilities** — Credit card, loans, mortgage
- **net_worth_history** — Trend snapshots

### Performance

- FlashList for 60 FPS scrolling with 50,000+ transactions
- SQLite WAL mode + indexes on date, category, account
- Search < 100ms via SQL LIKE queries with indexes
- Paginated transaction loading (30 per page)

### Security

- Biometric authentication (Face ID / Fingerprint)
- App lock screen with unlock flow
- expo-secure-store for sensitive data
- No analytics, no ads, no tracking

### Export / Backup

- CSV export of all transactions
- JSON full backup
- Shareable via native share sheet

### UI Design

- Dark-first design with purple (#7C3AED) primary accent
- Income = green (#22C55E), Expense = red (#F43F5E), Transfer = blue
- Cards with subtle glow borders
- Bottom sheet modals for forms
- Smooth tab bar with active indicator

---

## Tech Stack

```
expo ~51.0.0
expo-router ~3.5.0
expo-sqlite ~14.0.3
@shopify/flash-list ^1.6.3
victory-native ^41.1.0
zustand ^4.5.2
date-fns ^3.6.0
expo-local-authentication ~14.0.1
expo-file-system ~17.0.1
expo-sharing ~12.0.1
```

## Folder Structure

```
app/
  _layout.tsx          # Root layout with DB init + auth lock
  (tabs)/
    _layout.tsx        # Bottom tab navigator
    index.tsx          # Dashboard
    transactions.tsx   # Transactions list
    budgets.tsx        # Budget tracker
    goals.tsx          # Savings goals
    reports.tsx        # Analytics
  transactions/
    add.tsx            # Add/Edit transaction
    [id].tsx           # Transaction detail
  accounts/index.tsx   # Accounts manager
  settings/index.tsx   # Settings

src/
  database/index.ts    # SQLite schema + seed
  utils/
    types.ts           # All TypeScript interfaces
    constants.ts       # Colors, typography, formatters
  store/appStore.ts    # Zustand global state
  services/
    transactionService.ts   # Transaction CRUD + stats
    dataServices.ts         # Accounts, Budgets, Goals, Net Worth
  components/
    common/index.tsx        # Card, Button, FAB, SearchBar, etc.
    TransactionItem.tsx     # Optimized FlashList row
  screens/
    dashboard/
    transactions/
    budgets/
    goals/
    reports/
    accounts/
    settings/
```
