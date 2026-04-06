import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  LogBox,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { PopupProvider } from '../src/components/common/PopupProvider';
import { ScreenErrorBoundary } from '../src/components/common/ScreenErrorBoundary';
import { AppToast } from '../src/components/common/Toast';

import {
  clearLocalData,
  getLastSyncTimestamp,
  hasLocalUserData,
  initializeDatabase,
} from '@/database';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { queryClient } from '@/lib/queryClient';
import { setSupabaseAutoRefreshEnabled } from '@/lib/supabase';
import {
  authService,
  authenticateBiometric,
  getBiometricPreference,
  getBiometricPrompted,
} from '@/services/auth';
import { UserProfileService } from '@/services/dataServices';
import { applyNotificationPreferences } from '@/services/notifications';
import { syncService } from '@/services/syncService';
import { useAppStore } from '@/store/appStore';
import { SPACING, TYPOGRAPHY } from '@/utils/constants';
import { logger } from '@/utils/logger';

// Suppress the expo-keep-awake warning that fires in dev mode
LogBox.ignoreLogs(['Unable to activate keep awake']);

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
const previousGlobalHandler = errorUtils?.getGlobalHandler?.();

errorUtils?.setGlobalHandler?.((error, isFatal) => {
  const errorMessage = String(error?.message ?? error ?? '');
  const normalizedError =
    error instanceof Error ? error : new Error(errorMessage || 'Unknown JS error');

  try {
    if (errorMessage.includes('Unable to activate keep awake')) {
      return;
    }

    logger.error('GlobalError', `${isFatal ? 'FATAL: ' : ''}${normalizedError.message}`);

    previousGlobalHandler?.(normalizedError, isFatal);
  } catch (handlerError) {
    logger.warn('RootLayout', 'Global error handler failed', handlerError);
    previousGlobalHandler?.(normalizedError, isFatal);
  }
});

// Catch unhandled promise rejections so they don't disappear silently
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event?.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
    logger.error('UnhandledRejection', message);
  });
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const previousSessionRef = useRef<Session | null>(null);
  const isLocked = useAppStore((s) => s.isLocked);
  const setLocked = useAppStore((s) => s.setLocked);
  const biometricsEnabled = useAppStore((s) => s.biometricsEnabled);
  const setBiometrics = useAppStore((s) => s.setBiometrics);
  const setBiometricsPromptedState = useAppStore((s) => s.setBiometricsPrompted);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const setNotificationPreferences = useAppStore((s) => s.setNotificationPreferences);
  const resetAppState = useAppStore((s) => s.resetAppState);
  const [initializing, setInitializing] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [bootstrapNonce, setBootstrapNonce] = useState(0);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Show slow-load message after 3s
  useEffect(() => {
    if (!initializing) return;
    const t = setTimeout(() => setSlowLoad(true), 3000);
    return () => clearTimeout(t);
  }, [initializing]);

  useEffect(() => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
    let cancelled = false;
    let syncStartTimer: ReturnType<typeof setTimeout> | undefined;

    const hydrateAuthenticatedSession = async (nextSession: Session, reason: string) => {
      try {
        const lastSyncAt = await getLastSyncTimestamp();
        const shouldRunInitialSync = !lastSyncAt || !(await hasLocalUserData(nextSession.user.id));
        if (shouldRunInitialSync) {
          await syncService.initialSync();
        } else {
          await syncService.sync(reason);
        }

        const syncedProfile = await UserProfileService.getProfile();
        if (syncedProfile) {
          setTheme(syncedProfile.themePreference);
          setUserProfile(syncedProfile);
        }
      } catch (error) {
        logger.warn('RootLayout', 'Session hydration failed', error);
      }
    };

    const bootstrap = async () => {
      try {
        if (!cancelled) {
          setStartupError(null);
          setSlowLoad(false);
        }

        // Finding 14: Rapid theme hydration to prevent bootstrap flash
        const persistedTheme = await withTimeout(
          SecureStore.getItemAsync('theme_pref'),
          5000,
          null,
        );
        if (
          persistedTheme &&
          (persistedTheme === 'dark' || persistedTheme === 'light' || persistedTheme === 'system')
        ) {
          setTheme(persistedTheme);
        }

        await initializeDatabase();
        const currentSession = await withTimeout(authService.getSession(), 5000, {
          data: { session: null },
          error: null,
        });
        const nextSession = currentSession.data.session ?? null;
        setSession(nextSession);
        previousSessionRef.current = nextSession;

        const [biometricPreference, prompted, profile] = await Promise.all([
          getBiometricPreference(),
          getBiometricPrompted(),
          UserProfileService.getProfile(),
        ]);

        if (profile) {
          setTheme(profile.themePreference);
          setUserProfile(profile);
          setNotificationPreferences({
            enabled: profile.notificationsEnabled,
            dailyReminder: profile.notificationsEnabled,
            budgetAlerts: true,
            monthlyReportReminder: true,
          });
          try {
            await applyNotificationPreferences({
              enabled: profile.notificationsEnabled,
              dailyReminder: profile.notificationsEnabled,
              budgetAlerts: true,
              monthlyReportReminder: true,
            });
          } catch (notificationError) {
            logger.warn(
              'RootLayout',
              'Failed to apply notification preferences during bootstrap',
              notificationError,
            );
          }
        } else {
          setUserProfile(null);
          setTheme('system');
        }

        setBiometrics(biometricPreference);
        setBiometricsPromptedState(prompted);
        setLocked(Boolean(nextSession) && biometricPreference);
        syncStartTimer = setTimeout(() => {
          syncService.start();
        }, 1000);

        if (nextSession) {
          hydrateAuthenticatedSession(nextSession, 'app-start').catch((e) =>
            logger.warn('RootLayout', 'Hydration failed on app-start', e),
          );
        }
      } catch (error) {
        logger.warn('RootLayout', 'Bootstrap failed, staying on the startup screen', error);
        if (!cancelled) {
          setLocked(false);
          setStartupError(
            error instanceof Error && error.message
              ? error.message
              : 'The app could not finish starting.',
          );
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void bootstrap();

    const subscription = authService.onAuthStateChange(async (_event, nextSession) => {
      const previousSession = previousSessionRef.current;
      previousSessionRef.current = nextSession;
      setSession(nextSession);

      if (!nextSession && previousSession) {
        syncService.stop();
        try {
          await clearLocalData();
        } catch (err) {
          logger.error('RootLayout', 'clearLocalData failed on logout, continuing', err);
        }
        queryClient.clear();
        resetAppState();
        setLocked(false);
        router.replace('/login');
        return;
      }

      if (nextSession) {
        setLocked(useAppStore.getState().biometricsEnabled);
        hydrateAuthenticatedSession(
          nextSession,
          previousSession ? 'auth-state-change' : 'login-hydration',
        ).catch((e) => logger.warn('RootLayout', 'Hydration failed on auth-state-change', e));
      }
    });

    return () => {
      cancelled = true;
      if (syncStartTimer) {
        clearTimeout(syncStartTimer);
      }
      subscription.data.subscription.unsubscribe();
      syncService.stop();
    };
  }, [
    bootstrapNonce,
    resetAppState,
    router,
    setBiometrics,
    setBiometricsPromptedState,
    setLocked,
    setNotificationPreferences,
    setTheme,
    setUserProfile,
  ]);

  useEffect(() => {
    let appState = AppState.currentState;
    let networkReachable = false;

    const syncAutoRefreshState = async () => {
      const shouldRefresh = Boolean(session) && appState === 'active' && networkReachable;
      await setSupabaseAutoRefreshEnabled(shouldRefresh);
    };

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      appState = nextState;
      void syncAutoRefreshState();
    });

    const networkUnsubscribe = NetInfo.addEventListener((state) => {
      networkReachable = Boolean(state.isConnected && state.isInternetReachable);
      void syncAutoRefreshState();
    });

    void syncAutoRefreshState();

    return () => {
      appStateSubscription.remove();
      networkUnsubscribe();
      void setSupabaseAutoRefreshEnabled(false);
    };
  }, [session]);

  useEffect(() => {
    if (initializing || startupError) {
      return;
    }

    const inAuthFlow = segments[0] === 'auth' || segments[0] === 'login';
    if (!session && !inAuthFlow && segments.length > 0) {
      router.replace('/login');
      return;
    }

    if (session && inAuthFlow) {
      router.replace('/');
    }
  }, [initializing, router, segments, session, startupError]);

  // Block hardware back button while biometric lock screen is shown
  useEffect(() => {
    if (!(session && isLocked && biometricsEnabled)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [session, isLocked, biometricsEnabled]);

  const handleAuthenticate = async () => {
    try {
      const success = await authenticateBiometric();
      if (success || !biometricsEnabled) {
        setLocked(false);
      }
    } catch {
      setLocked(false);
    }
  };

  const handleRetryBootstrap = () => {
    setSession(null);
    setStartupError(null);
    setSlowLoad(false);
    setInitializing(true);
    setBootstrapNonce((current) => current + 1);
  };

  if (initializing) {
    return (
      <View style={styles.lockContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl }}>
          <Text style={[styles.title, { fontSize: 32 }]}>Hisab Kitab</Text>
          <Ionicons name="wallet" size={32} color={colors.primary} style={{ marginLeft: 12 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
        {slowLoad && (
          <Text style={styles.loadingSubtext}>Taking longer than usual. Please wait...</Text>
        )}
      </View>
    );
  }

  if (startupError) {
    return (
      <View style={styles.lockContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="warning-outline" size={40} color={colors.warning} />
        </View>
        <Text style={styles.title}>Startup Issue</Text>
        <Text style={styles.subtitle}>The app could not finish starting safely.</Text>
        <Text style={styles.loadingSubtext}>{startupError}</Text>
        <TouchableOpacity style={styles.unlockButton} onPress={handleRetryBootstrap}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
          <Text style={styles.unlockText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (session && isLocked && biometricsEnabled) {
    return (
      <View style={styles.lockContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Hisab Kitab</Text>
        <Text style={styles.subtitle}>Your finances are locked</Text>
        <TouchableOpacity style={styles.unlockButton} onPress={handleAuthenticate}>
          <Ionicons name="finger-print" size={24} color="#ffffff" />
          <Text style={styles.unlockText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <ScreenErrorBoundary>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <QueryClientProvider client={queryClient}>
                <PopupProvider>
                  <StatusBar
                    style={theme === 'dark' ? 'light' : 'dark'}
                    backgroundColor={colors.bg}
                  />
                  <OfflineBanner />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'slide_from_right',
                    }}
                  >
                    <Stack.Screen name="login" options={{ headerShown: false }} />
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="transactions/add"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="transactions/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="accounts/index"
                      options={{ animation: 'slide_from_right' }}
                    />
                    <Stack.Screen
                      name="reports/preview"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="settings/index"
                      options={{ animation: 'slide_from_right' }}
                    />
                    <Stack.Screen name="splits/index" options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen
                      name="split-expense/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                  </Stack>
                </PopupProvider>
              </QueryClientProvider>
              <AppToast />
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ScreenErrorBoundary>
    </AppErrorBoundary>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    lockContainer: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: `${colors.primary}40`,
      marginBottom: SPACING.sm,
    },
    title: {
      ...TYPOGRAPHY.h1,
      color: colors.textPrimary,
    },
    subtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
    },
    loadingText: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginTop: SPACING.md,
    },
    loadingSubtext: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: SPACING.sm,
    },
    unlockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: 48,
      marginTop: SPACING.lg,
    },
    unlockText: {
      ...TYPOGRAPHY.bodyMedium,
      color: '#ffffff',
    },
  });

// ─── Expo Router Global ErrorBoundary ─────────────────────────────────────────
// Exported so expo-router can use it as a fallback when any route component fails.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#EF4444', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
        {error?.message || 'An unexpected error occurred.'}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{
          backgroundColor: '#6366F1',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '600' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
