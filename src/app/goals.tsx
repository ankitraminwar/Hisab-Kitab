import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createGoal, getGoals, GoalEntity } from '@/modules/goals/goalsService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<GoalEntity[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('0');
  const [current, setCurrent] = useState('0');
  const [deadline, setDeadline] = useState('');
  const theme = useTheme();

  const refresh = async () => setGoals(await getGoals());
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name || Number(target) <= 0) { Alert.alert('Validation', 'Goal name and target required'); return; }
    await createGoal({ name, targetAmount: Number(target), currentAmount: Number(current), deadline: deadline ? new Date(deadline).getTime() : null });
    setName(''); setTarget('0'); setCurrent('0'); setDeadline('');
    refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Savings Goals</ThemedText>
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={name} onChangeText={setName} placeholder="Goal name" placeholderTextColor={theme.textSecondary} />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={target} onChangeText={setTarget} placeholder="Target amount" placeholderTextColor={theme.textSecondary} keyboardType="numeric" />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={current} onChangeText={setCurrent} placeholder="Current amount" placeholderTextColor={theme.textSecondary} keyboardType="numeric" />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={deadline} onChangeText={setDeadline} placeholder="Deadline (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} />
        <Button title="Create Goal" onPress={add} />

        {goals.map((goal) => (
          <ThemedView key={goal.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{goal.name}</ThemedText>
            <ThemedText>₹{goal.currentAmount.toFixed(2)} / ₹{goal.targetAmount.toFixed(2)}</ThemedText>
            <ThemedText>Progress: {Math.min(100, (goal.currentAmount / Math.max(1, goal.targetAmount)) * 100).toFixed(1)}%</ThemedText>
            {goal.deadline ? <ThemedText>Deadline: {new Date(goal.deadline).toLocaleDateString()}</ThemedText> : null}
          </ThemedView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10 },
  card: { borderRadius: 10, padding: 12, marginTop: 8 },
});
