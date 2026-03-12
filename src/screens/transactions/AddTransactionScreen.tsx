import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import { AccountService, CategoryService } from '../../services/dataServices';
import { Button } from '../../components/common';
import { Account, Category, TransactionType } from '../../utils/types';

const TRANSACTION_TYPES: { key: TransactionType; label: string; color: string }[] = [
  { key: 'expense', label: 'Expense', color: COLORS.expense },
  { key: 'income', label: 'Income', color: COLORS.income },
  { key: 'transfer', label: 'Transfer', color: COLORS.transfer },
];

export default function AddTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedToAccount, setSelectedToAccount] = useState<Account | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [cats, accs] = await Promise.all([CategoryService.getAll(), AccountService.getAll()]);
    setCategories(cats.filter(c => c.type === type || c.type === 'both'));
    setAccounts(accs);
    if (accs.length > 0 && !selectedAccount) setSelectedAccount(accs[0]);
  }, [selectedAccount, type]);

  const loadExisting = useCallback(async () => {
    const tx = await TransactionService.getById(id!);
    if (!tx) return;
    setType(tx.type);
    setAmount(tx.amount.toString());
    setMerchant(tx.merchant || '');
    setNotes(tx.notes || '');
    setTags(tx.tags.join(', '));
    setDate(tx.date.slice(0, 10));
  }, [id]);

  useEffect(() => {
    void loadData();
    if (isEditing) {
      void loadExisting();
    }
  }, [isEditing, loadData, loadExisting]);

  useEffect(() => {
    setCategories(prev => {
      // Re-filter when type changes
      return prev;
    });
    CategoryService.getAll().then(cats =>
      setCategories(cats.filter(c => c.type === type || c.type === 'both'))
    );
  }, [type]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    if (type === 'transfer' && !selectedToAccount) {
      Alert.alert('Error', 'Please select destination account');
      return;
    }

    setLoading(true);
    try {
      const data = {
        amount: parseFloat(amount),
        type,
        categoryId: selectedCategory.id,
        accountId: selectedAccount.id,
        toAccountId: type === 'transfer' ? selectedToAccount?.id : undefined,
        merchant: merchant.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        date,
        isRecurring: false,
      };

      if (isEditing) {
        await TransactionService.update(id!, data);
      } else {
        await TransactionService.create(data);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const activeColor = TRANSACTION_TYPES.find(t => t.key === type)?.color || COLORS.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Transaction' : 'Add Transaction'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Type Selector */}
          <View style={styles.typeSelector}>
            {TRANSACTION_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => setType(t.key)}
              >
                <Text style={[styles.typeBtnText, type === t.key && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.amountInput, { color: activeColor }]}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catItem, selectedCategory?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '20' }]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Ionicons name={cat.icon as any} size={20} color={selectedCategory?.id === cat.id ? cat.color : COLORS.textMuted} />
                  <Text style={[styles.catName, selectedCategory?.id === cat.id && { color: cat.color }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{type === 'transfer' ? 'From Account' : 'Account'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accItem, selectedAccount?.id === acc.id && { borderColor: acc.color, backgroundColor: acc.color + '20' }]}
                  onPress={() => setSelectedAccount(acc)}
                >
                  <Ionicons name={acc.icon as any} size={16} color={selectedAccount?.id === acc.id ? acc.color : COLORS.textMuted} />
                  <Text style={[styles.accName, selectedAccount?.id === acc.id && { color: acc.color }]}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {type === 'transfer' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>To Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {accounts.filter(a => a.id !== selectedAccount?.id).map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accItem, selectedToAccount?.id === acc.id && { borderColor: acc.color, backgroundColor: acc.color + '20' }]}
                    onPress={() => setSelectedToAccount(acc)}
                  >
                    <Ionicons name={acc.icon as any} size={16} color={selectedToAccount?.id === acc.id ? acc.color : COLORS.textMuted} />
                    <Text style={[styles.accName, selectedToAccount?.id === acc.id && { color: acc.color }]}>{acc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Details */}
          <View style={styles.inputGroup}>
            <InputField icon="storefront-outline" placeholder="Merchant / Payee" value={merchant} onChangeText={setMerchant} />
            <InputField icon="calendar-outline" placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <InputField icon="pricetag-outline" placeholder="Tags (comma separated)" value={tags} onChangeText={setTags} />
            <InputField icon="document-text-outline" placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
          </View>

          <Button title={isEditing ? 'Update Transaction' : 'Save Transaction'} onPress={handleSave} loading={loading} style={styles.saveBtn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InputField: React.FC<{
  icon: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; multiline?: boolean;
}> = ({ icon, placeholder, value, onChangeText, multiline }) => (
  <View style={inputStyles.container}>
    <Ionicons name={icon as any} size={18} color={COLORS.textMuted} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      style={[inputStyles.input, multiline && { height: 72, textAlignVertical: 'top' }]}
      multiline={multiline}
    />
  </View>
);

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    minWidth: 100,
    textAlign: 'center',
  },
  section: { marginBottom: SPACING.md },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  categoryScroll: { marginHorizontal: -SPACING.sm },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    marginHorizontal: 4,
  },
  catName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    marginRight: 8,
  },
  accName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  inputGroup: { marginBottom: SPACING.md },
  saveBtn: { marginTop: SPACING.md },
});
