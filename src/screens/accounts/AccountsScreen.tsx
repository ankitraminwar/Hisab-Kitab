import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  formatCurrency,
} from '../../utils/constants';
import { useTheme } from '../../hooks/useTheme';
import { AccountService } from '../../services/dataServices';
import { Account, AccountType } from '../../utils/types';
import { Card, Button } from '../../components/common';
import { useAppStore } from '../../store/appStore';

const ACCOUNT_TYPES: {
  key: AccountType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'cash', label: 'Cash', icon: 'cash', color: '#22C55E' },
  { key: 'bank', label: 'Bank', icon: 'business', color: '#3B82F6' },
  { key: 'upi', label: 'UPI', icon: 'phone-portrait', color: '#8B5CF6' },
  { key: 'credit_card', label: 'Credit Card', icon: 'card', color: '#F43F5E' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet', color: '#F97316' },
  {
    key: 'investment',
    label: 'Investment',
    icon: 'trending-up',
    color: '#06B6D4',
  },
];

const ACCOUNT_COLORS = [
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#F43F5E',
  '#F97316',
  '#06B6D4',
  '#EAB308',
  '#EC4899',
];

export default function AccountsScreen() {
  const { colors } = useTheme();
  const dataRevision = useAppStore((state) => state.dataRevision);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [dataRevision]);

  const loadAccounts = async () => {
    const data = await AccountService.getAll();
    setAccounts(data);
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance */}
        <Card style={styles.totalCard} glow>
          <Text style={styles.totalLabel}>TOTAL BALANCE</Text>
          <Text
            style={[
              styles.totalAmount,
              {
                color: totalBalance >= 0 ? colors.textPrimary : colors.expense,
              },
            ]}
          >
            {formatCurrency(totalBalance)}
          </Text>
          <Text style={styles.totalSub}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </Text>
        </Card>

        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onDelete={async () => {
              await AccountService.delete(account.id);
              loadAccounts();
            }}
          />
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <AddAccountModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => {
          loadAccounts();
          setShowAdd(false);
        }}
      />
    </SafeAreaView>
  );
}

const AccountCard: React.FC<{ account: Account; onDelete: () => void }> = ({
  account,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const typeInfo = ACCOUNT_TYPES.find((t) => t.key === account.type);

  return (
    <Card style={styles.accountCard}>
      <View style={styles.accountRow}>
        <View
          style={[
            styles.accountIcon,
            { backgroundColor: account.color + '20' },
          ]}
        >
          <Ionicons
            name={account.icon as any}
            size={22}
            color={account.color}
          />
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountType}>
            {typeInfo?.label || account.type} • {account.currency}
          </Text>
        </View>
        <View style={styles.accountRight}>
          <Text
            style={[
              styles.accountBalance,
              {
                color:
                  account.balance >= 0 ? colors.textPrimary : colors.expense,
              },
            ]}
          >
            {formatCurrency(account.balance)}
          </Text>
          {account.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        {!account.isDefault && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const AddAccountModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}> = ({ visible, onClose, onSave }) => {
  const { colors } = useTheme();
  const mStyles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setLoading(true);
    const typeInfo = ACCOUNT_TYPES.find((t) => t.key === type);
    await AccountService.create({
      name,
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Add Account</Text>

          <Text style={mStyles.label}>Account Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: SPACING.md }}
          >
            {ACCOUNT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={[
                  mStyles.typeChip,
                  type === t.key && {
                    backgroundColor: t.color,
                    borderColor: t.color,
                  },
                ]}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={type === t.key ? '#fff' : colors.textMuted}
                />
                <Text
                  style={[
                    mStyles.typeLabel,
                    type === t.key && { color: '#fff' },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Account name (e.g. HDFC Savings)"
            placeholderTextColor={colors.textMuted}
            style={mStyles.input}
          />
          <TextInput
            value={balance}
            onChangeText={setBalance}
            keyboardType="numeric"
            placeholder="Opening balance (₹)"
            placeholderTextColor={colors.textMuted}
            style={mStyles.input}
          />

          <Text style={mStyles.label}>Color</Text>
          <View style={mStyles.colorRow}>
            {ACCOUNT_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[
                  mStyles.colorDot,
                  {
                    backgroundColor: c,
                    borderWidth: color === c ? 3 : 0,
                    borderColor: '#fff',
                  },
                ]}
              />
            ))}
          </View>

          <View style={mStyles.actions}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <Button
              title="Add Account"
              onPress={handleSave}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

function createModalStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: 40,
      borderWidth: 1,
      borderColor: colors.border,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      marginBottom: SPACING.md,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      marginRight: 8,
    },
    typeLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    colorRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    actions: { flexDirection: 'row', gap: SPACING.sm },
  });
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    title: { ...TYPOGRAPHY.h2, color: colors.textPrimary },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    scroll: { paddingHorizontal: SPACING.md },
    totalCard: {
      marginBottom: SPACING.lg,
      alignItems: 'center',
      borderColor: colors.primary + '40',
      backgroundColor: colors.primary + '08',
    },
    totalLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    totalAmount: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -1,
      marginVertical: 6,
    },
    totalSub: { ...TYPOGRAPHY.caption, color: colors.textMuted },
    accountCard: { marginBottom: SPACING.sm },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    accountIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountInfo: { flex: 1 },
    accountName: { ...TYPOGRAPHY.bodyMedium, color: colors.textPrimary },
    accountType: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    accountRight: { alignItems: 'flex-end', gap: 4 },
    accountBalance: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
    defaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.primary + '20',
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    defaultText: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '600',
      fontSize: 10,
    },
    deleteBtn: { padding: 4 },
  });
}
