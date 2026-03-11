import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { initializeDatabase } from '../src/database';
import { useAppStore } from '../src/store/appStore';
import { COLORS, SPACING, TYPOGRAPHY } from '../src/utils/constants';

export default function RootLayout() {
  const { isLocked, setLocked, biometricsEnabled } = useAppStore();
  const [dbReady, setDbReady] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        setDbReady(true);
        if (!biometricsEnabled) {
          setLocked(false);
        }
      } catch (error) {
        console.error('DB init error:', error);
        setDbReady(true);
        setLocked(false);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  const handleAuthenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Hisab Kitab',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) setLocked(false);
    } catch {
      setLocked(false);
    }
  };

  if (initializing) {
    return (
      <View style={lockStyles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={lockStyles.loadingText}>Loading Hisab Kitab...</Text>
      </View>
    );
  }

  if (isLocked && biometricsEnabled) {
    return (
      <View style={lockStyles.container}>
        <View style={lockStyles.iconContainer}>
          <Ionicons name="lock-closed" size={40} color={COLORS.primary} />
        </View>
        <Text style={lockStyles.title}>Hisab Kitab</Text>
        <Text style={lockStyles.subtitle}>Your finances are locked</Text>
        <TouchableOpacity style={lockStyles.unlockBtn} onPress={handleAuthenticate}>
          <Ionicons name="finger-print" size={24} color="#fff" />
          <Text style={lockStyles.unlockText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transactions/add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="transactions/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const lockStyles = StyleSheet.create({
  container: {
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
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '40',
    marginBottom: SPACING.sm,
  },
  title: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  loadingText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.md },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 50,
    marginTop: SPACING.lg,
  },
  unlockText: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#fff',
    fontWeight: '700',
  },
});
