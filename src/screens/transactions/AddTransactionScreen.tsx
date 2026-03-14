import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { NumericKeypad } from '@/components/common/NumericKeypad';
import { CategoryGrid } from '@/components/common/CategoryGrid';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { AccountService, CategoryService } from '@/services/dataServices';
import { TransactionService } from '@/services/transactionService';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '@/utils/constants';
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

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAccountOptions, setShowAccountOptions] = useState(false);
  const [selectedToAccount, setSelectedToAccount] = useState<Account | null>(
    null,
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type || c.type === 'both'),
    [categories, type],
  );

  const loadData = useCallback(async () => {
    const [c, a] = await Promise.all([
      CategoryService.getAll(),
      AccountService.getAll(),
    ]);
    setCategories(c);
    setAccounts(a);
    setSelectedAccount((current) => current ?? a[0] ?? null);
  }, []);

  const loadExisting = useCallback(async () => {
    if (!id) return;
    const tx = await TransactionService.getById(id);
    if (!tx) return;

    setType(tx.type);
    setAmountStr(String(tx.amount));
    setNotes(tx.notes ?? '');
    setSelectedDate(new Date(tx.date));
    setPaymentMethod(tx.paymentMethod);
    setSelectedCategory(categories.find((c) => c.id === tx.categoryId) ?? null);
    setSelectedAccount(accounts.find((a) => a.id === tx.accountId) ?? null);
    setSelectedToAccount(accounts.find((a) => a.id === tx.toAccountId) ?? null);
  }, [categories, accounts, id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (categories.length > 0 && accounts.length > 0 && isEditing) {
      void loadExisting();
    }
  }, [categories, accounts, isEditing, loadExisting]);

  // Pre-select category if none matches current type
  useEffect(() => {
    if (filteredCategories.length === 0) {
      setSelectedCategory(null);
      return;
    }
    setSelectedCategory((current) => {
      if (current && filteredCategories.some((c) => c.id === current.id))
        return current;
      return (
        filteredCategories.find((c) => c.name === 'Other') ??
        filteredCategories[0] ??
        null
      );
    });
  }, [filteredCategories]);

  const handleDigit = (digit: string) => {
    setAmountStr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.' && prev.includes('.')) return prev;

      // If we're entering an operation rather than a digit
      if (digit === '+' || digit === '-') {
        // evaluate expression if user hits operation again
        try {
          const evaled = eval(prev);
          if (!isNaN(evaled)) return String(evaled) + digit;
        } catch {
          return prev;
        }
      }
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const evaluateAmount = (): number => {
    try {
      // Evaluate simple math if they used +/- keys
      const val = eval(amountStr);
      return isNaN(val) ? 0 : val;
    } catch {
      return 0;
    }
  };

  const handleDone = async () => {
    const finalAmount = evaluateAmount();
    if (finalAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Missing account', 'Choose an account.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Missing category', 'Choose a category.');
      return;
    }
    if (type === 'transfer' && !selectedToAccount) {
      Alert.alert('Missing destination', 'Choose the destination account.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: finalAmount,
        type,
        categoryId: selectedCategory.id,
        accountId: selectedAccount.id,
        toAccountId: type === 'transfer' ? selectedToAccount?.id : undefined,
        notes: notes.trim() || undefined,
        date: toDateString(selectedDate),
        paymentMethod,
        isRecurring: false,
        tags: [],
      };

      if (isEditing && id) {
        await TransactionService.update(id, payload);
      } else {
        await TransactionService.create(payload);
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Transaction could not be saved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.modalBg}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Modal Handle */}
        <View style={styles.handleWrap}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: 'absolute', left: 20, zIndex: 10, padding: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.handle} />
        </View>

        {/* Type Toggle */}
        <View style={styles.toggleWrap}>
          <View style={styles.toggleBg}>
            {(['expense', 'income', 'transfer'] as const).map((t) => {
              const isActive = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      isActive && {
                        color:
                          t === 'expense'
                            ? colors.expense
                            : t === 'income'
                              ? colors.income
                              : colors.primary,
                      },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Big Amount */}
          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>ENTER AMOUNT</Text>
            <Text style={styles.amountValue}>
              {amountStr === '0' || amountStr === ''
                ? '₹0'
                : amountStr.startsWith('₹')
                  ? amountStr
                  : `₹${amountStr}`}
            </Text>
          </View>

          {/* Categories Grid */}
          <CategoryGrid
            categories={filteredCategories}
            selectedId={selectedCategory?.id}
            onSelect={setSelectedCategory}
            columns={4}
          />

          {/* Details */}
          <View style={styles.detailsWrap}>
            {/* Account */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setShowAccountOptions(true)}
            >
              <View
                style={[
                  styles.detailIcon,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Ionicons name="wallet" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>PAYMENT ACCOUNT</Text>
                <Text style={styles.detailText}>
                  {selectedAccount?.name || 'Select Account'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.halfRows}>
              <TouchableOpacity
                style={styles.halfRow}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.textMuted} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>DATE</Text>
                  <Text style={styles.detailText}>
                    {toDateString(selectedDate) === toDateString(new Date())
                      ? 'Today'
                      : toDateString(selectedDate)}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.halfRow}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.textMuted}
                />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>NOTES</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.detailText, { padding: 0 }]}
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onDone={() => void handleDone()}
        />

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS !== 'ios') setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}

        {/* Account Selection Modal */}
        <Modal visible={showAccountOptions} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBg}
            activeOpacity={1}
            onPress={() => setShowAccountOptions(false)}
          >
            <View
              style={{
                backgroundColor: colors.bg,
                margin: SPACING.xl,
                marginTop: 'auto',
                marginBottom: 'auto',
                borderRadius: RADIUS.lg,
                padding: SPACING.md,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  marginBottom: SPACING.md,
                  paddingHorizontal: SPACING.xs,
                }}
              >
                Select Account
              </Text>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={{
                    padding: SPACING.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setSelectedAccount(acc);
                    setShowAccountOptions(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight:
                        selectedAccount?.id === acc.id ? '700' : '400',
                      color:
                        selectedAccount?.id === acc.id
                          ? colors.primary
                          : colors.textPrimary,
                    }}
                  >
                    {acc.name}
                  </Text>
                  {selectedAccount?.id === acc.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      marginTop: 40,
    },
    handleWrap: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    handle: {
      width: 48,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    toggleWrap: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    toggleBg: {
      flexDirection: 'row',
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.lg,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleBtn: {
      flex: 1,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.md,
    },
    toggleBtnActive: { backgroundColor: colors.bgCard },
    toggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    scroll: { flex: 1 },
    amountWrap: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
    amountLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: colors.textMuted,
      marginBottom: 8,
    },
    amountValue: {
      fontSize: 56,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1.5,
    },
    detailsWrap: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.md,
    },
    detailIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailContent: { flex: 1 },
    detailLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    detailText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
    halfRows: { flexDirection: 'row', gap: SPACING.md },
    halfRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
  });
