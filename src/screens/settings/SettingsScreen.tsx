import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/common';
import { authService, setBiometricPreference } from '@/services/auth';
import { UserProfileService } from '@/services/dataServices';
import { exportService } from '@/services/exportService';
import { applyNotificationPreferences } from '@/services/notifications';
import { importSmsTransactions } from '@/services/sms';
import { syncService } from '@/services/syncService';
import { useAppStore } from '@/store/appStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type {
  NotificationPreferences,
  ThemePreference,
  UserProfile,
} from '@/utils/types';

const buildNotificationPreferences = (
  enabled: boolean,
  current: NotificationPreferences,
): NotificationPreferences => ({
  enabled,
  dailyReminder: enabled ? current.dailyReminder : false,
  budgetAlerts: enabled ? current.budgetAlerts : false,
  monthlyReportReminder: enabled ? current.monthlyReportReminder : false,
});

export default function SettingsScreen() {
  const {
    biometricsEnabled,
    setBiometrics,
    theme,
    setTheme,
    userProfile,
    setUserProfile,
    notificationPreferences,
    setNotificationPreferences,
  } = useAppStore();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfile | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync()
      .then(setBiometricsAvailable)
      .catch(() => setBiometricsAvailable(false));
  }, []);

  useEffect(() => {
    if (userProfile) {
      setDraftProfile(userProfile);
      return;
    }

    void UserProfileService.getProfile().then((profile) => {
      if (profile) {
        setUserProfile(profile);
        setDraftProfile(profile);
      }
    });
  }, [setUserProfile, userProfile]);

  const persistProfile = async (patch: Partial<UserProfile>) => {
    setSaving(true);
    try {
      const updated = await UserProfileService.upsertProfile({
        ...userProfile,
        ...patch,
      });
      setUserProfile(updated);
      return updated;
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    const updated = await persistProfile({ themePreference: nextTheme });
    setDraftProfile(updated);
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric lock',
        fallbackLabel: 'Use device passcode',
      });
      if (!result.success) {
        return;
      }
    }

    await setBiometricPreference(enabled);
    setBiometrics(enabled);
    const updated = await persistProfile({ biometricEnabled: enabled });
    setDraftProfile(updated);
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    const nextPreferences = buildNotificationPreferences(
      enabled,
      notificationPreferences,
    );
    const granted = await applyNotificationPreferences(nextPreferences);
    const resolved = granted
      ? nextPreferences
      : buildNotificationPreferences(false, notificationPreferences);
    setNotificationPreferences(resolved);
    const updated = await persistProfile({
      notificationsEnabled: resolved.enabled,
    });
    setDraftProfile(updated);
  };

  const updateNotificationChannel = async (
    key: keyof Omit<NotificationPreferences, 'enabled'>,
    enabled: boolean,
  ) => {
    const next = {
      ...notificationPreferences,
      enabled: true,
      [key]: enabled,
    };
    const granted = await applyNotificationPreferences(next);
    const resolved = granted
      ? next
      : {
          ...next,
          enabled: false,
          dailyReminder: false,
          budgetAlerts: false,
          monthlyReportReminder: false,
        };
    setNotificationPreferences(resolved);
    const updated = await persistProfile({
      notificationsEnabled: resolved.enabled,
    });
    setDraftProfile(updated);
  };

  const saveProfileChanges = async () => {
    if (!draftProfile) {
      return;
    }

    const updated = await persistProfile({
      name: draftProfile.name,
      email: draftProfile.email,
      phone: draftProfile.phone,
      currency: draftProfile.currency,
      monthlyBudget: Number.isFinite(draftProfile.monthlyBudget)
        ? draftProfile.monthlyBudget
        : 0,
    });
    setDraftProfile(updated);
    setProfileModalVisible(false);
  };

  const handleExport = async (mode: 'csv' | 'json') => {
    try {
      if (mode === 'csv') {
        await exportService.exportTransactionsCsv();
      } else {
        await exportService.exportFullBackupJson();
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unable to export data',
      );
    }
  };

  const handleSmsImport = async () => {
    try {
      const result = await importSmsTransactions();
      Alert.alert('SMS Import', result.message);
    } catch (error) {
      Alert.alert(
        'SMS Import Failed',
        error instanceof Error ? error.message : 'Unable to import SMS data',
      );
    }
  };

  const profile = draftProfile ?? userProfile;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.profileCard} glow>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.profileContent}>
            <Text style={styles.profileName}>
              {profile?.name ?? 'Hisab Kitab User'}
            </Text>
            <Text style={styles.profileSub}>
              {profile?.email || 'Set up your synced profile'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setProfileModalVisible(true)}
            style={styles.actionChip}
          >
            <Text style={styles.actionChipText}>Edit</Text>
          </TouchableOpacity>
        </Card>

        <SettingsSection title="Appearance">
          <SettingsRow
            icon="contrast-outline"
            iconColor="#8B5CF6"
            label="Theme"
            subtitle={
              theme === 'dark' ? 'Dark mode active' : 'Light mode active'
            }
            right={
              <View style={styles.themeToggle}>
                <ThemeChip
                  label="Dark"
                  active={theme === 'dark'}
                  onPress={() => void handleThemeChange('dark')}
                />
                <ThemeChip
                  label="Light"
                  active={theme === 'light'}
                  onPress={() => void handleThemeChange('light')}
                />
              </View>
            }
          />
        </SettingsSection>

        <SettingsSection title="Security">
          {biometricsAvailable && (
            <SettingsRow
              icon="finger-print"
              iconColor="#06B6D4"
              label="Biometric Lock"
              subtitle="Use fingerprint or Face ID when supported"
              right={
                <Switch
                  value={biometricsEnabled}
                  onValueChange={(value) => void handleToggleBiometrics(value)}
                  trackColor={{ true: COLORS.primary }}
                />
              }
            />
          )}
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            icon="notifications-outline"
            iconColor="#EAB308"
            label="Enable Notifications"
            subtitle="Disable gracefully if permission is denied"
            right={
              <Switch
                value={notificationPreferences.enabled}
                onValueChange={(value) => void handleNotificationsToggle(value)}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
          <SettingsRow
            icon="today-outline"
            iconColor="#22C55E"
            label="Daily Spending Reminder"
            right={
              <Switch
                value={notificationPreferences.dailyReminder}
                onValueChange={(value) =>
                  void updateNotificationChannel('dailyReminder', value)
                }
                disabled={!notificationPreferences.enabled}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
          <SettingsRow
            icon="alert-circle-outline"
            iconColor="#F97316"
            label="Budget Limit Alert"
            right={
              <Switch
                value={notificationPreferences.budgetAlerts}
                onValueChange={(value) =>
                  void updateNotificationChannel('budgetAlerts', value)
                }
                disabled={!notificationPreferences.enabled}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
          <SettingsRow
            icon="calendar-outline"
            iconColor="#3B82F6"
            label="Monthly Report Reminder"
            right={
              <Switch
                value={notificationPreferences.monthlyReportReminder}
                onValueChange={(value) =>
                  void updateNotificationChannel('monthlyReportReminder', value)
                }
                disabled={!notificationPreferences.enabled}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
        </SettingsSection>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SettingsSection title="Sync">
            <SyncStatusRow />
          </SettingsSection>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <SettingsSection title="Data & Backup">
            <SettingsRow
              icon="chatbox-ellipses-outline"
              iconColor="#8B5CF6"
              label="Import Bank SMS"
              subtitle="Requests SMS read permission on Android. Native inbox parsing is not available in this build yet."
              onPress={() => void handleSmsImport()}
              showChevron
            />
            <SettingsRow
              icon="download-outline"
              iconColor="#22C55E"
              label="Export CSV"
              subtitle="Share paginated transaction history as CSV"
              onPress={() => void handleExport('csv')}
              showChevron
            />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#3B82F6"
              label="Export JSON"
              subtitle="Share full offline backup as JSON"
              onPress={() => void handleExport('json')}
              showChevron
            />
          </SettingsSection>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <SettingsSection title="Account">
            <SettingsRow
              icon="log-out-outline"
              iconColor="#F43F5E"
              label="Logout"
              subtitle="Sign out, block app access, and clear all local cached data"
              onPress={() => void authService.signOut()}
              showChevron
            />
          </SettingsSection>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>Profile</Text>
            <ProfileInput
              label="Name"
              value={profile?.name ?? ''}
              onChangeText={(value) =>
                setDraftProfile((current) =>
                  current ? { ...current, name: value } : current,
                )
              }
            />
            <ProfileInput
              label="Email"
              value={profile?.email ?? ''}
              onChangeText={(value) =>
                setDraftProfile((current) =>
                  current ? { ...current, email: value } : current,
                )
              }
              keyboardType="email-address"
            />
            <ProfileInput
              label="Phone"
              value={profile?.phone ?? ''}
              onChangeText={(value) =>
                setDraftProfile((current) =>
                  current ? { ...current, phone: value } : current,
                )
              }
              keyboardType="phone-pad"
            />
            <ProfileInput
              label="Currency"
              value={profile?.currency ?? 'INR'}
              onChangeText={(value) =>
                setDraftProfile((current) =>
                  current
                    ? { ...current, currency: value.toUpperCase() }
                    : current,
                )
              }
            />
            <ProfileInput
              label="Monthly Budget"
              value={String(profile?.monthlyBudget ?? 0)}
              onChangeText={(value) =>
                setDraftProfile((current) =>
                  current
                    ? { ...current, monthlyBudget: Number(value) || 0 }
                    : current,
                )
              }
              keyboardType="numeric"
            />
            <View style={modalStyles.actions}>
              <Button
                title="Cancel"
                onPress={() => setProfileModalVisible(false)}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                onPress={() => void saveProfileChanges()}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const SyncStatusRow = () => {
  const { syncInProgress, lastSyncAt, lastSyncError, isOnline } = useAppStore();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncService.requestSync('manual');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: '#06B6D420' }]}>
        <Ionicons name="sync-outline" size={18} color="#06B6D4" />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>Cloud Sync</Text>
        {lastSyncError ? (
          <Text
            style={[styles.rowSub, { color: COLORS.expense }]}
            numberOfLines={2}
          >
            {lastSyncError}
          </Text>
        ) : lastSyncAt ? (
          <Text style={styles.rowSub}>
            Last synced: {new Date(lastSyncAt).toLocaleString()}
          </Text>
        ) : (
          <Text style={styles.rowSub}>Not synced yet</Text>
        )}
      </View>
      {syncing || syncInProgress ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <TouchableOpacity
          onPress={() => void handleSync()}
          disabled={!isOnline}
          style={[styles.syncButton, !isOnline && { opacity: 0.4 }]}
        >
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const ThemeChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.themeChip, active && styles.themeChipActive]}
  >
    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const SettingsSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Card style={styles.sectionCard}>{children}</Card>
  </View>
);

const SettingsRow = ({
  icon,
  iconColor,
  label,
  subtitle,
  onPress,
  right,
  showChevron,
}: {
  icon: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  showChevron?: boolean;
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.rowIcon, { backgroundColor: `${iconColor}20` }]}>
      <Ionicons name={icon as never} size={18} color={iconColor} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
    </View>
    {right ??
      (showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      ) : null)}
  </TouchableOpacity>
);

const ProfileInput = ({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) => (
  <View style={modalStyles.inputGroup}>
    <Text style={modalStyles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      style={modalStyles.input}
      placeholderTextColor={COLORS.textMuted}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: 96 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContent: { flex: 1 },
  profileName: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  profileSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
  actionChip: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: { marginBottom: SPACING.md },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  sectionCard: { padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  rowSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },
  themeToggle: { flexDirection: 'row', gap: 8 },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  themeChipText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  themeChipTextActive: { color: COLORS.primary, fontWeight: '600' },
  syncButton: {
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '20',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  inputGroup: { marginBottom: SPACING.sm },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
