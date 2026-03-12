import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';

import { initializeDatabase } from '@/database';
import { queryClient } from '@/lib/queryClient';
import { authService, authenticateBiometric, getBiometricPreference } from '@/services/auth';
import { applyNotificationPreferences } from '@/services/notifications';
import { requestInitialPermissions } from '@/services/permissions';
import { syncService } from '@/services/syncService';
import { UserProfileService } from '@/services/dataServices';
import { useAppStore } from '@/store/appStore';
import { COLORS, SPACING, TYPOGRAPHY } from '@/utils/constants';

export default function RootLayout() {
  const {
    isLocked,
    setLocked,
    biometricsEnabled,
    setBiometrics,
    theme,
    setTheme,
    setUserProfile,
    setNotificationPreferences,
  } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initializeDatabase();
        await requestInitialPermissions();
        const currentSession = await authService.getSession();
        setSession(currentSession.data.session ?? null);
        const biometricPreference = await getBiometricPreference();
        const profile = await UserProfileService.getProfile();
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
        }
        setBiometrics(biometricPreference);
        setLocked(biometricPreference);
        syncService.start();
        void syncService.requestSync('app-start');
      } catch (error) {
        console.error('Initialization failed', error);
        setLocked(false);
      } finally {
        setInitializing(false);
      }
    };

    void bootstrap();

    const subscription = authService.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void syncService.requestSync('auth-state-change');
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
      syncService.stop();
    };
  }, [setBiometrics, setLocked, setNotificationPreferences, setTheme, setUserProfile]);

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
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Hisab Kitab...</Text>
      </View>
    );
  }

  if (isLocked && biometricsEnabled) {
    return (
      <View style={styles.lockContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={40} color={COLORS.primary} />
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
    <GestureHandlerRootView style={styles.root}>
        <QueryClientProvider client={queryClient}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={COLORS.bg} />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {!session ? <Stack.Screen name="auth" options={{ headerShown: false }} /> : null}
          {session ? <Stack.Screen name="(tabs)" options={{ headerShown: false }} /> : null}
          <Stack.Screen name="transactions/add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="transactions/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="accounts/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: `${COLORS.primary}40`,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
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
