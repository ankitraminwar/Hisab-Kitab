import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomPopup } from '../../components/common';
import { showToast } from '../../components/common/Toast';
import { CategoryGrid } from '../../components/common/CategoryGrid';
import { NumericKeypad } from '../../components/common/NumericKeypad';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { AccountService, CategoryService, PaymentMethodService } from '../../services/dataServices';
import { TransactionService } from '../../services/transactionService';
import { RADIUS, SPACING } from '../../utils/constants';
import { transactionSchema } from '../../utils/validation';
import type {
  Account,
  Category,
  IoniconsName,
  PaymentMethod,
  TransactionType,
} from '../../utils/types';

/** YYYY-MM-DD date string for storage / DB operations — keeps format consistent across all writers */
const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth is zero-based
  const day = date.getDate();
  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${mm}-${dd}`;
};

/** User-friendly display string */
const formatDisplayDate = (date: Date): string => {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function AddTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEditing = Boolean(id);

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentMethods, setPaymentMethods] = useState<
    { id: string; name: string; icon: string }[]
  >([]);
  const [showPaymentMethodOptions, setShowPaymentMethodOptions] = useState(false);
  const [newPmName, setNewPmName] = useState('');
  const [showNewPmInput, setShowNewPmInput] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showToAccountPicker, setShowToAccountPicker] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedToAccount, setSelectedToAccount] = useState<Account | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const existingLoadedRef = useRef(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type || c.type === 'both'),
    [categories, type],
  );

  const loadData = useCallback(async () => {
    const [c, a, p] = await Promise.all([
      CategoryService.getAll(),
      AccountService.getAll(),
      PaymentMethodService.getAll(),
    ]);
    setCategories(c);
    setAccounts(a);
    setPaymentMethods(p);
    setSelectedAccount((current) => current ?? a[0] ?? null);
    setPaymentMethod((current) => current || p[0]?.name || 'Cash');
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
    if (categories.length > 0 && accounts.length > 0 && isEditing && !existingLoadedRef.current) {
      existingLoadedRef.current = true;
      void loadExisting();
    }
  }, [categories, accounts, isEditing, loadExisting]);

  // Pre-select category if none matches current type
  useEffect(() => {
    if (isEditing && existingLoadedRef.current) return;
    if (filteredCategories.length === 0) {
      setSelectedCategory(null);
      return;
    }
    setSelectedCategory((current) => {
      if (current && filteredCategories.some((c) => c.id === current.id)) return current;
      return filteredCategories.find((c) => c.name === 'Other') ?? filteredCategories[0] ?? null;
    });
  }, [filteredCategories, isEditing]);

  const handleDigit = (digit: string) => {
    setAmountStr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.' && prev.includes('.')) return prev;

      // If we're entering an operation rather than a digit
      if (digit === '+' || digit === '-') {
        // Safely evaluate expression if user hits operation again
        const sanitized = prev.replace(/[^0-9+\-.]/g, '');
        const tokens = sanitized.match(/[+\-]?[0-9]*\.?[0-9]+/g);
        if (tokens) {
          const evaled = tokens.reduce((sum, t) => sum + parseFloat(t), 0);
          if (!isNaN(evaled)) return String(evaled) + digit;
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
      // Safe arithmetic: only allow digits, +, -, .
      const sanitized = amountStr.replace(/[^0-9+\-.]/g, '');
      if (!sanitized) return 0;
      // Split by + and - while keeping the operators
      const tokens = sanitized.match(/[+\-]?[0-9]*\.?[0-9]+/g);
      if (!tokens) return 0;
      const val = tokens.reduce((sum, t) => sum + parseFloat(t), 0);
      return isNaN(val) ? 0 : Math.abs(val);
    } catch {
      return 0;
    }
  };

  const handleDone = async () => {
    const finalAmount = evaluateAmount();

    // Validate with zod schema
    const result = transactionSchema.safeParse({
      amount: finalAmount,
      type,
      categoryId: selectedCategory?.id ?? '',
      accountId: selectedAccount?.id ?? '',
      toAccountId: type === 'transfer' ? selectedToAccount?.id : undefined,
      notes: notes.trim() || undefined,
      date: toISODate(selectedDate),
      paymentMethod,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      setPopupConfig({
        visible: true,
        title: 'Validation Error',
        message: firstError?.message ?? 'Please check the form fields.',
        type: 'error',
      });
      return;
    }

    if (type === 'transfer' && !selectedToAccount) {
      setPopupConfig({
        visible: true,
        title: 'Missing destination',
        message: 'Choose the destination account for this transfer.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: finalAmount,
        type,
        categoryId: selectedCategory!.id,
        accountId: selectedAccount!.id,
        toAccountId: type === 'transfer' ? selectedToAccount?.id : undefined,
        notes: notes.trim() || undefined,
        date: toISODate(selectedDate),
        paymentMethod: paymentMethod as PaymentMethod,
        isRecurring: false,
        tags: [],
      };

      if (isEditing && id) {
        await TransactionService.update(id, payload);
      } else {
        await TransactionService.create(payload);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast.success(isEditing ? 'Transaction updated' : 'Transaction added');
      setPopupConfig({
        visible: true,
        title: 'Success',
        message: isEditing
          ? 'Transaction updated successfully.'
          : 'Transaction added successfully.',
        type: 'success',
        onClose: () => router.back(),
      });
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Transaction could not be saved. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!newPmName.trim()) return;
    setLoading(true);
    try {
      await PaymentMethodService.create(newPmName.trim());
      await loadData();
      setPaymentMethod(newPmName.trim());
      setNewPmName('');
      setShowNewPmInput(false);
      setShowPaymentMethodOptions(false);
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to add payment method.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Drag Handle */}
      <View style={styles.handleWrap}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                  {t?.charAt(0)?.toUpperCase() + t?.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

          <View style={styles.notesCard}>
            <View style={styles.notesInputWrap}>
              <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
              <TextInput
                value={notes}
                onChangeText={(text) => {
                  if (text.length <= 120) setNotes(text);
                }}
                placeholder="Add a note for this transaction"
                placeholderTextColor={colors.textMuted}
                style={styles.notesInput}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.notesCounter}>{notes.length}/120</Text>
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
            <TouchableOpacity style={styles.detailRow} onPress={() => setShowAccountPicker(true)}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="wallet" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>PAYMENT ACCOUNT</Text>
                <Text style={styles.detailText}>{selectedAccount?.name || 'Select Account'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Transfer: Destination Account */}
            {type === 'transfer' && (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => setShowToAccountPicker(true)}
              >
                <View style={[styles.detailIcon, { backgroundColor: colors.transfer + '20' }]}>
                  <Ionicons name="swap-horizontal" size={20} color={colors.transfer} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>DESTINATION ACCOUNT</Text>
                  <Text style={styles.detailText}>
                    {selectedToAccount?.name || 'Select Destination'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setShowPaymentMethodOptions(true)}
            >
              <View style={[styles.detailIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="card" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>PAYMENT METHOD</Text>
                <Text style={styles.detailText}>{paymentMethod || 'Select Method'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.detailRow} onPress={() => setShowDatePicker(true)}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>DATE</Text>
                <Text style={styles.detailText}>{formatDisplayDate(selectedDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Split This Expense */}
            {isEditing && type === 'expense' && (
              <TouchableOpacity
                style={styles.splitBtn}
                onPress={() => router.push(`/split-expense/new?txId=${id}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: colors.primary, marginLeft: 8 }]}>
                  Split This Expense
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onDone={() => void handleDone()}
        />
      </KeyboardAvoidingView>

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

      {/* Payment Method Selection Modal */}
      <Modal visible={showPaymentMethodOptions} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pmOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowPaymentMethodOptions(false);
            setShowNewPmInput(false);
          }}
        >
          <View
            style={{
              backgroundColor: colors.bgCard,
              margin: SPACING.xl,
              marginTop: 'auto',
              marginBottom: 'auto',
              borderRadius: RADIUS.lg,
              padding: SPACING.md,
              maxHeight: '60%',
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
              Select Payment Method
            </Text>
            <ScrollView>
              {paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm.id}
                  style={{
                    padding: SPACING.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setPaymentMethod(pm.name);
                    setShowPaymentMethodOptions(false);
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Ionicons name={pm.icon as IoniconsName} size={18} color={colors.textMuted} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: paymentMethod === pm.name ? '700' : '400',
                        color: paymentMethod === pm.name ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {pm.name}
                    </Text>
                  </View>
                  {paymentMethod === pm.name && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {!showNewPmInput ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: SPACING.md,
                  marginTop: SPACING.sm,
                }}
                onPress={() => setShowNewPmInput(true)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Add New Method</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ padding: SPACING.md, gap: 12 }}>
                <TextInput
                  placeholder="Method Name (e.g. Amazon Pay)"
                  placeholderTextColor={colors.textMuted}
                  value={newPmName}
                  onChangeText={setNewPmName}
                  autoFocus
                  style={{
                    backgroundColor: colors.bgElevated,
                    padding: 12,
                    borderRadius: RADIUS.md,
                    color: colors.textPrimary,
                    fontWeight: '600',
                  }}
                />
                <TouchableOpacity
                  onPress={() => void handleAddPaymentMethod()}
                  disabled={!newPmName.trim() || loading}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: RADIUS.md,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.heroText, fontWeight: '700' }}>Add & Select</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pmOverlay}
          activeOpacity={1}
          onPress={() => setShowAccountPicker(false)}
        >
          <View
            style={{
              backgroundColor: colors.bgCard,
              margin: SPACING.xl,
              marginTop: 'auto',
              marginBottom: 'auto',
              borderRadius: RADIUS.lg,
              padding: SPACING.md,
              maxHeight: '60%',
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
            <ScrollView>
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
                    setShowAccountPicker(false);
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Ionicons
                      name={(acc.icon || 'wallet') as IoniconsName}
                      size={18}
                      color={acc.color || colors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: selectedAccount?.id === acc.id ? '700' : '400',
                        color: selectedAccount?.id === acc.id ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {acc.name}
                    </Text>
                  </View>
                  {selectedAccount?.id === acc.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Destination Account Picker Modal (Transfer) */}
      <Modal visible={showToAccountPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pmOverlay}
          activeOpacity={1}
          onPress={() => setShowToAccountPicker(false)}
        >
          <View
            style={{
              backgroundColor: colors.bgCard,
              margin: SPACING.xl,
              marginTop: 'auto',
              marginBottom: 'auto',
              borderRadius: RADIUS.lg,
              padding: SPACING.md,
              maxHeight: '60%',
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
              Destination Account
            </Text>
            <ScrollView>
              {accounts
                .filter((acc) => acc.id !== selectedAccount?.id)
                .map((acc) => (
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
                      setSelectedToAccount(acc);
                      setShowToAccountPicker(false);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Ionicons
                        name={(acc.icon || 'wallet') as IoniconsName}
                        size={18}
                        color={acc.color || colors.textMuted}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: selectedToAccount?.id === acc.id ? '700' : '400',
                          color:
                            selectedToAccount?.id === acc.id ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {acc.name}
                      </Text>
                    </View>
                    {selectedToAccount?.id === acc.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Popup instead of Native Alert */}
      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => {
          setPopupConfig((prev) => ({ ...prev, visible: false }));
          if (popupConfig.onClose) {
            setTimeout(popupConfig.onClose, 300);
          }
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    handleWrap: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    closeBtn: {
      position: 'absolute',
      left: SPACING.md,
      zIndex: 10,
      padding: SPACING.sm,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    pmOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
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
    notesCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    notesInputWrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    notesInput: {
      flex: 1,
      minHeight: 24,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      paddingTop: 0,
      paddingBottom: 0,
    },
    notesCounter: {
      fontSize: 10,
      color: colors.textMuted,
      alignSelf: 'flex-end',
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
    splitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '10',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.primary + '25',
      marginTop: SPACING.sm,
    },
  });
