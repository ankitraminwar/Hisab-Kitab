---
name: 'Firebase Analytics Instructions'
description: 'Rules for Firebase Analytics usage across all files'
applyTo: 'src/services/analytics.ts,src/screens/**/*.tsx,app/**/*.tsx'
---

# Firebase Analytics — Hisab Kitab

## Overview

Hisab Kitab uses **Firebase Analytics** (`@react-native-firebase/analytics`) for
lightweight, privacy-respecting usage tracking. Firebase Analytics replaces any
other crash/analytics SDK and is the **only** analytics provider in the project.

---

## Setup Requirements

1. **Android**: Place `google-services.json` in the project root (referenced by `app.json` → `android.googleServicesFile`).
2. **iOS**: Place `GoogleService-Info.plist` in the project root and reference it via `ios.googleServicesFile` in `app.json` when iOS support is added.
3. **Config plugins** are already registered in `app.json`:
   - `@react-native-firebase/app`
   - `@react-native-firebase/analytics`

---

## Analytics Service — Single Import

```ts
import { Analytics } from '@/services/analytics';

// CORRECT — always use the service wrapper
await Analytics.logEvent('transaction_created', { type: 'expense', amount: 500 });
await Analytics.logScreenView('DashboardScreen');
await Analytics.setUserId(user.id);

// WRONG — never import firebase analytics directly in screens
import analytics from '@react-native-firebase/analytics'; // ❌ use Analytics service
```

---

## Standard Events

| Event Name            | When to Log                         | Params                                    |
| --------------------- | ----------------------------------- | ----------------------------------------- |
| `screen_view`         | Screen mount (via `logScreenView`)  | `screen_name`                             |
| `transaction_created` | After successful transaction create | `type`, `amount`, `category_id`           |
| `transaction_deleted` | After soft delete                   | `type`                                    |
| `budget_created`      | After budget creation               | `category_id`, `limit_amount`             |
| `goal_created`        | After goal creation                 | `target_amount`                           |
| `goal_funded`         | After adding funds to a goal        | `amount`                                  |
| `sync_completed`      | After successful background sync    | `items_synced`                            |
| `sms_imported`        | After SMS import batch              | `count`                                   |
| `login`               | After successful authentication     | `method` (`email`, `google`, `biometric`) |
| `logout`              | After sign out                      | —                                         |
| `note_created`        | After note creation                 | —                                         |
| `split_created`       | After split expense creation        | `split_method`, `member_count`            |

---

## User Properties

Set these after login / profile update:

```ts
await Analytics.setUserProperty('currency', 'INR');
await Analytics.setUserProperty('theme', 'dark');
```

---

## Privacy Rules

- **Never** log PII (names, emails, phone numbers, account numbers) in event params.
- **Never** log raw transaction amounts above summary level — use ranges if needed.
- **Never** log merchant names or note content.
- Analytics collection can be disabled by the user in settings (future feature).

---

## Testing

- Use Firebase DebugView to verify events in development.
- Enable debug mode on Android: `adb shell setprop debug.firebase.analytics.app com.hisabkitab.app`
- Disable in tests by mocking `@react-native-firebase/analytics`.
