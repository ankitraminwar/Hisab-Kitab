import { getAnalytics } from '@react-native-firebase/analytics';
import { getCrashlytics } from '@react-native-firebase/crashlytics';

/**
 * Thin wrapper around Firebase Analytics.
 * All event logging goes through this service so we have a single
 * place to disable/mock analytics in dev or testing.
 *
 * All methods silently no-op if Firebase is not configured (e.g. placeholder
 * google-services.json) so a missing real Firebase project never crashes the app.
 */

export const Analytics = {
  /** Log a screen view. Call from useEffect in screen components. */
  async logScreenView(screenName: string) {
    try {
      await getAnalytics().logScreenView({ screen_name: screenName, screen_class: screenName });
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Log a custom event with optional params. */
  async logEvent(name: string, params?: Record<string, string | number | boolean>) {
    try {
      await getAnalytics().logEvent(name, params);
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Set the current user ID (after login). Pass null on logout. */
  async setUserId(userId: string | null) {
    try {
      await getAnalytics().setUserId(userId);
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Set a user property (e.g. theme preference, currency). */
  async setUserProperty(name: string, value: string) {
    try {
      await getAnalytics().setUserProperty(name, value);
    } catch {
      // Firebase not configured — silently ignore
    }
  },
} as const;

/**
 * Thin wrapper around Firebase Crashlytics.
 * All methods silently no-op if Firebase is not configured so a missing
 * real Firebase project never crashes the app.
 */
export const Crashlytics = {
  /** Record a JS error with an optional context label. */
  recordError(error: Error, label?: string) {
    try {
      getCrashlytics().recordError(error, label);
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Associate the current user ID with crash reports. Pass null on logout. */
  async setUserId(userId: string | null) {
    try {
      await getCrashlytics().setUserId(userId ?? '');
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Log a breadcrumb message visible in the crash report. */
  log(message: string) {
    try {
      getCrashlytics().log(message);
    } catch {
      // Firebase not configured — silently ignore
    }
  },

  /** Set a custom key/value string visible in crash reports. */
  setAttribute(key: string, value: string) {
    try {
      getCrashlytics().setAttribute(key, value);
    } catch {
      // Firebase not configured — silently ignore
    }
  },
} as const;
