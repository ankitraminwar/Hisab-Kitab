# Documentation Architecture — Hisab Kitab

> This document defines the documentation strategy, folder structure, naming conventions, and maintenance rules for the Hisab Kitab project.

---

## 1. Strategy: Hybrid (Centralized Root + Modular Conventions)

| Layer                  | Location                         | Purpose                                       | Audience                      |
| ---------------------- | -------------------------------- | --------------------------------------------- | ----------------------------- |
| **Root Docs**          | `/*.md`                          | Project-wide: setup, architecture, deployment | Developers, PMs, Stakeholders |
| **AI Context**         | `/AI_CONTEXT.md`, `AGENT_SOP.md` | Machine-readable codebase reference           | AI coding agents              |
| **Convention Rules**   | `.github/instructions/*.md`      | Enforced coding standards (per-domain)        | Copilot, developers           |
| **Process Guides**     | `docs/`                          | Onboarding, SOPs, ADRs, runbooks              | Team members                  |
| **PR/Issue Templates** | `.github/`                       | Standardized contribution workflows           | All contributors              |

### Why Hybrid?

- **Root docs** give every developer a single entry point (README → everything else).
- **`.github/instructions/`** are modular by design — Copilot only loads what's relevant via `applyTo` globs.
- **`docs/`** houses living process documents that change independently of code.
- No feature-level READMEs inside `src/` — the screens/services are self-documenting via TypeScript + instruction files. Adding per-feature docs would create stale duplication.

---

## 2. Proposed Folder Structure

```
Hisab-Kitab/
│
├── README.md                          # Project overview, setup, quick start
├── ARCHITECTURE.md                    # Technical deep-dive (data layer, sync, state)
├── AI_CONTEXT.md                      # AI agent reference (hard rules, patterns)
├── AGENT_SOP.md                       # AI agent standard operating procedures
├── PRODUCT_FEATURES.md                # Product requirements & user flows
├── DEPLOYMENT.md                      # Build, release, EAS, app store submission
├── SUPABASE_SETUP.md                  # Backend provisioning & configuration
├── CHANGELOG.md                       # NEW — Version history (keep-a-changelog format)
├── CONTRIBUTING.md                    # NEW — How to contribute
├── SECURITY.md                        # NEW — Vulnerability reporting policy
├── LICENSE                            # NEW — License file
│
├── docs/                              # NEW — Process & reference documentation
│   ├── onboarding.md                  # NEW — Day-1 developer guide
│   ├── adr/                           # NEW — Architecture Decision Records
│   │   └── 001-offline-first.md       # Example ADR
│   ├── runbooks/                      # NEW — Operational procedures
│   │   ├── sync-troubleshooting.md    # Sync debugging guide
│   │   └── release-checklist.md       # Pre-release verification steps
│   └── api/                           # NEW — Service API reference
│       └── supabase-functions.md      # Edge functions documentation
│
├── .github/
│   ├── instructions/                  # Copilot convention files (KEEP AS-IS)
│   │   ├── analytics.instructions.md
│   │   ├── components.instructions.md
│   │   ├── db.instructions.md
│   │   ├── services.instructions.md
│   │   ├── store.instructions.md
│   │   ├── sync.instructions.md
│   │   └── types.instructions.md
│   ├── PULL_REQUEST_TEMPLATE.md       # NEW — PR template
│   ├── ISSUE_TEMPLATE/                # NEW — Issue templates
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── config.yml
│   └── CODEOWNERS                     # NEW — Auto-assign reviewers
│
│
├── src/                               # Source code (NO changes to structure)
├── app/                               # Expo Router (NO changes)
├── supabase/                          # Backend (NO changes)
└── android/                           # Native Android (NO changes)
```

### What Stays, Moves, or Gets Created

| Action     | File(s)                                                                                   | Reason                                          |
| ---------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **KEEP**   | README, ARCHITECTURE, AI_CONTEXT, AGENT_SOP, PRODUCT_FEATURES, DEPLOYMENT, SUPABASE_SETUP | Active root docs — well-maintained              |
| **KEEP**   | `.github/instructions/*`                                                                  | Modular Copilot conventions — working correctly |
| **CREATE** | CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, LICENSE                                       | Industry-standard community files               |
| **CREATE** | docs/onboarding.md, docs/adr/, docs/runbooks/                                             | Process docs for growing team                   |
| **CREATE** | .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/                                 | Standardized contribution workflows             |
| **CREATE** | .github/CODEOWNERS                                                                        | Auto-assign code reviewers by path              |

---

## 3. File Naming Conventions

| Type            | Convention                                                             | Example                                                    |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Root docs       | `UPPER_SNAKE.md`                                                       | `CONTRIBUTING.md`, `SECURITY.md`                           |
| Process docs    | `kebab-case.md`                                                        | `docs/onboarding.md`, `docs/runbooks/release-checklist.md` |
| ADRs            | `NNN-kebab-title.md`                                                   | `docs/adr/001-offline-first.md`                            |
| Instructions    | `domain.instructions.md`                                               | `.github/instructions/sync.instructions.md`                |
| Issue templates | `snake_case.md`                                                        | `.github/ISSUE_TEMPLATE/bug_report.md`                     |
| Source code     | `PascalCase.tsx` (screens/components), `camelCase.ts` (services/utils) | Existing — no change                                       |

---

## 4. README Structure Standard

### Root README.md (existing — good, minor improvements)

```markdown
# Project Name

> One-line description with version

## Features (bullet list)

## Stack (table)

## Quick Start (3–5 steps)

## Project Structure (tree)

## Scripts (table)

## Documentation Map (links to all docs)

## Contributing (link to CONTRIBUTING.md)

## License
```

### Feature/Module README (NOT recommended for this project)

Source files are self-documenting via TypeScript types + `.github/instructions/` convention files. Adding per-module READMEs creates stale duplication. Instead, use `docs/onboarding.md` as the guided walkthrough.

---

## 5. When to Create Separate Docs vs Consolidate

| Scenario                    | Action                                       | Example                                         |
| --------------------------- | -------------------------------------------- | ----------------------------------------------- |
| New coding convention       | Add to existing `.github/instructions/` file | New DB rule → `db.instructions.md`              |
| New domain instruction file | Create new instruction file                  | Navigation rules → `navigation.instructions.md` |
| Architecture decision       | Create ADR in `docs/adr/`                    | Switching from Zustand to Jotai                 |
| Operational procedure       | Create runbook in `docs/runbooks/`           | "How to debug sync failures"                    |
| AI context update           | Update `AI_CONTEXT.md` directly              | New screen, new service                         |
| Product feature spec        | Update `PRODUCT_FEATURES.md`                 | New feature description                         |

---

## 6. Versioning & Maintenance Rules

1. **CHANGELOG.md** follows [Keep a Changelog](https://keepachangelog.com/) format with `[Unreleased]` section at top.
2. **Every PR** that changes user-facing behavior must update `CHANGELOG.md`.
3. **AI_CONTEXT.md** and **AGENT_SOP.md** are updated whenever a new screen, service, or table is added.
4. **`.github/instructions/`** files are updated when a coding convention changes.
5. **ADRs** are immutable once accepted — superseded ADRs get a `Status: Superseded by ADR-NNN` header.
6. **Root README** version badge is bumped on every release tag.

---

## 7. Best Practices

### Writing Consistent Documentation

- Use present tense, imperative mood ("Add the dependency", not "You should add")
- Code examples must be copy-pasteable and tested
- Every rule must have a "why" — no arbitrary conventions
- Tables over prose for reference material
- Links over duplication — reference other docs, don't repeat content

### Onboarding Optimization

- New developer reads: README → docs/onboarding.md → ARCHITECTURE.md → AGENT_SOP.md
- Time to first PR target: < 2 hours
- `docs/onboarding.md` includes: env setup, run app, make a change, submit PR

### AI Agent Optimization

- `AI_CONTEXT.md` is the **single entry point** for any AI agent
- `.github/instructions/` provide **scoped rules** that auto-load per file type
- `AGENT_SOP.md` provides **workflow patterns** (create screen, add service, write migration)
- Never put rules in comments inside source code — use instruction files instead
