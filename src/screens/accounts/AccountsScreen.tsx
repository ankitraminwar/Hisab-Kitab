import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CustomModal, usePopup } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { AccountService } from '../../services/dataServices';
import { triggerBackgroundSync } from '../../services/syncService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { Account, AccountType, IoniconsName } from '../../utils/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

const ACCOUNT_TYPES: {
  key: AccountType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'cash', label: 'Cash', icon: 'cash', color: '#22C55E' },
  { key: 'bank', label: 'Bank', icon: 'business', color: '#3B82F6' },
  { key: 'upi', label: 'UPI', icon: 'phone-portrait', color: '#8B5CF6' },
  { key: 'credit_card', label: 'Credit', icon: 'card', color: '#F43F5E' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet', color: '#F97316' },
  { key: 'investment', label: 'Invest', icon: 'trending-up', color: '#06B6D4' },
];

const ACCOUNT_COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#F43F5E',
  '#F97316',
  '#22C55E',
  '#06B6D4',
  '#EAB308',
  '#EC4899',
  '#14B8A6',
];

export default function AccountsScreen() {
  const { colors, isDark } = useTheme();
  const { showCustomPopup } = usePopup();
  const dataRevision = useAppStore((state) => state.dataRevision);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    const data = await AccountService.getAll();
    setAccounts(data);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [dataRevision, loadAccounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerBackgroundSync('pull-to-refresh');
    await loadAccounts();
    setRefreshing(false);
  };

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const activeAccountsCount = accounts.length;

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.title}>My Accounts</Text>
            <Text style={styles.subtitle}>Organize your finances effortlessly</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAdd(true)}
            style={styles.addBtn}
            accessibilityLabel="Add account"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[colors.primary, '#6D28D9']}
              style={styles.addBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={24} color={colors.heroText} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Total Net Worth Card */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.netWorthCardWrap}
          >
            <LinearGradient
              colors={[colors.bgCard, colors.bgElevated]}
              style={styles.netWorthCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.netWorthTop}>
                <View>
                  <Text style={styles.netWorthLabel}>TOTAL NET WORTH</Text>
                  <Text
                    style={[
                      styles.netWorthAmount,
                      { color: totalBalance >= 0 ? colors.textPrimary : colors.expense },
                    ]}
                  >
                    {formatCurrency(totalBalance)}
                  </Text>
                </View>
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="pie-chart" size={24} color={colors.primary} />
                </View>
              </View>

              <View style={styles.netWorthStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Active Accounts</Text>
                  <Text style={styles.statValue}>{activeAccountsCount}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Status</Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: totalBalance >= 0 ? colors.income : colors.expense },
                    ]}
                  >
                    {totalBalance >= 0 ? 'Healthy' : 'Attention'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Accounts Carousel */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Cards & Wallets</Text>
            </View>

            {accounts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No accounts yet</Text>
                <Text style={styles.emptySub}>Add your first bank account or wallet.</Text>
                <Button
                  title="Add Account"
                  icon="add-circle-outline"
                  onPress={() => setShowAdd(true)}
                  style={{ marginTop: SPACING.md }}
                />
              </View>
            ) : (
              <FlatList
                data={accounts}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + SPACING.md}
                decelerationRate="fast"
                contentContainerStyle={styles.carouselContent}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <Animated.View entering={FadeInRight.duration(400).delay(250 + index * 50)}>
                    <AccountCreditCard
                      account={item}
                      onEdit={() => setEditingAccount(item)}
                      onDelete={() => {
                        showCustomPopup({
                          title: 'Delete Account?',
                          message: `Are you sure you want to delete "${item.name}"? This action cannot be undone. All associated transactions will be hidden.`,
                          type: 'error',
                          confirmLabel: 'Delete',
                          onConfirm: async () => {
                            await AccountService.delete(item.id);
                            void loadAccounts();
                          },
                        });
                      }}
                    />
                  </Animated.View>
                )}
              />
            )}
          </Animated.View>

          {/* Quick Actions or Info */}
          {accounts.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(350)}
              style={styles.infoSection}
            >
              <Text style={styles.sectionTitle}>Account Insights</Text>
              <View style={styles.infoCard}>
                <Ionicons name="bulb" size={24} color={colors.warning} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.infoCardTitle}>Keep track of balances</Text>
                  <Text style={styles.infoCardText}>
                    Updating your account balances regularly ensures accurate net worth tracking.
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <AddAccountModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => {
          void loadAccounts();
          setShowAdd(false);
        }}
      />

      <EditAccountModal
        visible={!!editingAccount}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={() => {
          void loadAccounts();
          setEditingAccount(null);
        }}
      />
    </View>
  );
}

const AccountCreditCard: React.FC<{
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ account, onEdit, onDelete }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const typeInfo = ACCOUNT_TYPES.find((type) => type.key === account.type);

  // Derive gradient colors randomly based on account color for a premium look
  const c1 = account.color;

  return (
    <View style={styles.creditCardWrap}>
      <LinearGradient
        colors={[c1, c1 + 'CC']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Decorative patterns */}
      <View style={styles.cardPattern1} />
      <View style={styles.cardPattern2} />

      <View style={styles.cardTop}>
        <View style={styles.cardIconBox}>
          <Ionicons name={account.icon as IoniconsName} size={20} color={c1} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.deleteAction}
            hitSlop={10}
            accessibilityLabel="Edit account"
            accessibilityRole="button"
          >
            <Ionicons name="pencil" size={18} color={colors.heroTextMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={styles.deleteAction}
            hitSlop={10}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
          >
            <Ionicons name="trash" size={18} color={colors.heroTextMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardMiddle}>
        <Text style={styles.cardBalanceLabel}>Current Balance</Text>
        <Text style={styles.cardBalanceValue}>{formatCurrency(account.balance)}</Text>
      </View>

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.cardName} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={styles.cardType}>{typeInfo?.label || account.type}</Text>
        </View>
        {account.isDefault && (
          <View style={styles.defaultPill}>
            <Text style={styles.defaultPillText}>Primary</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ── ADD ACCOUNT MODAL ─────────────────────────────────────────────────────────

const AddAccountModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}> = ({ visible, onClose, onSave }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setLoading(true);
    const typeInfo = ACCOUNT_TYPES.find((item) => item.key === type);

    await AccountService.create({
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
      currency: 'INR',
      color,
      icon: typeInfo?.icon || 'wallet',
      isDefault: false,
    });

    setLoading(false);
    setName('');
    setBalance('');
    onSave();
  };

  return (
    <CustomModal visible={visible} onClose={onClose} hideCloseBtn>
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Add Account</Text>
          <Text style={styles.subtitle}>
            Create a clean home for each bank, wallet, or cash balance.
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Account Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: SPACING.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {ACCOUNT_TYPES.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setType(item.key)}
              style={[
                styles.typeChip,
                type === item.key && {
                  backgroundColor: item.color,
                  borderColor: item.color,
                },
              ]}
            >
              <Ionicons
                name={item.icon as IoniconsName}
                size={16}
                color={type === item.key ? colors.heroText : colors.textMuted}
              />
              <Text style={[styles.typeLabel, type === item.key && { color: colors.heroText }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Account name (e.g. ICICI Savings)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          placeholder="Opening balance (₹)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Theme Color</Text>
        <View style={styles.colorRow}>
          {ACCOUNT_COLORS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setColor(value)}
              style={[
                styles.colorDot,
                {
                  backgroundColor: value,
                  borderWidth: color === value ? 3 : 0,
                  borderColor: colors.bgCard,
                  shadowColor: value,
                  shadowOpacity: color === value ? 0.3 : 0,
                  shadowRadius: 4,
                  elevation: color === value ? 4 : 0,
                },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
        <Button title="Add Account" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
      </View>
    </CustomModal>
  );
};

// ── EDIT ACCOUNT MODAL ────────────────────────────────────────────────────────

const EditAccountModal: React.FC<{
  visible: boolean;
  account: Account | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ visible, account, onClose, onSave }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && account) {
      setName(account.name);
      setType(account.type);
      setBalance(String(account.balance));
      setColor(account.color || ACCOUNT_COLORS[0]);
    }
  }, [visible, account]);

  const handleSave = async () => {
    if (!name.trim() || !account) return;

    setLoading(true);
    try {
      const typeInfo = ACCOUNT_TYPES.find((item) => item.key === type);
      await AccountService.update(account.id, {
        name: name.trim(),
        type,
        balance: parseFloat(balance) || 0,
        color,
        icon: typeInfo?.icon || account.icon,
      });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomModal visible={visible} onClose={onClose} hideCloseBtn>
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Edit Account</Text>
          <Text style={styles.subtitle}>Update your account details.</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Account Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: SPACING.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {ACCOUNT_TYPES.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setType(item.key)}
              style={[
                styles.typeChip,
                type === item.key && {
                  backgroundColor: item.color,
                  borderColor: item.color,
                },
              ]}
            >
              <Ionicons
                name={item.icon as IoniconsName}
                size={16}
                color={type === item.key ? colors.heroText : colors.textMuted}
              />
              <Text style={[styles.typeLabel, type === item.key && { color: colors.heroText }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Account name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          placeholder="Balance (₹)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Theme Color</Text>
        <View style={styles.colorRow}>
          {ACCOUNT_COLORS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setColor(value)}
              style={[
                styles.colorDot,
                {
                  backgroundColor: value,
                  borderWidth: color === value ? 3 : 0,
                  borderColor: colors.bgCard,
                  shadowColor: value,
                  shadowOpacity: color === value ? 0.3 : 0,
                  shadowRadius: 4,
                  elevation: color === value ? 4 : 0,
                },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
        <Button title="Save Changes" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
      </View>
    </CustomModal>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    subtitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formContent: {
      paddingBottom: SPACING.md,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.textPrimary,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      marginRight: 10,
    },
    typeLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '700',
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
      fontSize: 16,
    },
    colorRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: SPACING.lg,
      flexWrap: 'wrap',
    },
    colorDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: SPACING.md,
    },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    title: { ...TYPOGRAPHY.h2, color: colors.textPrimary, fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { ...TYPOGRAPHY.caption, color: colors.textMuted, marginTop: 4, fontSize: 14 },
    addBtn: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    addBtnGradient: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    netWorthCardWrap: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.xl,
    },
    netWorthCard: {
      borderRadius: 24,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 4,
    },
    netWorthTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    netWorthLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    netWorthAmount: {
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -1,
      marginTop: 8,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    netWorthStats: {
      flexDirection: 'row',
      marginTop: SPACING.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border + '50',
      paddingTop: SPACING.lg,
    },
    statBox: {
      flex: 1,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border + '50',
      marginHorizontal: SPACING.md,
    },
    statLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    statValue: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 4,
    },
    sectionHeaderRow: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    carouselContent: {
      paddingHorizontal: SPACING.md,
      gap: SPACING.md,
    },
    creditCardWrap: {
      width: CARD_WIDTH,
      height: 200,
      borderRadius: 24,
      overflow: 'hidden',
      padding: SPACING.lg,
      justifyContent: 'space-between',
    },
    cardPattern1: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.heroOverlay,
      top: -50,
      right: -20,
    },
    cardPattern2: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.heroOverlay,
      bottom: -80,
      left: -40,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 1,
    },
    cardIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.heroText,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteAction: {
      padding: 6,
      backgroundColor: colors.overlayLight,
      borderRadius: 20,
    },
    cardMiddle: {
      zIndex: 1,
      marginTop: SPACING.sm,
    },
    cardBalanceLabel: {
      fontSize: 12,
      color: colors.heroTextMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardBalanceValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.heroText,
      marginTop: 4,
      letterSpacing: 1,
    },
    cardBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      zIndex: 1,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.heroText,
      maxWidth: 180,
    },
    cardType: {
      fontSize: 12,
      color: colors.heroTextMuted,
      marginTop: 2,
    },
    defaultPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.overlayLight,
      borderWidth: 1,
      borderColor: colors.heroTextMuted,
    },
    defaultPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.heroText,
      textTransform: 'uppercase',
    },
    emptyWrap: {
      marginHorizontal: SPACING.md,
      padding: SPACING.xl,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    emptyTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    emptySub: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
    infoSection: {
      marginTop: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: colors.bgCard,
      borderRadius: 20,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: SPACING.md,
      alignItems: 'center',
    },
    infoCardTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    infoCardText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
  });
}
