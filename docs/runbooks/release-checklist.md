# Release Checklist

Use this checklist for every production release.

---

> This doc reference only

## Pre-Release

- [ ] All PRs for this release are merged to `master`
- [ ] `yarn typecheck` passes with 0 errors
- [ ] `yarn lint` passes with 0 warnings
- [ ] Manual QA on physical Android device:
  - [ ] Fresh install flow (signup → first transaction → budget → goal)
  - [ ] Upgrade flow (install over previous version, verify data preserved)
  - [ ] Offline mode (airplane mode → add/edit/delete transactions → reconnect → verify sync)
  - [ ] Widget rendering after app update
- [ ] Supabase migrations applied to production:
  - [ ] Check `supabase/migrations/` for any unapplied migrations
  - [ ] Run against staging first, verify no data loss
  - [ ] Apply to production
- [ ] Version bumped in `app.json` (both `version` and `android.versionCode`)

## Build & Submit

- [ ] Run EAS build: `eas build --platform android --profile production`
- [ ] Download APK/AAB and test on physical device
- [ ] Submit to Google Play: `eas submit --platform android`

## Post-Release

- [ ] Verify the new version is live on Google Play
- [ ] Monitor crash reports (first 24 hours)
- [ ] Verify sync is working for updated users
- [ ] Update `CHANGELOG.md` with the release notes
- [ ] Tag the release: `git tag v1.x.x && git push --tags`

## Rollback Plan

If a critical issue is found after release:

1. Revert the problematic commit(s) on `master`
2. Bump version again and rebuild
3. Submit hotfix to Google Play with expedited review
4. If Supabase migration caused the issue, apply a corrective migration (never rollback migrations)
