import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, ProgressBar, SectionHeader } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { BudgetService, CategoryService } from '../../services/dataService';
import { triggerBackgroundSync } from '../../services/syncService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { Budget, Category } from '../../utils/types';

export default function BudgetsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [b, c] = await Promise.all([
      BudgetService.getForMonth(year, month),
      CategoryService.getAll(),
    ]);
    setBudgets(b);
    setCategories(c.filter((cat) => cat.type === 'expense' || cat.type === 'both'));
  }, [month, year]);

  useEffect(() => {
    void loadData();
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerBackgroundSync('pull-to-refresh');
    await loadData();
    setRefreshing(false);
  };

  const totalBudget = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  const prevMonth = () => {
    const d = new Date(year, parseInt(month) - 2);
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  const nextMonth = () => {
    const d = new Date(year, parseInt(month));
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  const monthName = format(new Date(year, parseInt(month) - 1), 'MMMM yyyy');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.monthSelector}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthButton}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{monthName}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.monthButton}>
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Total Budget</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalBudget)}</Text>
            </View>
            <ProgressBar
              progress={totalBudget > 0 ? totalSpent / totalBudget : 0}
              color={
                totalSpent > totalBudget
                  ? colors.expense
                  : totalSpent > totalBudget * 0.8
                    ? colors.warning
                    : colors.primary
              }
              height={12}
            />
            <View style={styles.summaryFooter}>
              <Text style={styles.summarySpent}>Spent: {formatCurrency(totalSpent)}</Text>
              <Text style={styles.summaryRemaining}>
                Left: {formatCurrency(Math.max(0, totalBudget - totalSpent))}
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <SectionHeader title="Category Budgets" />

          {budgets.length === 0 ? (
            <EmptyState
              icon="pie-chart-outline"
              title="No budgets set"
              subtitle={`You haven't set any budgets for ${monthName}.`}
              action="Create Budget"
              onAction={() => setShowAdd(true)}
            />
          ) : (
            <View style={styles.budgetList}>
              {budgets.map((budget) => {
                const category = categories.find((c) => c.id === budget.categoryId);
                return (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    category={category}
                    colors={colors}
                    reload={loadData}
                  />
                );
              })}
            </View>
          )}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <AddBudgetModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        period={`${year}-${month}`}
        availableCategories={categories.filter((c) => !budgets.find((b) => b.categoryId === c.id))}
        onSave={() => {
          void loadData();
          setShowAdd(false);
        }}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const BudgetCard = ({
  budget,
  category,
  colors,
  reload,
}: {
  budget: Budget;
  category?: Category;
  colors: ThemeColors;
  reload: () => void;
}) => {
  const [showEdit, setShowEdit] = useState(false);
  const progress = budget.spent / budget.limitAmount;
  const isOver = progress >= 1;
  const isWarning = progress >= 0.8 && !isOver;
  const color = isOver
    ? colors.expense
    : isWarning
      ? colors.warning
      : category?.color || colors.primary;

  return (
    <>
      <TouchableOpacity onPress={() => setShowEdit(true)} activeOpacity={0.7}>
        <Card style={cardStyles.card}>
          <View style={cardStyles.header}>
            <View style={cardStyles.categoryInfo}>
              <View style={[cardStyles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Ionicons name={(category?.icon || 'folder') as never} size={20} color={color} />
              </View>
              <Text style={[cardStyles.categoryName, { color: colors.textPrimary }]}>
                {category?.name || 'Unknown'}
              </Text>
            </View>
            <Text style={[cardStyles.amount, { color: colors.textPrimary }]}>
              {formatCurrency(budget.limitAmount)}
            </Text>
          </View>

          <ProgressBar progress={progress} color={color} height={8} />

          <View style={cardStyles.footer}>
            <Text style={[cardStyles.spent, { color: colors.textSecondary }]}>
              {formatCurrency(budget.spent)} spent
            </Text>
            <Text
              style={[
                cardStyles.remaining,
                { color: isOver ? colors.expense : colors.textPrimary },
              ]}
            >
              {isOver
                ? `${formatCurrency(budget.spent - budget.limitAmount)} over`
                : `${formatCurrency(budget.limitAmount - budget.spent)} left`}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>

      <EditBudgetModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        budget={budget}
        category={category}
        onSave={() => {
          reload();
          setShowEdit(false);
        }}
        colors={colors}
      />
    </>
  );
};

const AddBudgetModal = ({
  visible,
  onClose,
  period,
  availableCategories,
  onSave,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  period: string;
  availableCategories: Category[];
  onSave: () => void;
  colors: ThemeColors;
  isDark: boolean;
}) => {
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => modalStyles(colors), [colors]);

  const handleSave = async () => {
    if (!categoryId || !amount || Number(amount) <= 0) return;
    setLoading(true);
    const [year, month] = period.split('-');

    await BudgetService.create({
      month,
      year: Number(year),
      categoryId,
      limitAmount: Number(amount),
      alertAt: Number(amount) * 0.8,
    });
    setLoading(false);
    setAmount('');
    setCategoryId('');
    onSave();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>New Budget</Text>

            <Text style={styles.label}>Select Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[
                    styles.categoryChip,
                    categoryId === cat.id && {
                      backgroundColor: cat.color + '20',
                      borderColor: cat.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as never}
                    size={16}
                    color={categoryId === cat.id ? cat.color : colors.textMuted}
                  />
                  <Text
                    style={[styles.categoryChipText, categoryId === cat.id && { color: cat.color }]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Monthly Limit</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />

            <View style={styles.actions}>
              <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex1} />
              <Button
                title="Save"
                onPress={() => void handleSave()}
                loading={loading}
                style={styles.flex1}
                disabled={!categoryId || !amount}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const EditBudgetModal = ({
  visible,
  onClose,
  budget,
  category,
  onSave,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  budget: Budget;
  category?: Category;
  onSave: () => void;
  colors: ThemeColors;
}) => {
  const [amount, setAmount] = useState(String(budget.limitAmount));
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => modalStyles(colors), [colors]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    await BudgetService.update(budget.id, { limitAmount: Number(amount) });
    setLoading(false);
    onSave();
  };

  const handleDelete = async () => {
    setLoading(true);
    await BudgetService.delete(budget.id);
    setLoading(false);
    onSave();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>Edit Budget</Text>
            <Text style={styles.subtitle}>{category?.name}</Text>

            <Text style={styles.label}>Monthly Limit</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <View style={styles.actions}>
              <Button
                title="Delete"
                variant="danger"
                onPress={() => void handleDelete()}
                style={styles.flex1}
              />
              <Button
                title="Update"
                onPress={() => void handleSave()}
                loading={loading}
                style={styles.flex1}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cardStyles = StyleSheet.create({
  card: { padding: SPACING.md, marginBottom: SPACING.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: { ...TYPOGRAPHY.body, fontWeight: '600' },
  amount: { ...TYPOGRAPHY.body, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  spent: { ...TYPOGRAPHY.caption },
  remaining: { ...TYPOGRAPHY.caption, fontWeight: '600' },
});

const modalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      padding: SPACING.lg,
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
    subtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginBottom: SPACING.lg,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    categories: { flexDirection: 'row', marginBottom: SPACING.lg },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: RADIUS.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SPACING.sm,
    },
    categoryChipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      marginBottom: SPACING.xl,
    },
    actions: { flexDirection: 'row', gap: SPACING.md },
    flex1: { flex: 1 },
  });

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
    },
    title: { ...TYPOGRAPHY.h2, color: colors.textPrimary },
    addButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary + '15',
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    monthButton: { padding: SPACING.xs },
    monthText: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    scroll: { paddingHorizontal: SPACING.md },
    summaryCard: {
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary + '30',
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: SPACING.md,
    },
    summaryTitle: { ...TYPOGRAPHY.body, color: colors.textSecondary },
    summaryAmount: { ...TYPOGRAPHY.h2, color: colors.textPrimary },
    summaryFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
    },
    summarySpent: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    summaryRemaining: {
      ...TYPOGRAPHY.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    budgetList: { gap: SPACING.md },
  });
