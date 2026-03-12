import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import { GoalService } from '../../services/dataServices';
import { Goal } from '../../utils/types';
import { Card, ProgressBar, EmptyState, Button } from '../../components/common';
import { differenceInDays } from 'date-fns';

const GOAL_COLORS = ['#7C3AED', '#06B6D4', '#22C55E', '#F97316', '#F43F5E', '#EAB308', '#EC4899'];
const GOAL_ICONS = ['flag', 'home', 'car', 'airplane', 'laptop', 'gift', 'heart', 'school', 'business', 'medkit'];

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState('');

  useEffect(() => { loadGoals(); }, []);

  const loadGoals = async () => {
    const data = await GoalService.getAll();
    setGoals(data);
  };

  const handleAddFunds = async () => {
    if (!selectedGoal || !fundAmount || parseFloat(fundAmount) <= 0) return;
    await GoalService.addFunds(selectedGoal.id, parseFloat(fundAmount));
    setSelectedGoal(null);
    setFundAmount('');
    loadGoals();
  };

  const active = goals.filter(g => !g.isCompleted);
  const completed = goals.filter(g => g.isCompleted);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Savings Goals</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        {goals.length > 0 && (
          <View style={styles.summaryRow}>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Active Goals</Text>
              <Text style={styles.summaryValue}>{active.length}</Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Target</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(goals.reduce((s, g) => s + g.targetAmount, 0))}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Saved</Text>
              <Text style={[styles.summaryValue, { color: COLORS.income }]}>
                {formatCurrency(goals.reduce((s, g) => s + g.currentAmount, 0))}
              </Text>
            </Card>
          </View>
        )}

        {active.length === 0 && completed.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No savings goals"
            subtitle="Set a goal and start saving towards it"
            action="Create Goal"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <>
            {active.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Active Goals</Text>
                {active.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onAddFunds={() => setSelectedGoal(goal)}
                    onDelete={async () => { await GoalService.delete(goal.id); loadGoals(); }}
                  />
                ))}
              </>
            )}
            {completed.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Completed 🎉</Text>
                {completed.map(goal => (
                  <GoalCard key={goal.id} goal={goal} completed />
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Funds Modal */}
      <Modal visible={!!selectedGoal} transparent animationType="slide" onRequestClose={() => setSelectedGoal(null)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>Add Funds to {selectedGoal?.name}</Text>
            <Text style={modalStyles.goalInfo}>
              {formatCurrency(selectedGoal?.currentAmount || 0)} / {formatCurrency(selectedGoal?.targetAmount || 0)}
            </Text>
            <TextInput
              value={fundAmount}
              onChangeText={setFundAmount}
              keyboardType="numeric"
              placeholder="Amount (₹)"
              placeholderTextColor={COLORS.textMuted}
              style={modalStyles.input}
            />
            <View style={modalStyles.actions}>
              <Button title="Cancel" onPress={() => setSelectedGoal(null)} variant="ghost" style={{ flex: 1 }} />
              <Button title="Add Funds" onPress={handleAddFunds} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <AddGoalModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={() => { loadGoals(); setShowAdd(false); }} />
    </SafeAreaView>
  );
}

const GoalCard: React.FC<{ goal: Goal; onAddFunds?: () => void; onDelete?: () => void; completed?: boolean }> = ({
  goal, onAddFunds, onDelete, completed
}) => {
  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null;

  return (
    <Card style={styles.goalCard}>
      <View style={styles.goalTop}>
        <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
          <Ionicons name={goal.icon as any} size={22} color={goal.color} />
        </View>
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          {daysLeft !== null && !completed && (
            <Text style={[styles.goalDeadline, { color: daysLeft < 30 ? COLORS.warning : COLORS.textMuted }]}>
              {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
            </Text>
          )}
          {completed && <Text style={{ color: COLORS.income, ...TYPOGRAPHY.caption }}>✓ Completed!</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.goalAmount, { color: goal.color }]}>{formatCurrency(goal.currentAmount)}</Text>
          <Text style={styles.goalTarget}>of {formatCurrency(goal.targetAmount)}</Text>
        </View>
      </View>

      <ProgressBar progress={progress} color={goal.color} height={8} style={{ marginVertical: SPACING.sm }} />

      <View style={styles.goalFooter}>
        <Text style={styles.goalPercent}>{(progress * 100).toFixed(1)}% saved</Text>
        {!completed && (
          <View style={styles.goalActions}>
            <TouchableOpacity onPress={onAddFunds} style={[styles.goalBtn, { backgroundColor: goal.color + '20', borderColor: goal.color + '40' }]}>
              <Ionicons name="add" size={14} color={goal.color} />
              <Text style={[styles.goalBtnText, { color: goal.color }]}>Add Funds</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

const AddGoalModal: React.FC<{ visible: boolean; onClose: () => void; onSave: () => void }> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !target) return;
    setLoading(true);
    await GoalService.create({
      name,
      targetAmount: parseFloat(target),
      currentAmount: 0,
      deadline: deadline || undefined,
      icon,
      color,
      isCompleted: false,
    });
    setLoading(false);
    setName(''); setTarget(''); setDeadline('');
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { maxHeight: '90%' }]}>
          <View style={modalStyles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.title}>New Savings Goal</Text>

            <TextInput value={name} onChangeText={setName} placeholder="Goal name (e.g. Emergency Fund)" placeholderTextColor={COLORS.textMuted} style={modalStyles.input} />
            <TextInput value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="Target amount (₹)" placeholderTextColor={COLORS.textMuted} style={modalStyles.input} />
            <TextInput value={deadline} onChangeText={setDeadline} placeholder="Deadline (YYYY-MM-DD, optional)" placeholderTextColor={COLORS.textMuted} style={modalStyles.input} />

            <Text style={modalStyles.label}>Color</Text>
            <View style={modalStyles.colorRow}>
              {GOAL_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setColor(c)} style={[modalStyles.colorDot, { backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: '#fff' }]} />
              ))}
            </View>

            <Text style={modalStyles.label}>Icon</Text>
            <View style={modalStyles.iconRow}>
              {GOAL_ICONS.map(ic => (
                <TouchableOpacity key={ic} onPress={() => setIcon(ic)} style={[modalStyles.iconBtn, icon === ic && { backgroundColor: color, borderColor: color }]}>
                  <Ionicons name={ic as any} size={20} color={icon === ic ? '#fff' : COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={[modalStyles.actions, { marginTop: SPACING.md }]}>
              <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
              <Button title="Create Goal" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  goalInfo: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginBottom: SPACING.md },
  label: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md, padding: SPACING.md,
    color: COLORS.textPrimary, ...TYPOGRAPHY.body, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '20',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  scroll: { paddingHorizontal: SPACING.md },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },
  summaryValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  goalCard: { marginBottom: SPACING.sm },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalInfo: { flex: 1 },
  goalName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  goalDeadline: { ...TYPOGRAPHY.caption },
  goalAmount: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
  goalTarget: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalPercent: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  goalActions: { flexDirection: 'row', gap: 8 },
  goalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1,
  },
  goalBtnText: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
});
