# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅ Active |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues by emailing the maintainer directly. Include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You will receive an acknowledgment within 48 hours and a detailed response within 5 business days.

## Security Practices

### Authentication

- Supabase Auth handles all authentication (email/password)
- JWTs are managed by the Supabase client library
- Tokens are stored securely in device storage via `expo-secure-store`

### Data Protection

- All user data is isolated by `userId` via Supabase Row Level Security (RLS)
- Every table has RLS policies ensuring users can only access their own data
- SQLite database is local to the device and not shared between apps

### Network Security

- All Supabase communication uses HTTPS
- The Supabase anon key is safe to include in client code (RLS enforces access control)
- Edge Functions validate auth tokens before processing

### Dependency Management

- Dependencies are reviewed before upgrading
- `yarn audit` should be run periodically to check for known vulnerabilities
