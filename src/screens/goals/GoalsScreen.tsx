import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, ProgressBar } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { GoalService } from '../../services/dataService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { Goal } from '../../utils/types';

const GOAL_COLORS = ['#7C3AED', '#06B6D4', '#22C55E', '#F97316', '#F43F5E', '#EAB308', '#EC4899'];
const GOAL_ICONS = [
  'flag',
  'home',
  'car',
  'airplane',
  'laptop',
  'gift',
  'heart',
  'school',
  'business',
  'medkit',
];

export default function GoalsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState('');

  useEffect(() => {
    void loadGoals();
  }, [dataRevision]);

  const loadGoals = async () => {
    const data = await GoalService.getAll();
    setGoals(
      data.sort((a, b) => {
        // Sort completed goals to the bottom
        const aDone = a.currentAmount >= a.targetAmount;
        const bDone = b.currentAmount >= b.targetAmount;
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        return (
          new Date(a.deadline || a.createdAt).getTime() -
          new Date(b.deadline || b.createdAt).getTime()
        );
      }),
    );
  };

  const handleFund = async () => {
    if (!selectedGoal || !fundAmount || Number(fundAmount) <= 0) return;

    await GoalService.addFunds(selectedGoal.id, Number(fundAmount));
    setFundAmount('');
    setSelectedGoal(null);
    void loadGoals();
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + Math.min(g.currentAmount, g.targetAmount), 0);
  const overallProgress = totalTarget > 0 ? totalSaved / totalTarget : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Savings Goals</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {goals.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.summaryTitle}>Total Saved</Text>
                  <Text style={styles.summaryAmount}>{formatCurrency(totalSaved)}</Text>
                </View>
                <View style={[styles.progressBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.progressBadgeText, { color: colors.primary }]}>
                    {Math.round(overallProgress * 100)}%
                  </Text>
                </View>
              </View>
              <ProgressBar progress={overallProgress} color={colors.primary} height={8} />
              <Text style={styles.summaryFooter}>of {formatCurrency(totalTarget)} target</Text>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          {goals.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              title="No goals set"
              subtitle="Set a savings goal to start tracking your progress."
              action="Create Goal"
              onAction={() => setShowAdd(true)}
            />
          ) : (
            <View style={styles.goalsList}>
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onFund={() => setSelectedGoal(goal)}
                  onDelete={() => {
                    Alert.alert('Delete Goal', `Are you sure you want to delete "${goal.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await GoalService.delete(goal.id);
                          void loadGoals();
                        },
                      },
                    ]);
                  }}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fund Goal Modal */}
      <Modal
        visible={!!selectedGoal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setSelectedGoal(null);
          setFundAmount('');
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              setSelectedGoal(null);
              setFundAmount('');
            }}
          >
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={{
                backgroundColor: colors.bgCard,
                borderRadius: RADIUS.xl,
                padding: SPACING.xl,
                width: '90%',
                alignSelf: 'center',
                marginTop: '30%',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: SPACING.sm,
                }}
              >
                <Text style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary }}>Add Funds</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedGoal(null);
                    setFundAmount('');
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  ...TYPOGRAPHY.body,
                  color: colors.textSecondary,
                  marginBottom: SPACING.lg,
                }}
              >
                Funding: {selectedGoal?.name}
              </Text>

              <TextInput
                style={{
                  backgroundColor: colors.bgInput,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: RADIUS.md,
                  padding: SPACING.md,
                  color: colors.textPrimary,
                  ...TYPOGRAPHY.body,
                  marginBottom: SPACING.lg,
                }}
                keyboardType="numeric"
                value={fundAmount}
                onChangeText={setFundAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                autoFocus
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />

              <Button title="Add Funds" onPress={() => void handleFund()} disabled={!fundAmount} />
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <AddGoalModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => {
          void loadGoals();
          setShowAdd(false);
        }}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const GoalCard = ({
  goal,
  onFund,
  onDelete,
  colors,
}: {
  goal: Goal;
  onFund: () => void;
  onDelete: () => void;
  colors: ThemeColors;
}) => {
  const styles = useMemo(() => cardStyles(colors), [colors]);
  const progress = goal.currentAmount / goal.targetAmount;
  const isCompleted = progress >= 1;
  const daysLeft = goal.deadline
    ? Math.max(0, differenceInDays(new Date(goal.deadline), new Date()))
    : 'No deadline';

  return (
    <Card style={{ ...styles.card, ...(isCompleted ? { opacity: 0.7 } : {}) }}>
      <View style={styles.header}>
        <View style={styles.iconInfo}>
          <View
            style={[styles.iconContainer, { backgroundColor: `${goal.color || colors.primary}15` }]}
          >
            <Ionicons
              name={(goal.icon || 'flag') as never}
              size={20}
              color={goal.color || colors.primary}
            />
          </View>
          <View>
            <Text style={styles.name}>{goal.name}</Text>
            <Text style={styles.deadline}>
              {isCompleted ? 'Completed 🎉' : `${daysLeft} days left`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressLabels}>
          <Text style={styles.current}>{formatCurrency(goal.currentAmount)}</Text>
          <Text style={styles.target}>
            {Math.round(progress * 100)}% of {formatCurrency(goal.targetAmount)}
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={isCompleted ? colors.income : goal.color || colors.primary}
          height={8}
        />
      </View>

      {!isCompleted && (
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <TouchableOpacity
            style={[styles.fundButton, { backgroundColor: colors.bgElevated, flex: 1 }]}
            onPress={onFund}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.fundText, { color: colors.primary }]}>Add Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fundButton, { backgroundColor: colors.bgElevated }]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={18} color={colors.expense} />
          </TouchableOpacity>
        </View>
      )}
      {isCompleted && (
        <TouchableOpacity
          style={[styles.fundButton, { backgroundColor: colors.bgElevated }]}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.expense} />
          <Text style={[styles.fundText, { color: colors.expense }]}>Delete</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
};

const AddGoalModal = ({
  visible,
  onClose,
  onSave,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  colors: ThemeColors;
  isDark: boolean;
}) => {
  const styles = useMemo(() => modalStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !targetAmount) return;

    setLoading(true);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6); // Default 6 months for now

    await GoalService.create({
      name,
      targetAmount: Number(targetAmount),
      currentAmount: 0,
      deadline: targetDate.toISOString().slice(0, 10),
      color,
      icon,
      isCompleted: false,
    });

    setLoading(false);
    setName('');
    setTargetAmount('');
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
            <Text style={styles.title}>New Goal</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Goal Name (e.g. New Car)"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.input}
                placeholder="Target Amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />

              <Text style={styles.label}>Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
                {GOAL_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      color === c && styles.selectedOption,
                    ]}
                  />
                ))}
              </ScrollView>

              <Text style={styles.label}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
                {GOAL_ICONS.map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setIcon(i)}
                    style={[
                      styles.iconOption,
                      { backgroundColor: colors.bgElevated },
                      icon === i && [styles.selectedOption, { borderColor: color }],
                    ]}
                  >
                    <Ionicons
                      name={i as never}
                      size={24}
                      color={icon === i ? color : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex1} />
                <Button
                  title="Save Goal"
                  onPress={() => void handleSave()}
                  loading={loading}
                  style={styles.flex1}
                  disabled={!name || !targetAmount}
                />
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { padding: SPACING.lg, marginBottom: SPACING.md },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    iconInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    deadline: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },
    progressContainer: { marginBottom: SPACING.md },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    current: { ...TYPOGRAPHY.h3, color: colors.textPrimary },
    target: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    fundButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: RADIUS.md,
      marginTop: SPACING.sm,
    },
    fundText: { fontSize: 13, fontWeight: '700' },
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
      maxHeight: '90%',
    },
    modalContent: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      width: '90%',
      alignSelf: 'center',
      top: '30%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.h2,
      color: colors.textPrimary,
      marginBottom: SPACING.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    modalTitle: { ...TYPOGRAPHY.h3, color: colors.textPrimary },
    modalSubtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginBottom: SPACING.lg,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      marginBottom: SPACING.lg,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
      marginTop: SPACING.md,
    },
    selector: { flexDirection: 'row', marginBottom: SPACING.md },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: SPACING.md,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedOption: { borderWidth: 3, borderColor: colors.textPrimary },
    actions: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.lg,
      marginBottom: SPACING.xl,
    },
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
    scroll: { paddingHorizontal: SPACING.md },
    summaryCard: {
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
      backgroundColor: colors.bgCard,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.lg,
    },
    summaryTitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    summaryAmount: { ...TYPOGRAPHY.h1, color: colors.textPrimary },
    progressBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    progressBadgeText: { fontSize: 12, fontWeight: '700' },
    summaryFooter: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: SPACING.sm,
      textAlign: 'right',
    },
    goalsList: { gap: SPACING.sm },
  });
