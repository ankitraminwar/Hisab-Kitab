import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import { BudgetService, CategoryService } from '../../services/dataServices';
import { Budget, Category } from '../../utils/types';
import { Card, ProgressBar, SectionHeader, EmptyState, Button } from '../../components/common';
import { format } from 'date-fns';

export default function BudgetsScreen() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    const [b, c] = await Promise.all([
      BudgetService.getForMonth(year, month),
      CategoryService.getAll(),
    ]);
    setBudgets(b);
    setCategories(c.filter(cat => cat.type === 'expense' || cat.type === 'both'));
  };

  const totalBudget = budgets.reduce((s, b) => s + b.limit_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  const prevMonth = () => {
    const d = new Date(year, parseInt(month) - 2, 1);
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  const nextMonth = () => {
    const d = new Date(year, parseInt(month), 1);
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Month Picker */}
      <View style={styles.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {format(new Date(year, parseInt(month) - 1), 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        {budgets.length > 0 && (
          <Card style={styles.summaryCard} glow>
            <Text style={styles.summaryTitle}>Monthly Budget Overview</Text>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Total Budget</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalBudget)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={[styles.summaryValue, {
                  color: totalSpent > totalBudget ? COLORS.expense : COLORS.income
                }]}>{formatCurrency(totalSpent)}</Text>
              </View>
            </View>
            <ProgressBar
              progress={totalBudget > 0 ? totalSpent / totalBudget : 0}
              height={10}
              style={{ marginTop: SPACING.sm }}
            />
            <Text style={styles.summaryRemaining}>
              {formatCurrency(Math.max(0, totalBudget - totalSpent))} remaining
            </Text>
          </Card>
        )}

        {budgets.length === 0 ? (
          <EmptyState
            icon="pie-chart-outline"
            title="No budgets set"
            subtitle="Create budgets to track your spending"
            action="Create Budget"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <>
            <SectionHeader title="Category Budgets" />
            {budgets.map(budget => (
              <BudgetCard key={budget.id} budget={budget} onDelete={async () => {
                await BudgetService.delete(budget.id);
                loadData();
              }} />
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <AddBudgetModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        categories={categories}
        existingCategoryIds={budgets.map(b => b.categoryId)}
        year={year}
        month={month}
        onSave={async () => { await loadData(); setShowAdd(false); }}
      />
    </SafeAreaView>
  );
}

const BudgetCard: React.FC<{ budget: Budget; onDelete: () => void }> = ({ budget, onDelete }) => {
  const progress = budget.limit_amount > 0 ? budget.spent / budget.limit_amount : 0;
  const remaining = budget.limit_amount - budget.spent;
  const isOver = remaining < 0;

  return (
    <Card style={styles.budgetCard}>
      <View style={styles.budgetTop}>
        <View style={styles.budgetLeft}>
          <View style={[styles.catIcon, { backgroundColor: (budget.categoryColor || COLORS.primary) + '20' }]}>
            <Ionicons name={(budget.categoryIcon || 'ellipse') as any} size={18} color={budget.categoryColor || COLORS.primary} />
          </View>
          <View>
            <Text style={styles.budgetName}>{budget.categoryName}</Text>
            <Text style={styles.budgetSub}>
              {(progress * 100).toFixed(0)}% used
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.budgetSpent, { color: isOver ? COLORS.expense : COLORS.textPrimary }]}>
            {formatCurrency(budget.spent)}
          </Text>
          <Text style={styles.budgetLimit}>of {formatCurrency(budget.limit_amount)}</Text>
        </View>
      </View>

      <ProgressBar progress={progress} height={6} style={{ marginVertical: SPACING.sm }} />

      <View style={styles.budgetFooter}>
        <Text style={[styles.budgetRemaining, { color: isOver ? COLORS.expense : COLORS.income }]}>
          {isOver ? `₹${Math.abs(remaining).toFixed(0)} over budget` : `₹${remaining.toFixed(0)} left`}
        </Text>
        <TouchableOpacity onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const AddBudgetModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  existingCategoryIds: string[];
  year: number;
  month: string;
  onSave: () => void;
}> = ({ visible, onClose, categories, existingCategoryIds, year, month, onSave }) => {
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const available = categories.filter(c => !existingCategoryIds.includes(c.id));

  const handleSave = async () => {
    if (!selectedCat || !limit || parseFloat(limit) <= 0) return;
    setLoading(true);
    await BudgetService.create({
      categoryId: selectedCat.id,
      limit_amount: parseFloat(limit),
      month,
      year,
      alertAt: 80,
    });
    setLoading(false);
    setSelectedCat(null);
    setLimit('');
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Add Budget</Text>

          <Text style={modalStyles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            {available.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[modalStyles.catChip, selectedCat?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '20' }]}
                onPress={() => setSelectedCat(cat)}
              >
                <Ionicons name={cat.icon as any} size={16} color={selectedCat?.id === cat.id ? cat.color : COLORS.textMuted} />
                <Text style={[modalStyles.catName, selectedCat?.id === cat.id && { color: cat.color }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={modalStyles.label}>Monthly Limit (₹)</Text>
          <TextInput
            value={limit}
            onChangeText={setLimit}
            keyboardType="numeric"
            placeholder="5000"
            placeholderTextColor={COLORS.textMuted}
            style={modalStyles.input}
          />

          <View style={modalStyles.actions}>
            <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
            <Button title="Save Budget" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  label: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgElevated,
    marginRight: 8,
  },
  catName: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthLabel: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, minWidth: 140, textAlign: 'center' },
  scroll: { paddingHorizontal: SPACING.md },
  summaryCard: { marginBottom: SPACING.lg, gap: SPACING.sm },
  summaryTitle: { ...TYPOGRAPHY.label, color: COLORS.textMuted, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  summaryValue: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontWeight: '700' },
  summaryRemaining: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4 },
  budgetCard: { marginBottom: SPACING.sm },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  catIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  budgetName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  budgetSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  budgetSpent: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
  budgetLimit: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetRemaining: { ...TYPOGRAPHY.caption, fontWeight: '600' },
});
