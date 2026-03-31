# ADR-001: Offline-First Architecture with SQLite

## Status

Accepted

## Date

2025-01-15

## Context

Hisab Kitab is a personal finance app targeting users in India who frequently experience unreliable internet connectivity. The app must be fully functional without any network connection and seamlessly sync data when connectivity is restored.

### Options Considered

1. **Online-only (Supabase direct)**: Simplest implementation, but unusable offline.
2. **Cache-first (React Query + Supabase)**: Good read performance, but writes fail offline.
3. **Offline-first (SQLite + background sync)**: Full functionality offline, more complex sync logic.

## Decision

We chose **Option 3: Offline-first with SQLite as the source of truth**.

- All reads and writes go to the local SQLite database first.
- A sync queue (`enqueueSync()`) records every write operation.
- A background sync engine pushes queued changes to Supabase when connectivity is available.
- Conflict resolution uses `updatedAt` timestamps (last-write-wins).

## Consequences

### Positive

- App is fully functional without internet
- Instant UI responsiveness (no network latency on reads/writes)
- Natural fit for the `dataRevision` pattern — screens re-fetch from SQLite on change

### Negative

- Sync logic is complex and must handle edge cases (conflicts, schema drift)
- Two schemas to maintain: SQLite (camelCase) and Supabase/PostgreSQL (snake_case)
- `syncTransform.ts` is required to map between column naming conventions
- Data can diverge between devices until sync completes

### Mitigation

- `syncTransform.ts` centralizes all column mapping
- Migration system (`MigrationRunner.ts`) handles schema evolution
- Audit tests verify schema alignment between SQLite and Supabase

## References

- [ARCHITECTURE.md](/ARCHITECTURE.md) — Full data layer documentation
- `src/database/index.ts` — SQLite schema definition
- `src/services/syncService.ts` — Sync engine implementation
- `src/services/syncTransform.ts` — Column name mapping
