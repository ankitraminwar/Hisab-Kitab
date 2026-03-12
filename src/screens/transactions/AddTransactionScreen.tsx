import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { AccountService, CategoryService } from '@/services/dataServices';
import { TransactionService } from '@/services/transactionService';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type {
  Account,
  Category,
  PaymentMethod,
  TransactionType,
} from '@/utils/types';

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'upi',
  'wallet',
  'credit_card',
  'debit_card',
  'other',
];

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

export default function AddTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEditing = Boolean(id);

  const transactionTypes: {
    key: TransactionType;
    label: string;
    color: string;
  }[] = [
    { key: 'expense', label: 'Expense', color: colors.expense },
    { key: 'income', label: 'Income', color: colors.income },
    { key: 'transfer', label: 'Transfer', color: colors.transfer },
  ];

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedToAccount, setSelectedToAccount] = useState<Account | null>(
    null,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === type || category.type === 'both',
      ),
    [categories, type],
  );

  const loadData = useCallback(async () => {
    const [categoryRows, accountRows] = await Promise.all([
      CategoryService.getAll(),
      AccountService.getAll(),
    ]);
    setCategories(categoryRows);
    setAccounts(accountRows);
    setSelectedAccount((current) => current ?? accountRows[0] ?? null);
  }, []);

  const loadExisting = useCallback(async () => {
    if (!id) {
      return;
    }

    const transaction = await TransactionService.getById(id);
    if (!transaction) {
      return;
    }

    setType(transaction.type);
    setAmount(String(transaction.amount));
    setMerchant(transaction.merchant ?? '');
    setNotes(transaction.notes ?? '');
    setTags(transaction.tags.join(', '));
    setSelectedDate(new Date(transaction.date));
    setPaymentMethod(transaction.paymentMethod);
    setSelectedCategory(
      categories.find((category) => category.id === transaction.categoryId) ??
        null,
    );
    setSelectedAccount(
      accounts.find((account) => account.id === transaction.accountId) ?? null,
    );
    setSelectedToAccount(
      accounts.find((account) => account.id === transaction.toAccountId) ??
        null,
    );
  }, [accounts, categories, id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setSelectedCategory(null);
      return;
    }

    setSelectedCategory((current) => {
      if (
        current &&
        filteredCategories.some((category) => category.id === current.id)
      ) {
        return current;
      }

      return (
        filteredCategories.find((category) => category.name === 'Other') ??
        filteredCategories[0] ??
        null
      );
    });
  }, [filteredCategories]);

  useEffect(() => {
    if (categories.length > 0 && accounts.length > 0 && isEditing) {
      void loadExisting();
    }
  }, [accounts, categories, isEditing, loadExisting]);

  const onDateChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (value) {
      setSelectedDate(value);
    }
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Missing account', 'Choose an account for this transaction.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert(
        'Missing category',
        'Choose a category for this transaction.',
      );
      return;
    }
    if (type === 'transfer' && !selectedToAccount) {
      Alert.alert(
        'Missing destination',
        'Choose the destination account for this transfer.',
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: Number(amount),
        type,
        categoryId: selectedCategory.id,
        accountId: selectedAccount.id,
        toAccountId: type === 'transfer' ? selectedToAccount?.id : undefined,
        merchant: merchant.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        date: toDateString(selectedDate),
        paymentMethod,
        isRecurring: false,
      };

      if (isEditing && id) {
        await TransactionService.update(id, payload);
      } else {
        await TransactionService.create(payload);
      }
      router.back();
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Transaction could not be saved.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.typeSelector}>
            {transactionTypes.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.typeButton,
                  type === option.key && {
                    backgroundColor: option.color,
                    borderColor: option.color,
                  },
                ]}
                onPress={() => setType(option.key)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: colors.textMuted },
                    type === option.key && styles.typeButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>Rs</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={styles.amountInput}
            />
          </View>

          <SelectionSection label="Category" textMuted={colors.textMuted}>
            {filteredCategories.map((category) => (
              <Chip
                key={category.id}
                active={selectedCategory?.id === category.id}
                activeColor={category.color}
                baseColor={colors.textMuted}
                backgroundColor={colors.bgCard}
                borderColor={colors.border}
                icon={category.icon}
                label={category.name}
                onPress={() => setSelectedCategory(category)}
              />
            ))}
          </SelectionSection>

          <SelectionSection
            label={type === 'transfer' ? 'From account' : 'Account'}
            textMuted={colors.textMuted}
          >
            {accounts.map((account) => (
              <Chip
                key={account.id}
                active={selectedAccount?.id === account.id}
                activeColor={account.color}
                baseColor={colors.textMuted}
                backgroundColor={colors.bgCard}
                borderColor={colors.border}
                icon={account.icon}
                label={account.name}
                onPress={() => setSelectedAccount(account)}
              />
            ))}
          </SelectionSection>

          {type === 'transfer' ? (
            <SelectionSection label="To account" textMuted={colors.textMuted}>
              {accounts
                .filter((account) => account.id !== selectedAccount?.id)
                .map((account) => (
                  <Chip
                    key={account.id}
                    active={selectedToAccount?.id === account.id}
                    activeColor={account.color}
                    baseColor={colors.textMuted}
                    backgroundColor={colors.bgCard}
                    borderColor={colors.border}
                    icon={account.icon}
                    label={account.name}
                    onPress={() => setSelectedToAccount(account)}
                  />
                ))}
            </SelectionSection>
          ) : null}

          <SelectionSection label="Payment method" textMuted={colors.textMuted}>
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method}
                active={paymentMethod === method}
                activeColor={colors.primary}
                baseColor={colors.textMuted}
                backgroundColor={colors.bgCard}
                borderColor={colors.border}
                label={method
                  .replace('_', ' ')
                  .replace(/\b\w/g, (match) => match.toUpperCase())}
                onPress={() => setPaymentMethod(method)}
              />
            ))}
          </SelectionSection>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Details</Text>
            <InputField
              icon="calendar-outline"
              label="Date"
              value={toDateString(selectedDate)}
              onPress={() => setShowDatePicker(true)}
              colors={colors}
              isDark={isDark}
            />
            <InputField
              icon="storefront-outline"
              label="Merchant / Payee"
              value={merchant}
              onChangeText={setMerchant}
              colors={colors}
              isDark={isDark}
            />
            <InputField
              icon="pricetag-outline"
              label="Tags"
              value={tags}
              onChangeText={setTags}
              colors={colors}
              isDark={isDark}
            />
            <InputField
              icon="document-text-outline"
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              colors={colors}
              isDark={isDark}
            />
          </View>

          <Button
            title={isEditing ? 'Update Transaction' : 'Save Transaction'}
            onPress={() => void handleSave()}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      ) : null}
    </SafeAreaView>
  );
}

const SelectionSection = ({
  label,
  children,
  textMuted,
}: {
  label: string;
  children: React.ReactNode;
  textMuted: string;
}) => (
  <View style={baseStyles.section}>
    <Text style={[baseStyles.sectionLabel, { color: textMuted }]}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={baseStyles.chipRow}>{children}</View>
    </ScrollView>
  </View>
);

const Chip = ({
  active,
  activeColor,
  baseColor,
  backgroundColor,
  borderColor,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  activeColor: string;
  baseColor: string;
  backgroundColor: string;
  borderColor: string;
  icon?: string;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      baseStyles.chip,
      { backgroundColor, borderColor },
      active && {
        borderColor: activeColor,
        backgroundColor: `${activeColor}20`,
      },
    ]}
  >
    {icon ? (
      <Ionicons
        name={icon as never}
        size={16}
        color={active ? activeColor : baseColor}
      />
    ) : null}
    <Text
      style={[
        baseStyles.chipText,
        { color: baseColor },
        active && { color: activeColor },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const InputField = ({
  icon,
  label,
  value,
  onChangeText,
  multiline,
  onPress,
  colors,
  isDark,
}: {
  icon: string;
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  multiline?: boolean;
  onPress?: () => void;
  colors: {
    bgInput: string;
    border: string;
    primary: string;
    textMuted: string;
    textPrimary: string;
  };
  isDark: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.75 : 1}
    onPress={onPress}
    disabled={!onPress}
    style={[
      baseStyles.inputContainer,
      { backgroundColor: colors.bgInput, borderColor: colors.border },
    ]}
  >
    <Ionicons name={icon as never} size={18} color={colors.textMuted} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={!onPress}
      placeholder={label}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      keyboardAppearance={isDark ? 'dark' : 'light'}
      style={[
        baseStyles.input,
        { color: colors.textPrimary },
        multiline && baseStyles.multilineInput,
      ]}
      multiline={multiline}
    />
  </TouchableOpacity>
);

const baseStyles = StyleSheet.create({
  section: { marginBottom: SPACING.md },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
});

const createStyles = (colors: {
  bg: string;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgCard,
    },
    iconButtonPlaceholder: { width: 40, height: 40 },
    title: { ...TYPOGRAPHY.h3, color: colors.textPrimary },
    scroll: { padding: SPACING.md, paddingBottom: 40 },
    typeSelector: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.md,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      paddingVertical: 10,
    },
    typeButtonText: { ...TYPOGRAPHY.caption, fontWeight: '700' },
    typeButtonTextActive: { color: '#fff' },
    amountContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginVertical: SPACING.lg,
    },
    currencySymbol: {
      fontSize: 28,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    amountInput: {
      minWidth: 120,
      textAlign: 'center',
      color: colors.textPrimary,
      fontSize: 42,
      fontWeight: '800',
      letterSpacing: -1.5,
    },
    inputGroup: { marginBottom: SPACING.md },
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
    },
  });
