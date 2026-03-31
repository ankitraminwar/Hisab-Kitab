# Contributing to Hisab Kitab

Thank you for your interest in contributing! This guide will help you get started.

---

## Quick Start

1. Fork and clone the repository
2. Follow the [Onboarding Guide](docs/onboarding.md) for setup
3. Create a feature branch from `master`
4. Make your changes
5. Submit a PR

## Development Setup

```bash
git clone https://github.com/ankitraminwar/Hisab-Kitab.git
cd Hisab-Kitab
yarn install
cp .env.example .env   # Fill in Supabase credentials
yarn android
```

## Branch Naming

```
feature/short-description
fix/bug-description
chore/task-description
docs/what-changed
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add budget rollover support
fix: correct date format in transaction export
chore: update expo-sqlite to v16
docs: add sync troubleshooting runbook
```

## Code Standards

### Must-Follow Rules

These are enforced by the instruction files in `.github/instructions/`:

- **Types**: All types go in `src/utils/types.ts` — never define inline or in screen files
- **Theme**: Use `useTheme()` hook — never hardcode hex colors
- **Database writes**: Always follow the 4-step pattern: Write → Sync → Revision → Background push
- **Soft deletes**: Set `deletedAt` — never use `DELETE FROM`
- **Services**: One file per domain in `src/services/`. No database calls in screen files.
- **Screen structure**: Follow the mandatory template (see `components.instructions.md`)

### TypeScript

```bash
yarn typecheck    # Must pass with 0 errors
```

### Linting

```bash
yarn lint         # Must pass with 0 warnings
```

## Pull Request Process

1. Ensure `yarn typecheck` and `yarn lint` pass
2. Test your changes on an Android device or emulator
3. Fill out the PR template completely
4. Request review from a maintainer
5. Address any Copilot review comments
6. Once approved, the maintainer will merge

### PR Size Guidelines

- Prefer small, focused PRs (~200-400 lines)
- One feature or fix per PR
- If a change is large, break it into stacked PRs

## Adding New Features

### New Screen

1. Screen component: `src/screens/feature/FeatureScreen.tsx`
2. Route file: `app/feature.tsx` or `app/(tabs)/feature.tsx`
3. Follow the screen template from `components.instructions.md`

### New Service

1. Create `src/services/featureService.ts`
2. Follow the database write pattern from `services.instructions.md`
3. Add types to `src/utils/types.ts`

### New Database Table

1. SQLite schema: `src/database/index.ts`
2. Supabase schema: `supabase/schema.sql`
3. Column mapping: `src/services/syncTransform.ts`
4. Migration: `src/services/MigrationRunner.ts`
5. Supabase migration: `supabase/migrations/`
6. Types: `src/utils/types.ts`

## Reporting Issues

- Use the bug report template for bugs
- Use the feature request template for new ideas
- Include reproduction steps and device info for bugs

## Questions?

Open a Discussion on GitHub or reach out to the maintainers.
