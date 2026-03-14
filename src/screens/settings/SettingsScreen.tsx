import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAppStore } from '@/store/appStore';
import { authService, setBiometricPreference } from '@/services/auth';
import { syncService } from '@/services/syncService';
import { exportService } from '@/services/exportService';
import { importSmsTransactions } from '@/services/sms';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/utils/constants';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { theme, setTheme, biometricsEnabled, setBiometrics, userProfile } =
    useAppStore();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true); // placeholder, assuming SMS is always enabled for now unless managed in store

  useEffect(() => {
    const checkBiometrics = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(hasHardware && isEnrolled);
    };
    void checkBiometrics();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value && biometricsAvailable) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Biometric Login',
      });
      if (result.success) {
        setBiometrics(true);
        void setBiometricPreference(true);
      }
    } else {
      setBiometrics(false);
      void setBiometricPreference(false);
    }
  };

  const handleSync = async () => {
    try {
      await syncService.sync('manual');
      Alert.alert('Success', 'Data synced successfully to the cloud.');
    } catch {
      Alert.alert('Sync Failed', 'Could not sync data. Check your connection.');
    }
  };

  const handleExport = () => {
    Alert.alert('Export Format', 'Choose data format to export:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'CSV (Transactions)',
        onPress: async () => {
          try {
            const uri = await exportService.exportTransactionsCsv();
            if (uri) Alert.alert('Success', `Data exported to:\n${uri}`);
          } catch {
            Alert.alert('Export Failed', 'Could not export CSV data.');
          }
        },
      },
      {
        text: 'JSON (Full Backup)',
        onPress: async () => {
          try {
            const uri = await exportService.exportFullBackupJson();
            if (uri) Alert.alert('Success', `Backup exported to:\n${uri}`);
          } catch {
            Alert.alert('Export Failed', 'Could not export JSON backup.');
          }
        },
      },
    ]);
  };

  const handleSmsImport = async () => {
    try {
      const count = await importSmsTransactions();
      Alert.alert('SMS Import', `Found ${count} new transactions from SMS.`);
    } catch {
      Alert.alert('Import Failed', 'Could not import SMS transactions.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Settings" rightIcon="help-circle-outline" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          {/* Account Section */}
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => router.push('/profile/edit')}
          >
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userProfile?.name || 'My Account'}
              </Text>
              <Text style={styles.profileEmail}>
                {userProfile?.email || 'user@example.com'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          {/* Preferences Section */}
          <Text style={styles.sectionTitle}>PREFERENCES</Text>

          {/* Theme Toggle */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="moon-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.prefTitle}>Appearance</Text>
            </View>
            <View style={styles.themeToggleBg}>
              {(['light', 'dark', 'system'] as const).map((t) => {
                const isActive = theme === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTheme(t)}
                    style={[styles.themeBtn, isActive && styles.themeBtnActive]}
                  >
                    <Text
                      style={[
                        styles.themeBtnText,
                        { color: isActive ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SMS Toggle */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.prefTitle}>SMS Auto-import</Text>
                <Text style={styles.prefSub}>Sync transactions from SMS</Text>
              </View>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: colors.bgElevated, true: colors.primary }}
              thumbColor="#FFFFFF"
              disabled={!__DEV__} // Just mock toggle unless implemented globally
            />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/sms-import')}
            style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}
          >
            <Text
              style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}
            >
              Run manual SMS check now
            </Text>
          </TouchableOpacity>

          {/* Biometrics Toggle */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="finger-print-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.prefTitle}>Biometric Lock</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={(val) => void handleBiometricToggle(val)}
              disabled={!biometricsAvailable}
              trackColor={{ false: colors.bgElevated, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          {/* Data & Sync Section */}
          <Text style={styles.sectionTitle}>DATA & SYNC</Text>

          {/* Bank Accounts */}
          <TouchableOpacity
            style={styles.prefRow}
            onPress={() => router.push('/accounts')}
          >
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.prefTitle}>Bank Accounts</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Cloud Sync */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="cloud-done-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.prefTitle}>Cloud Backup</Text>
                <Text style={styles.prefSub}>Last synced: Just now</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => void handleSync()}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Sync Now</Text>
            </TouchableOpacity>
          </View>

          {/* Export */}
          <TouchableOpacity style={styles.prefRow} onPress={handleExport}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.prefTitle}>Export Data</Text>
            </View>
            <View style={styles.exportBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>CSV</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>JSON</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.logoutWrapper}
        >
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.expense} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Hisab-Kitab v2.4.1 (Stable)</Text>
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 40 },
    sectionTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginLeft: SPACING.md,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      padding: SPACING.md,
      marginHorizontal: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.md,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: colors.primary + '40',
    },
    avatarPlaceholder: {
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: { flex: 1 },
    profileName: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    profileEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      minHeight: 56,
    },
    prefLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    prefTitle: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    prefSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    themeToggleBg: {
      flexDirection: 'row',
      backgroundColor: colors.bgElevated,
      padding: 4,
      borderRadius: RADIUS.md,
    },
    themeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    themeBtnActive: {
      backgroundColor: colors.bgCard,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 2,
    },
    themeBtnText: { fontSize: 12, fontWeight: '700' },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    actionBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    exportBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: {
      backgroundColor: colors.bgElevated,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
    logoutWrapper: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.expense + '15',
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.expense + '30',
    },
    logoutText: { fontSize: 16, fontWeight: '700', color: colors.expense },
    versionText: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.textMuted,
      marginTop: SPACING.lg,
    },
  });
