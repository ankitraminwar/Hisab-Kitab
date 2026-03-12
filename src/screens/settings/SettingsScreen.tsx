import { Ionicons } from "@expo/vector-icons";
import { documentDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/common";
import { TransactionService } from "../../services/transactionService";
import { useAppStore } from "../../store/appStore";
import { COLORS, SPACING, TYPOGRAPHY } from "../../utils/constants";

export default function SettingsScreen() {
  const { biometricsEnabled, setBiometrics } = useAppStore();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [appVersion] = useState("2.0.0");

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(setBiometricsAvailable);
  }, []);

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Enable biometric lock",
        fallbackLabel: "Use PIN",
      });
      if (result.success) setBiometrics(true);
    } else {
      setBiometrics(false);
    }
  };

  const exportCSV = async () => {
    try {
      const csv = await TransactionService.exportToCSV();
      const fileUri = documentDirectory + "hisabkitab_export.csv";
      await writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Transactions",
      });
    } catch {
      Alert.alert("Error", "Failed to export data");
    }
  };

  const exportJSON = async () => {
    try {
      const txs = await TransactionService.getAll(undefined, 100000);
      const json = JSON.stringify(txs, null, 2);
      const fileUri = documentDirectory + "hisabkitab_backup.json";
      await writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Backup Data",
      });
    } catch {
      Alert.alert("Error", "Failed to export data");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <Card style={styles.profileCard} glow>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={28} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.profileName}>Hisab Kitab</Text>
            <Text style={styles.profileSub}>
              Personal Finance v{appVersion}
            </Text>
          </View>
        </Card>

        {/* Security */}
        <SettingsSection title="Security">
          {biometricsAvailable && (
            <SettingsRow
              icon="finger-print"
              iconColor="#06B6D4"
              label="Biometric Lock"
              subtitle="Use fingerprint/face to unlock"
              right={
                <Switch
                  value={biometricsEnabled}
                  onValueChange={toggleBiometrics}
                  trackColor={{ true: COLORS.primary }}
                />
              }
            />
          )}
          <SettingsRow
            icon="lock-closed"
            iconColor="#8B5CF6"
            label="App Lock"
            subtitle="Lock app when inactive"
            right={
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Data & Backup">
          <SettingsRow
            icon="download-outline"
            iconColor="#22C55E"
            label="Export to CSV"
            subtitle="Download transactions as CSV"
            onPress={exportCSV}
            showChevron
          />
          <SettingsRow
            icon="cloud-download-outline"
            iconColor="#3B82F6"
            label="Backup to JSON"
            subtitle="Full data backup"
            onPress={exportJSON}
            showChevron
          />
        </SettingsSection>

        {/* Categories */}
        <SettingsSection title="Customization">
          <SettingsRow
            icon="pricetags-outline"
            iconColor="#F97316"
            label="Manage Categories"
            subtitle="Add custom categories"
            onPress={() => {}}
            showChevron
          />
          <SettingsRow
            icon="wallet-outline"
            iconColor="#EC4899"
            label="Manage Accounts"
            subtitle="Add and edit accounts"
            onPress={() => {}}
            showChevron
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsRow
            icon="notifications-outline"
            iconColor="#EAB308"
            label="Budget Alerts"
            subtitle="Notify when nearing budget limit"
            right={
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
          <SettingsRow
            icon="alarm-outline"
            iconColor="#F43F5E"
            label="Recurring Reminders"
            subtitle="Remind about upcoming payments"
            right={
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow
            icon="information-circle-outline"
            iconColor="#6B7280"
            label="Version"
            subtitle={appVersion}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor="#22C55E"
            label="Privacy"
            subtitle="No tracking • No ads • Offline first"
          />
        </SettingsSection>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SettingsSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Card style={styles.sectionCard}>{children}</Card>
  </View>
);

const SettingsRow: React.FC<{
  icon: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  showChevron?: boolean;
}> = ({ icon, iconColor, label, subtitle, onPress, right, showChevron }) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.rowIcon, { backgroundColor: iconColor + "20" }]}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
    </View>
    {right ||
      (showChevron && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      ))}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  scroll: { paddingHorizontal: SPACING.md },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primary + "40",
  },
  profileName: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  profileSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
  section: { marginBottom: SPACING.md },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  sectionCard: { padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  rowSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },
});
