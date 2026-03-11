import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createBudget, getBudgets, BudgetEntity } from '@/modules/budgets/budgetsService';
import { builtInCategories } from '@/modules/data/defaultCategories';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<BudgetEntity[]>([]);
  const [limit, setLimit] = useState('0');
  const [categoryId, setCategoryId] = useState('food');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const theme = useTheme();

  const refresh = async () => setBudgets(await getBudgets());
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (Number(limit) <= 0) { Alert.alert('Validation', 'Budget limit must be > 0'); return; }
    await createBudget({ categoryId, limitAmount: Number(limit), month });
    setLimit('0');
    refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Budgets</ThemedText>
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={limit} onChangeText={setLimit} keyboardType="numeric" placeholder="Limit amount" placeholderTextColor={theme.textSecondary} />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} value={month} onChangeText={setMonth} placeholder="Month YYYY-MM" placeholderTextColor={theme.textSecondary} />
        <View style={styles.buttonRow}>
          {builtInCategories.slice(0, 5).map((cat) => (
            <Button key={cat.id} title={cat.name} color={categoryId === cat.id ? '#208AEF' : '#999'} onPress={() => setCategoryId(cat.id)} />
          ))}
        </View>
        <Button title="Add Budget" onPress={add} />
        {budgets.map((b) => (
          <ThemedView key={b.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{b.categoryId} — {b.month}</ThemedText>
            <ThemedText>Limit: ₹{b.limitAmount.toFixed(2)}</ThemedText>
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
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  card: { borderRadius: 10, padding: 12, marginTop: 8 },
});
