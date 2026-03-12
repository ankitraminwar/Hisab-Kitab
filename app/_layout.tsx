import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { initializeDatabase } from '@/database';
import { queryClient } from '@/lib/queryClient';
import { authenticateBiometric, getBiometricPreference } from '@/services/auth';
import { syncService } from '@/services/syncService';
import { useAppStore } from '@/store/appStore';
import { COLORS, SPACING, TYPOGRAPHY } from '@/utils/constants';

export default function RootLayout() {
  const { isLocked, setLocked, biometricsEnabled, setBiometrics } = useAppStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initializeDatabase();
        const biometricPreference = await getBiometricPreference();
        setBiometrics(biometricPreference);
        setLocked(biometricPreference);
        syncService.start();
        void syncService.sync('app-start');
      } catch (error) {
        console.error('Initialization failed', error);
        setLocked(false);
      } finally {
        setInitializing(false);
      }
    };

    void bootstrap();

    return () => {
      syncService.stop();
    };
  }, [setBiometrics, setLocked]);

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
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
