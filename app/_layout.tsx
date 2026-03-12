import { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';

import { clearLocalData, initializeDatabase } from '@/database';
import { queryClient } from '@/lib/queryClient';
import {
  authService,
  authenticateBiometric,
  getBiometricPreference,
  getBiometricPrompted,
  setBiometricPreference,
  setBiometricPrompted,
} from '@/services/auth';
import { applyNotificationPreferences } from '@/services/notifications';
import { smsImportService } from '@/services/sms';
import { syncService } from '@/services/syncService';
import { UserProfileService } from '@/services/dataServices';
import { useAppStore } from '@/store/appStore';
import { SPACING, TYPOGRAPHY } from '@/utils/constants';
import { useTheme } from '@/hooks/useTheme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const previousSessionRef = useRef<Session | null>(null);
  const biometricPromptVisibleRef = useRef(false);
  const {
    isLocked,
    setLocked,
    biometricsEnabled,
    setBiometrics,
    biometricsPrompted,
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
            });
            setUserProfile(createdProfile);
          }
          setTheme('dark');
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

  useEffect(() => {
    if (
      initializing ||
      !session ||
      biometricsEnabled ||
      biometricsPrompted ||
      biometricPromptVisibleRef.current
    ) {
      return;
    }

    biometricPromptVisibleRef.current = true;

    Alert.alert(
      'Enable biometrics?',
      'Use your device fingerprint or face unlock each time you open the app.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            biometricPromptVisibleRef.current = false;
            void setBiometricPrompted(true).then(() =>
              setBiometricsPromptedState(true),
            );
          },
        },
        {
          text: 'Enable',
          onPress: async () => {
            biometricPromptVisibleRef.current = false;
            const success = await authenticateBiometric();
            if (success) {
              await setBiometricPreference(true);
              setBiometrics(true);
              setLocked(true);
              const updatedProfile = await UserProfileService.upsertProfile({
                biometricEnabled: true,
              });
              setUserProfile(updatedProfile);
            }
            await setBiometricPrompted(true);
            setBiometricsPromptedState(true);
          },
        },
      ],
      { cancelable: false },
    );
  }, [
    biometricsEnabled,
    biometricsPrompted,
    initializing,
    session,
    setBiometrics,
    setBiometricsPromptedState,
    setLocked,
    setUserProfile,
  ]);

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
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: any) =>
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
