# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Documentation architecture: CONTRIBUTING.md, SECURITY.md, CHANGELOG.md
- Developer onboarding guide (`docs/onboarding.md`)
- Architecture Decision Records (`docs/adr/`)
- Operational runbooks (`docs/runbooks/`)
- PR and issue templates (`.github/`)
- CODEOWNERS file

### Fixed

- Theme hardcoded `#fff` replaced with `colors.textInverse` in badge components
- Transaction date format uses `YYYY-MM-DD` instead of full ISO string
- Notification badge race condition between mount reset and async build
- Widget timeout handler properly cleans up with `clearTimeout`
- Schema drift between SQLite and Supabase (notes.id type, recurring_templates.user_id nullability)
- Duplicate RLS policies consolidated on notes table
- Migration safety for `handle_updated_at` function

### Removed

- Unused `cancelLabel` from PopupOptions interface

## [1.0.0] - 2025-03-01

### Added

- Core transaction management (income, expense, transfer)
- Multi-account support (bank, wallet, UPI, credit card)
- Budget tracking with per-category limits
- Savings goals with progress tracking
- Split expense management
- SMS transaction import (Android)
- Notes/journal feature
- Push notifications
- Offline-first architecture with SQLite
- Supabase sync with conflict resolution
- Android home screen widgets (5 widgets)
- Email report export (PDF)
- CSV/JSON data export
- Dark mode support
- Firebase Analytics integration
