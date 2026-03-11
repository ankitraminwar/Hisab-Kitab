import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { LiabilityEntity, LiabilityType, createLiability, getLiabilities } from '@/modules/liabilities/liabilitiesService';

const liabilityTypes: LiabilityType[] = ['credit_card', 'loan', 'mortgage', 'other'];

export default function LiabilitiesScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<LiabilityEntity[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<LiabilityType>('credit_card');

  const refresh = async () => setItems(await getLiabilities());
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name || Number(amount) < 0) return Alert.alert('Validation', 'Enter valid name and amount');
    await createLiability({ name, type, amount: Number(amount) });
    setName('');
    setAmount('0');
    refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Liabilities</ThemedText>
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} placeholder="Liability name" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} keyboardType="numeric" placeholder="Amount" placeholderTextColor={theme.textSecondary} value={amount} onChangeText={setAmount} />
        <View style={styles.buttonRow}>
          {liabilityTypes.map((item) => <Button key={item} title={item} color={type === item ? '#208AEF' : '#999'} onPress={() => setType(item)} />)}
        </View>
        <Button title="Add Liability" onPress={add} />

        {items.map((liability) => (
          <ThemedView key={liability.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{liability.name}</ThemedText>
            <ThemedText>{liability.type}</ThemedText>
            <ThemedText>₹{liability.amount.toFixed(2)}</ThemedText>
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
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: 10, padding: 12, marginTop: 8 },
});
