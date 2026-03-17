import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LogBox,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { clearLocalData, initializeDatabase } from '@/database';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { queryClient } from '@/lib/queryClient';
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

// Register Android widget task handler at module level
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}

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
  const [session, setSession] = useState<Session | null>(null);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initializeDatabase();
        const currentSession = await authService.getSession();
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
          if (nextSession) {
            const createdProfile = await UserProfileService.upsertProfile({
              userId: nextSession.user.id,
              email: nextSession.user.email ?? '',
              themePreference: 'system',
            });
            setUserProfile(createdProfile);
          }
          setTheme('system');
        }

        setBiometrics(biometricPreference);
        setBiometricsPromptedState(prompted);
        setLocked(Boolean(nextSession) && biometricPreference);
        syncService.start();
        smsImportService.start();

        if (nextSession) {
          void syncService.requestSync('app-start');
          void smsImportService.run();
        }
      } catch (error) {
        console.error('Initialization failed', error);
        setLocked(false);
      } finally {
        setInitializing(false);
      }
    };

    void bootstrap();

    const subscription = authService.onAuthStateChange(
      async (_event, nextSession) => {
        const previousSession = previousSessionRef.current;
        previousSessionRef.current = nextSession;
        setSession(nextSession);

        if (!nextSession && previousSession) {
          smsImportService.stop();
          await clearLocalData();
          queryClient.clear();
          resetAppState();
          setLocked(false);
          router.replace('/login');
          return;
        }

        if (nextSession) {
          // First-time login: pull all data from Supabase
          if (!previousSession) {
            try {
              await syncService.requestSync('first-login');
            } catch {
              // sync errors are non-fatal
            }
          }
          setLocked(useAppStore.getState().biometricsEnabled);
          void syncService.requestSync('auth-state-change');
          smsImportService.start();
          void smsImportService.run();
        }
      },
    );

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Hisab Kitab...</Text>
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
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={handleAuthenticate}
        >
          <Ionicons name="finger-print" size={24} color="#ffffff" />
          <Text style={styles.unlockText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar
          style={theme === 'dark' ? 'light' : 'dark'}
          backgroundColor={colors.bg}
        />
        <Stack
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="transactions/add"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="transactions/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="accounts/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="settings/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="sms-import"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="splits/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="split-expense/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
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
