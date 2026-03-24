# Hisab Kitab Product Features

## Product Overview

Hisab Kitab is an offline-first personal finance app designed to help users track money with less friction and more clarity. It combines fast day-to-day expense logging with budgeting, savings goals, split expenses, reports, backup, sync, and helpful automation like SMS-based transaction import on Android.

From a product perspective, the app is built for people who want a practical finance companion that works even with weak internet, supports Indian-style payment habits, and makes it easy to understand where money is going.

## Core Product Promise

- Track income, expenses, and transfers quickly
- Work reliably offline with local-first storage
- Sync data to the cloud when the user signs in
- Help users control spending through budgets and alerts
- Support savings habits through goals and progress tracking
- Make reporting, exporting, backup, and restore easy
- Reduce manual entry effort with SMS import on Android
- Support shared spending with split-expense workflows

## Target User Value

Hisab Kitab is especially useful for:

- Individuals managing daily personal finances
- Students and families tracking spending carefully
- Users who often work with limited or unstable internet
- People who want lightweight finance tracking without spreadsheet complexity
- Users in India who commonly use cash, bank, card, and UPI-style spending patterns

## Main Product Areas

## 1. Authentication and Access

The app supports account-based access using email and password. Users can:

- Sign up for a new account
- Log in to an existing account
- Request a password reset link
- Set a new password after reset

The authentication experience is designed to feel modern and guided, with dedicated login, signup, forgot-password, and reset-password flows.

Additional access and security features include:

- Biometric unlock support on compatible devices
- Automatic auth gating, so unauthenticated users are redirected to login
- Local lock protection before entering the main app when biometric protection is enabled

## 2. Dashboard Experience

The dashboard acts as the home control center of the app. It gives users a quick overview of their financial position and important actions.

Dashboard capabilities include:

- Summary of balance, income, expenses, and net worth
- Visual spending distribution via chart
- Recent transactions preview
- Budget alerts for categories nearing or exceeding limits
- Quick actions for common flows
- Shortcut access to notifications
- Pull-to-refresh and sync awareness

The dashboard is intended to answer three product questions immediately:

- How am I doing this month?
- What needs attention right now?
- What do I want to do next?

## 3. Transaction Management

Transaction tracking is the core workflow of the product.

Users can create and manage:

- Expenses
- Income
- Transfers between accounts

Each transaction can include:

- Amount
- Category
- Account
- Payment method
- Date
- Notes
- Transfer destination account when applicable

The add/edit transaction flow is optimized for speed:

- Large amount entry with custom numeric keypad
- Clean category selection grid
- Friendly notes input
- Fast account and payment method selection
- Transaction editing after creation

The transaction history experience includes:

- List view of all transactions
- Filters by type, category, and account
- Refresh support
- Edit and delete actions
- Detailed transaction view
- Special identification of SMS-imported transactions

## 4. Accounts Management

Hisab Kitab lets users maintain multiple money sources in one place.

Users can manage accounts such as:

- Cash
- Bank accounts
- Wallets
- UPI-style accounts
- Credit-style accounts and other custom types

Account features include:

- Add account
- Edit account details
- Delete account
- Track current balance
- Assign icon and color
- Use accounts as sources and destinations in transactions

This is presented via a premium horizontal carousel of glassmorphic cards, giving the app a more complete personal-finance feel instead of behaving like a simple expense-only tracker.

## 5. Categories and Payment Methods

The app supports structured categorization so users can understand spending patterns over time.

Users benefit from:

- Built-in categories
- Category-linked icons and colors
- Category-based reporting
- Category-based budgets

Payment methods are also supported as a first-class concept. Users can:

- Select from saved payment methods
- Add new custom payment methods
- Use payment method data in transaction records

This makes the product more realistic for everyday life, where the same person may spend through cash, bank card, wallet, or UPI.

## 6. Budgets

Budgets are one of the most important planning features in the app.

Users can:

- Create monthly budgets by category
- View total budget vs total spent
- See remaining budget
- Edit budget limits
- Delete budgets

Budget UX includes:

- Category-level budget cards
- Progress bars
- Over-budget and warning states
- Dashboard budget alerts
- Notification generation based on spending progress

This helps turn raw tracking into actual behavior support, which is important from a product perspective.

## 7. Savings Goals

The app includes savings goal tracking to support longer-term financial planning.

Users can:

- Create savings goals
- Set target amount
- Set current saved amount
- Add funds to a goal
- Delete a goal

Goal value to the product:

- Encourages intentional saving
- Shows progress in a visual way
- Gives users motivation beyond expense logging
- Helps position the app as a planning tool, not just a recorder

## 8. Reports and Analytics

Hisab Kitab includes a dedicated reporting experience focused on helping users understand trends over time.

Report capabilities include:

- Weekly, monthly, and yearly views
- Income vs expense comparison
- Savings calculation
- Trend comparison against previous period
- Category-wise spending breakdown
- Top spending categories

This area gives users a more analytical lens on their finances and supports reflection, planning, and habit improvement.

## 9. Net Worth Tracking

The app goes beyond transactions by supporting broader net worth visibility.

This includes:

- Assets
- Liabilities
- Net worth history
- Net worth progress snapshots over time

From a product positioning standpoint, this broadens Hisab Kitab from an expense tracker into a more complete personal finance manager.

## 10. Split Expenses

Split expense support is a major collaborative money feature in the app.

Users can:

- Create a split from an expense
- Link a split to a transaction
- Maintain a list of friends to add to splits across different transactions
- Choose split method
- Mark friend shares as paid
- View a "By Friend" timeline with aggregated net balances
- Settle up all debts with a specific friend with one tap

Supported split methods include:

- Equal split
- Exact amount split
- Percentage split

Split-related product benefits:

- Useful for friends, roommates, trips, and shared bills
- Helps the app support group spending scenarios
- Lets users track whether other participants have paid their share

## 11. SMS Import on Android

SMS import is one of the most practical convenience features in the product.

On supported Android native builds, the app can:

- Read bank and transaction-like SMS messages
- Parse likely debit and credit messages
- Extract amount and merchant-like information
- Let users import detected transactions
- Preserve SMS origin metadata

Product advantage:

- Reduces manual entry effort
- Makes adoption easier for busy users
- Fits real-world banking behavior in India and similar markets

## 12. Notifications and Alerts

The app includes an internal notifications experience focused on financial awareness.

Examples include:

- Budget warning notifications
- Budget exceeded notifications
- Goal achieved notifications

Users can access notifications from the app and review important financial events that need attention.

## 13. Export, Backup, and Restore

Hisab Kitab includes strong data portability and recovery features.

Users can export data in multiple formats:

- CSV for spreadsheet analysis
- PDF for readable report sharing, fully styled with pure CSS, icons, and daily financial motivation quotes
- JSON for full backup and restore

Export content includes:

- Summary information
- Category-wise spending
- All transactions

Backup and restore capabilities:

- Create a full JSON backup of app data
- Import a JSON backup into the app
- Merge imported data into local records

This is a major trust feature because users know they can keep control of their financial history.

## 14. Email Reports

The app can send a monthly summary report to the signed-in user’s email address.

This feature helps users:

- Get passive financial summaries
- Review monthly performance outside the app
- Maintain a lightweight reporting habit

It also gives the product a more complete and polished feel.

## 15. Offline-First Sync

One of the most important product strengths is offline-first reliability.

The app is built so that:

- Data is stored locally first
- User actions do not depend on internet availability
- Changes are queued for sync
- Cloud sync runs later when connectivity returns

Sync-related product benefits:

- Faster perceived performance
- Better reliability in low-network environments
- Less risk of user frustration from failed saves
- More confidence that data entry will not be lost

The cloud layer supports:

- Backup across sessions and devices
- Push and pull sync
- Conflict handling using latest update timestamps

## 16. Themes and Personalization

Hisab Kitab supports appearance and personalization options that improve comfort and ownership.

Users can manage:

- Theme preference
- Profile details
- Profile photo/avatar
- Biometric preference
- SMS-related preference settings

This makes the product feel more user-centered and polished.

## 17. FAQ and Guided Understanding

The app includes a dedicated FAQ and Help experience to explain core flows in simple language.

It currently helps users understand:

- Quick start
- Basic transaction flow
- Budget flow
- Split expense flow
- Backup and sync flow
- Common product questions

From a product perspective, this reduces onboarding friction and improves confidence for first-time users.

## 18. Android Home Screen Widgets

The product includes Android widgets for glanceable finance awareness and faster action.

Available widget experiences include:

- Expense summary
- Budget health
- Quick add
- Savings goal and net worth related widget data support

These widgets help the app remain useful even outside direct in-app sessions.

## End-to-End User Flows

## Daily Money Tracking Flow

1. User opens dashboard
2. User taps add transaction
3. User enters amount
4. User adds optional note
5. User selects category, account, and payment method
6. User saves transaction
7. Dashboard, history, budgets, and reports update accordingly

## Monthly Planning Flow

1. User creates category budgets
2. User tracks transactions during the month
3. App calculates spent amount against budget limits
4. Dashboard and notifications show warnings when usage is high
5. User reviews month-end results in reports or exported files

## Shared Expense Flow

1. User records an expense
2. User selects Split This Expense
3. User chooses split method
4. User adds members and shares
5. User tracks paid and pending statuses
6. User revisits split detail later as people settle up

## Backup and Recovery Flow

1. User exports full JSON backup
2. User stores the file safely
3. User later imports the backup if needed
4. App restores data into local storage

## Product Strengths

- Offline-first by default
- Broad feature set without being enterprise-heavy
- Strong support for Indian transaction habits and SMS-based workflows
- Covers both tracking and planning
- Includes collaboration via split expenses
- Offers backup, restore, export, email, and widgets
- Practical for daily use, not just occasional reporting

## Product Positioning Summary

Hisab Kitab is best described as an offline-first personal finance manager that combines fast transaction tracking, budgeting, savings goals, split expenses, reports, SMS-assisted entry, and reliable backup/sync into one mobile experience.

It is more than an expense tracker because it also supports planning, analysis, collaboration, portability, and long-term financial visibility.
