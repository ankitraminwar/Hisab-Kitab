---
name: 'State Management Instructions'
description: 'Rules for Zustand store usage across all files'
applyTo: 'src/store/**/*.ts,src/screens/**/*.tsx,src/services/**/*.ts'
---

# State Management — Hisab Kitab

## Single Store — `src/store/appStore.ts`

There is **one Zustand store** with three slices. Do not create new store files.

```ts
import { useAppStore } from '@/store/appStore';
```

### Three Slices

| Slice       | Key Fields                                                                                                                 | Purpose                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `AuthSlice` | `isLocked`, `biometricsEnabled`, `pinEnabled`, `userProfile`                                                               | Auth & biometric lock state |
| `UISlice`   | `isLoading`, `theme`, `notificationPreferences`, `selectedMonth`                                                           | UI preferences & loading    |
| `DataSlice` | `accounts`, `categories`, `budgets`, `goals`, `dashboardStats`, `dataRevision`, `syncInProgress`, `isOnline`, `smsEnabled` | Cached data + sync state    |

---

## Reading State — Always Select Specific Slices

```ts
// CORRECT — minimal re-renders (selector per field)
const dataRevision = useAppStore((s) => s.dataRevision);
const accounts = useAppStore((s) => s.accounts);
const theme = useAppStore((s) => s.theme);
const { colors } = useTheme(); // for colors — use useTheme(), not the store

// WRONG — causes re-render on any state change in the store
const store = useAppStore(); // ❌ full store subscription
const { dataRevision, accounts } = useAppStore(); // ❌ destructured without selector
```

---

## `dataRevision` — The Screen Refresh Trigger

`dataRevision` is a counter incremented by `bumpDataRevision()` after every write.
All screens that display data must subscribe to it and re-fetch when it changes.

```tsx
// In a screen component:
const dataRevision = useAppStore((s) => s.dataRevision);

const fetchData = useCallback(async () => {
  const db = getDatabase();
  const rows = await db.getAllAsync<Item>('SELECT * FROM items WHERE deletedAt IS NULL', []);
  setItems(rows);
}, []); // deps only change if you add filterable inputs

useEffect(() => {
  void fetchData();
}, [fetchData, dataRevision]); // re-fetches after every write
```

---

## Triggering Re-Fetch After a Write (Outside Components)

```ts
// In service functions — after every write
useAppStore.getState().bumpDataRevision();

// WRONG — cannot call the hook outside a component
const { bumpDataRevision } = useAppStore(); // ❌ inside a service/util file
```

---

## What Belongs in the Store vs SQLite

| State type                                          | Where                              |
| --------------------------------------------------- | ---------------------------------- |
| Local SQLite data (transactions, budgets, etc.)     | SQLite → fetched locally on demand |
| Cached list for quick access (accounts, categories) | `DataSlice` in store               |
| UI state (selected month, loading flags, theme)     | `UISlice` in store                 |
| Auth state (lock, biometrics, user profile)         | `AuthSlice` in store               |
| Sync status (online, in-progress, last synced)      | `DataSlice` in store               |

---

## What Does NOT Belong in the Store

- Full transaction lists — query SQLite with `dataRevision` trigger instead
- Async DB operations — service layer handles these; store only holds results
- Supabase auth session — use `supabase.auth.getSession()` or the auth service
- Form state — local `useState` in the component

---

## `async` in `useEffect` — Must Use `useCallback`

ESLint `exhaustive-deps` requires async functions in effect deps to be wrapped in `useCallback`:

```ts
// CORRECT
const fetchData = useCallback(async () => {
  // ...
}, [dep1, dep2]);

useEffect(() => {
  void fetchData(); // use void — not return or await
}, [fetchData, dataRevision]);

// WRONG — ESLint error: async function directly in useEffect
useEffect(() => {
  const load = async () => { ... };
  load(); // ❌ violates exhaustive-deps rule
}, [dataRevision]);
```

---

## Fire-and-Forget — `.catch(console.warn)`

```ts
// CORRECT — fire and forget
triggerBackgroundSync('reason').catch(console.warn);

// WRONG
void triggerBackgroundSync('reason'); // ❌ use .catch instead
await triggerBackgroundSync('reason'); // ❌ don't await unless you need the result
```
