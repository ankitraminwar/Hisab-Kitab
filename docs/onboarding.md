# Onboarding Guide — Hisab Kitab

> Goal: Go from zero to your first PR in under 2 hours.

---

## Prerequisites

- **Node.js** ≥ 18 (LTS)
- **Yarn** (package manager)
- **Android Studio** with an emulator (or a physical Android device with USB debugging)
- **VS Code** with the GitHub Copilot extension
- Git configured with your GitHub account

---

## Step 1: Clone & Install (5 min)

```bash
git clone https://github.com/ankitraminwar/Hisab-Kitab.git
cd Hisab-Kitab
yarn install
```

## Step 2: Environment Setup (5 min)

```bash
cp .env.example .env
```

Fill in the two required values (ask the team lead for credentials):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

`app.config.js` reads these values and exposes them to the app through
`Constants.expoConfig.extra.publicEnv`.

## Step 3: Run the App (5 min)

```bash
yarn android       # Launches on connected device or emulator
```

The app works fully offline. You can add transactions, budgets, and goals without Supabase connectivity.

## Step 4: Verify Your Setup (2 min)

```bash
yarn typecheck     # Must show 0 errors
yarn lint          # Must show 0 warnings
```

Both must pass before any PR can be submitted.

---

## Understanding the Codebase

### Recommended Reading Order

| Order | Document                            | Time   | What You'll Learn                                   |
| ----- | ----------------------------------- | ------ | --------------------------------------------------- |
| 1     | [README.md](/README.md)             | 5 min  | Features, stack, project structure                  |
| 2     | This file                           | 10 min | Setup and workflow                                  |
| 3     | [ARCHITECTURE.md](/ARCHITECTURE.md) | 20 min | Data layer, sync, state management                  |
| 4     | [AGENT_SOP.md](/AGENT_SOP.md)       | 15 min | Code patterns, conventions, hard rules              |
| 5     | [AI_CONTEXT.md](/AI_CONTEXT.md)     | Skim   | Full reference (use as lookup, not sequential read) |

### Key Concepts

| Concept           | Summary                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| **Offline-first** | SQLite is the source of truth. Every write goes to SQLite first, then queued for Supabase sync.       |
| **dataRevision**  | A Zustand counter that increments on every write. Screens `useEffect` on it to re-fetch data.         |
| **Sync Queue**    | Writes → `enqueueSync()` → background push to Supabase. Conflict resolution: latest `updatedAt` wins. |
| **Theme System**  | `useTheme()` hook returns `colors` object. Never hardcode hex values.                                 |
| **Soft Deletes**  | `deletedAt` column — never use `DELETE FROM`. Always `UPDATE SET deletedAt = ?`.                      |

### Project Structure (Key Files)

```
src/
├── database/index.ts       ← SQLite schema + enqueueSync()
├── store/appStore.ts        ← Single Zustand store (3 slices)
├── services/                ← Business logic (1 service per domain)
├── screens/                 ← Screen implementations (1 file per screen)
├── components/common/       ← Shared UI components (Card, Button, FAB, etc.)
├── hooks/useTheme.ts        ← Theme colors and dark mode
└── utils/types.ts           ← ALL TypeScript types (single source of truth)
```

---

## Development Workflow

### Branch Strategy

```
master (protected)
  └── feature/your-feature-name
  └── fix/bug-description
  └── chore/task-description
```

- `master` requires a PR with at least 1 approval
- Owner can merge without approval
- Always branch from latest `master`

### Making Changes

1. **Create a branch**: `git checkout -b feature/your-feature`
2. **Make changes** following the instruction files in `.github/instructions/`
3. **Test locally**: `yarn android` and verify the feature works
4. **Check quality**: `yarn typecheck && yarn lint`
5. **Commit**: Use [Conventional Commits](https://www.conventionalcommits.org/)
   - `feat:` new feature
   - `fix:` bug fix
   - `chore:` maintenance
   - `docs:` documentation only
6. **Push & create PR**

### Copilot Integration

The project has 7 instruction files in `.github/instructions/` that automatically load for relevant files. Copilot will enforce:

- Screen structure patterns
- Database access rules
- Service write patterns
- Type conventions
- Sync queue usage
- Analytics event standards
- Zustand store rules

---

## Common Tasks

### Add a New Screen

1. Create screen file: `src/screens/yourFeature/YourScreen.tsx`
2. Create route file: `app/your-route.tsx` (imports the screen with `React.lazy`)
3. Follow the mandatory screen template in `.github/instructions/components.instructions.md`

### Add a New Service Function

1. Add to existing service in `src/services/` or create new `*Service.ts`
2. Follow the 4-step write pattern: Write → Sync → Revision → Background push
3. See `.github/instructions/services.instructions.md`

### Add a New Database Table

1. Add `CREATE TABLE` in `src/database/index.ts`
2. Add Supabase table in `supabase/schema.sql`
3. Add column mapping in `src/services/syncTransform.ts`
4. Add types in `src/utils/types.ts`
5. Add migration if the table needs to be created on existing installs

---

## Getting Help

- Check `AI_CONTEXT.md` for comprehensive reference
- Check `AGENT_SOP.md` for code patterns and examples
- Ask in the team channel
