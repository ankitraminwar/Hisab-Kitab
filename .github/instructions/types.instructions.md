---
name: 'TypeScript Types Instructions'
description: 'Rules for all TypeScript types in this project'
applyTo: 'src/utils/types.ts,src/**/*.ts,src/**/*.tsx'
---

# TypeScript Types — Hisab Kitab

## Single Source of Truth — `src/utils/types.ts`

ALL TypeScript types and interfaces live in `src/utils/types.ts`.
Never declare new types inside component files, screen files, or service files.

```ts
import type { IoniconsName, Transaction, ThemeColors, AccountType } from '@/utils/types';

// WRONG
interface MyProps { ... } // ❌ in a component file
type Status = 'pending' | 'synced'; // ❌ in a service file
// Add these to src/utils/types.ts instead
```

---

## Key Types Reference

```ts
// src/utils/types.ts

// Icon names — strict union of all valid Ionicons names
export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// Theme colors — always from useTheme(), never import COLORS directly in screens
// ThemeColors = typeof DARK_COLORS | typeof LIGHT_COLORS  (from useTheme.ts)
import type { ThemeColors } from '@/hooks/useTheme';

// Transaction type
export type TransactionType = 'expense' | 'income' | 'transfer';

// Sync status
export type SyncStatus = 'pending' | 'synced' | 'failed';

// PaymentMethod is typed as string — NOT a union
// This is intentional: varied external sources create diverse payment method strings
export type PaymentMethod = string; // Do not change to a union

// Split methods
export type SplitMethod = 'equal' | 'exact' | 'percent';

// Percentage widths
import type { DimensionValue } from 'react-native';
const width: DimensionValue = '80%'; // Use DimensionValue, not string or number
```

---

## No `any` — Zero Exceptions

```ts
// CORRECT — proper types
const payload = record as unknown as Record<string, unknown>; // safe cast for sync payloads
const icon = 'wallet-outline' as IoniconsName; // safe cast for icons
const icon = 'wallet-outline' as never; // also acceptable for icons

// WRONG — ESLint errors
const data: any = response; // ❌
const db = getDatabase() as any; // ❌ as any is forbidden
// @ts-ignore                       // ❌ never suppress TS errors
```

---

## TypeScript Strict Rules

- `strict: true` — no exceptions
- All async functions explicitly handle errors with `try/catch` or `.catch()`
- All component props have an explicit interface — no inline types
- `interface` for object shapes; `type` for unions and mapped types
- `DimensionValue` from `react-native` for all percentage widths

---

## Entity Types — Required Sync Fields

All syncable entity types must include these fields:

```ts
interface YourEntity {
  id: string; // UUID from generateId()
  // ...domain fields
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
  userId: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  deletedAt: string | null; // null = active, ISO string = soft-deleted
}
```

---

## Naming Conventions

| Entity        | Convention           | Example                     |
| ------------- | -------------------- | --------------------------- |
| Components    | PascalCase           | `TransactionCard.tsx`       |
| Screen files  | PascalCase + Screen  | `TransactionsScreen.tsx`    |
| Service files | camelCase + Service  | `transactionService.ts`     |
| Zustand store | `appStore.ts`        | One store, three slices     |
| Types         | PascalCase           | `Transaction`, `SyncStatus` |
| Constants     | SCREAMING_SNAKE_CASE | `MAX_SYNC_RETRIES`          |
| Hook files    | camelCase with `use` | `useTheme.ts`               |

---

## Import Alias — `@/` maps to `src/`

Never write `@/src/...` — the `src/` is already in the alias.

```ts
import type { IoniconsName } from '@/utils/types'; // ✅
import type { ThemeColors } from '@/hooks/useTheme'; // ✅
import { generateId } from '@/utils/constants'; // ✅

import type { IoniconsName } from '@/src/utils/types'; // ❌ double src
```
