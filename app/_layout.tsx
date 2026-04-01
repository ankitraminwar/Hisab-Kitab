import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  LogBox,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppToast } from '@/components/common/Toast';

import { PopupProvider, ScreenErrorBoundary } from '@/components/common';
import {
  clearLocalData,
  getLastSyncTimestamp,
  hasLocalUserData,
  initializeDatabase,
} from '@/database';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { queryClient } from '@/lib/queryClient';
import { Crashlytics } from '@/services/analytics';
import {
  authService,
  authenticateBiometric,
  getBiometricPreference,
  getBiometricPrompted,
} from '@/services/auth';
import { UserProfileService } from '@/services/dataServices';
import { applyNotificationPreferences } from '@/services/notifications';
import { smsImportService } from '@/services/sms';
import { syncService } from '@/services/syncService';
import { useAppStore } from '@/store/appStore';
import { SPACING, TYPOGRAPHY } from '@/utils/constants';
import { widgetTaskHandler } from '@/widgets/widgetTaskHandler';

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
  if (error.message.includes('Unable to activate keep awake')) {
    return;
  }

  if (isFatal) {
    Crashlytics.recordError(error, 'fatal_js_error');
  }

  previousGlobalHandler?.(error, isFatal);
});

// Register Android widget task handler at module level
if (Platform.OS === 'android') {
  try {
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (error) {
    console.warn('Failed to register widget task handler', error);
  }
}

const ALLOWED_DEEP_LINK_PATHS: Record<string, string> = {
  '/transactions': '/(tabs)/transactions',
  '/budgets': '/(tabs)/budgets',
  '/reports': '/(tabs)/reports',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const previousSessionRef = useRef<Session | null>(null);
  const {
    isLocked,
    setLocked,
    biometricsEnabled,
    setBiometrics,
    setBiometricsPrompted: setBiometricsPromptedState,
    theme,
    setTheme,
    setUserProfile,
    setNotificationPreferences,
    resetAppState,
  } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Max-wait safeguard: if initializing is still true after 8s, force it off
  useEffect(() => {
    const maxWait = setTimeout(() => setInitializing(false), 8000);
    return () => clearTimeout(maxWait);
  }, []);

  // Show slow-load message after 3s
  useEffect(() => {
    if (!initializing) return;
    const t = setTimeout(() => setSlowLoad(true), 3000);
    return () => clearTimeout(t);
  }, [initializing]);

  useEffect(() => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

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
        console.warn('Session hydration failed', error);
      }
    };

    const bootstrap = async () => {
      try {
        // Finding 14: Rapid theme hydration to prevent bootstrap flash
        const persistedTheme = await SecureStore.getItemAsync('theme_pref');
        if (
          persistedTheme &&
          (persistedTheme === 'dark' || persistedTheme === 'light' || persistedTheme === 'system')
        ) {
          setTheme(persistedTheme);
        }

        await withTimeout(initializeDatabase(), 5000, undefined);
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
          await applyNotificationPreferences({
            enabled: profile.notificationsEnabled,
            dailyReminder: profile.notificationsEnabled,
            budgetAlerts: true,
            monthlyReportReminder: true,
          });
        } else {
          setUserProfile(null);
          setTheme('system');
        }

        setBiometrics(biometricPreference);
        setBiometricsPromptedState(prompted);
        setLocked(Boolean(nextSession) && biometricPreference);
        syncService.start();
        smsImportService.start();

        if (nextSession) {
          Crashlytics.setUserId(nextSession.user.id).catch(console.warn);
          hydrateAuthenticatedSession(nextSession, 'app-start').catch(console.warn);
          smsImportService.run().catch(console.warn);
        }
      } catch (error) {
        console.warn('Bootstrap failed, continuing in offline mode', error);
        setLocked(false);
      } finally {
        setInitializing(false);
      }
    };

    void bootstrap();

    const subscription = authService.onAuthStateChange(async (_event, nextSession) => {
      const previousSession = previousSessionRef.current;
      previousSessionRef.current = nextSession;
      setSession(nextSession);

      if (!nextSession && previousSession) {
        Crashlytics.setUserId(null).catch(console.warn);
        syncService.stop();
        smsImportService.stop();
        await clearLocalData();
        queryClient.clear();
        resetAppState();
        setLocked(false);
        router.replace('/login');
        return;
      }

      if (nextSession) {
        setLocked(useAppStore.getState().biometricsEnabled);
        smsImportService.start();
        smsImportService.run().catch(console.warn);
        hydrateAuthenticatedSession(
          nextSession,
          previousSession ? 'auth-state-change' : 'login-hydration',
        ).catch(console.warn);
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
      syncService.stop();
      smsImportService.stop();
    };
  }, [
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
    if (initializing) {
      return;
    }

    const inAuthFlow = segments[0] === 'auth' || segments[0] === 'login';
    if (!session && !inAuthFlow) {
      router.replace('/login');
      return;
    }

    if (session && inAuthFlow) {
      router.replace('/');
    }
  }, [initializing, router, segments, session]);

  // Block hardware back button while biometric lock screen is shown
  useEffect(() => {
    if (!(session && isLocked && biometricsEnabled)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [session, isLocked, biometricsEnabled]);

  // Handle widget deep links that need tab route resolution
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('hisabkitab://')) return;
      const path = `/${url.replace(/^hisabkitab:\/\//, '').split('?')[0]}`;
      const target = ALLOWED_DEEP_LINK_PATHS[path];
      if (target) {
        router.replace(target as Parameters<typeof router.replace>[0]);
      }
    });
    return () => sub.remove();
  }, [router]);

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
                  <Stack.Screen name="accounts/index" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen
                    name="reports/preview"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen
                    name="sms-import"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
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
