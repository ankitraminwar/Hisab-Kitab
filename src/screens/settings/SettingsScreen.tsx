import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomPopup, CustomSwitch } from '../../components/common/index';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { authService, setBiometricPreference } from '../../services/auth';
import { sendMonthlyReport } from '../../services/emailReportService';
import { exportService } from '../../services/exportService';
import { syncService } from '../../services/syncService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    theme,
    setTheme,
    biometricsEnabled,
    setBiometrics,
    userProfile,
    setUserProfile,
    smsEnabled,
    setSmsEnabled,
    lastSyncAt,
  } = useAppStore();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({ visible: false, title: '', message: '', type: 'info' });
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    setSyncing(true);
    try {
      const result = await syncService.sync('manual');
      if (result.success) {
        setPopupConfig({
          visible: true,
          title: 'Success',
          message: 'Data synced successfully to the cloud.',
          type: 'success',
        });
        return;
      }
      setPopupConfig({
        visible: true,
        title: 'Sync Failed',
        message: result.error ?? 'Could not sync data. Check your connection.',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportFormat = async (format: 'csv' | 'pdf' | 'json') => {
    setShowExportPicker(false);
    try {
      let uri: string | undefined;
      if (format === 'csv') uri = await exportService.exportTransactionsCsv();
      else if (format === 'pdf') uri = await exportService.exportTransactionsPdf();
      else uri = await exportService.exportFullBackupJson();

      if (uri)
        setPopupConfig({
          visible: true,
          title: 'Success',
          message: `${format.toUpperCase()} exported successfully.`,
          type: 'success',
        });
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Export Failed',
        message: `Could not export ${format.toUpperCase()} data.`,
        type: 'error',
      });
    }
  };

  const handleExport = () => {
    setShowExportPicker(true);
  };

  const handleImportBackup = () => {
    setShowImportConfirm(true);
  };

  const confirmImportBackup = async () => {
    setShowImportConfirm(false);
    try {
      const result = await exportService.importBackupJson();
      if (result) {
        setPopupConfig({
          visible: true,
          title: 'Import Successful',
          message: `${result.imported} records imported.`,
          type: 'success',
        });
      }
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Import Failed',
        message: 'Could not import backup. Make sure you selected a valid Hisab Kitab backup file.',
        type: 'error',
      });
    }
  };

  const handleEmailReport = async () => {
    try {
      const result = await sendMonthlyReport();
      if (result.ok) {
        setPopupConfig({
          visible: true,
          title: 'Report Sent',
          message: 'Monthly report has been sent to your email.',
          type: 'success',
        });
      } else {
        setPopupConfig({
          visible: true,
          title: 'Failed',
          message: result.error ?? 'Could not send report.',
          type: 'error',
        });
      }
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Failed',
        message: 'Could not send email report. Please check your connection.',
        type: 'error',
      });
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await authService.signOut();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      if (userProfile) {
        setUserProfile({ ...userProfile, avatar: result.assets[0].uri });
      }
    }
  };

  const formattedLastSync = useMemo(() => {
    if (!lastSyncAt) return 'Never';
    return new Date(lastSyncAt).toLocaleString();
  }, [lastSyncAt]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Settings"
        rightAction={{
          icon: 'help-circle-outline',
          onPress: () => router.push('/faq' as Href),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          {/* Account Section */}
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/profile/edit')}>
            <TouchableOpacity
              style={[styles.avatar, !userProfile?.avatar && styles.avatarPlaceholder]}
              onPress={() => void pickImage()}
            >
              {userProfile?.avatar ? (
                <Image source={{ uri: userProfile.avatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userProfile?.name || 'My Account'}</Text>
              <Text style={styles.profileEmail}>{userProfile?.email || 'user@example.com'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          {/* Preferences Section */}
          <Text style={styles.sectionTitle}>PREFERENCES</Text>

          {/* Theme Toggle */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="moon-outline" size={20} color={colors.primary} />
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
                      {t?.charAt(0)?.toUpperCase() + t.slice(1)}
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
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.prefTitle}>SMS Auto-import</Text>
                <Text style={styles.prefSub}>Sync transactions from SMS</Text>
              </View>
            </View>
            <CustomSwitch value={smsEnabled} onValueChange={setSmsEnabled} />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/sms-import')}
            style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}
          >
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>
              Run manual SMS check now
            </Text>
          </TouchableOpacity>

          {/* Biometrics Toggle */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Biometric Lock</Text>
            </View>
            <CustomSwitch
              value={biometricsEnabled}
              onValueChange={(val) => void handleBiometricToggle(val)}
              disabled={!biometricsAvailable}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          {/* Data & Sync Section */}
          <Text style={styles.sectionTitle}>DATA & SYNC</Text>

          {/* Bank Accounts */}
          <TouchableOpacity style={styles.prefRow} onPress={() => router.push('/accounts')}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="card-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Bank Accounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Split Expenses */}
          <TouchableOpacity style={styles.prefRow} onPress={() => router.push('/splits' as Href)}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Split Expenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Cloud Sync */}
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="cloud-done-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.prefTitle}>Cloud Backup</Text>
                <Text style={styles.prefSub}>Last synced: {formattedLastSync}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => void handleSync()}
              style={[styles.actionBtn, syncing && { opacity: 0.6 }]}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionBtnText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Export */}
          <TouchableOpacity style={styles.prefRow} onPress={handleExport}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Export Data</Text>
            </View>
            <View style={styles.exportBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>CSV</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>PDF</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>JSON</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Import Backup */}
          <TouchableOpacity style={styles.prefRow} onPress={handleImportBackup}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="push-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Import Backup</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Email Monthly Report */}
          <TouchableOpacity style={styles.prefRow} onPress={handleEmailReport}>
            <View style={styles.prefLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.prefTitle}>Email Monthly Report</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.logoutWrapper}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.expense} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Hisab Kitab v2.0.0 (Stable)</Text>
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Export Format Picker */}
      <CustomPopup
        visible={showExportPicker}
        title="Export Format"
        message="Choose data format to export:"
        type="info"
        actions={[
          { label: 'CSV', onPress: () => void handleExportFormat('csv') },
          {
            label: 'PDF Report',
            onPress: () => void handleExportFormat('pdf'),
          },
          {
            label: 'JSON Backup',
            onPress: () => void handleExportFormat('json'),
          },
        ]}
        onClose={() => setShowExportPicker(false)}
      />

      {/* Import Confirmation */}
      <CustomPopup
        visible={showImportConfirm}
        title="Import Backup"
        message="This will merge the backup data into your existing data. Any conflicting records will be overwritten. Continue?"
        type="info"
        actionLabel="Choose File"
        onAction={() => void confirmImportBackup()}
        onClose={() => setShowImportConfirm(false)}
      />

      {/* Logout Confirmation */}
      <CustomPopup
        visible={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to log out?"
        type="error"
        actionLabel="Logout"
        onAction={() => void confirmLogout()}
        onClose={() => setShowLogoutConfirm(false)}
      />

      {/* General Popup */}
      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => {
          setPopupConfig((prev) => ({ ...prev, visible: false }));
          popupConfig.onClose?.();
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
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
}
