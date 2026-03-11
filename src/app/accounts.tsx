import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAccount, getAccounts, AccountEntity } from '@/modules/accounts/accountsService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<AccountEntity[]>([]);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  const [type, setType] = useState<'cash' | 'bank' | 'upi' | 'credit_card' | 'wallet'>('bank');
  const theme = useTheme();

  const refresh = async () => setAccounts(await getAccounts());

  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name) { Alert.alert('Validation', 'Account name required'); return; }
    await createAccount({ name, type, balance: Number(balance), currency: 'INR' });
    setName(''); setBalance('0');
    refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Accounts</ThemedText>
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} placeholder="Account name" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} placeholder="Balance" placeholderTextColor={theme.textSecondary} keyboardType="numeric" value={balance} onChangeText={setBalance} />
        <View style={styles.buttonRow}>
          {['cash', 'bank', 'upi', 'credit_card', 'wallet'].map((item) => (
            <Button key={item} title={item.toUpperCase()} color={type === item ? '#208AEF' : '#999'} onPress={() => setType(item as any)} />
          ))}
        </View>
        <Button title="Add Account" onPress={add} />
        {accounts.map((acct) => (
          <ThemedView key={acct.id} style={[styles.accountCard, { backgroundColor: theme.backgroundElement }]}> 
            <ThemedText type="smallBold">{acct.name} ({acct.type})</ThemedText>
            <ThemedText>₹{acct.balance.toFixed(2)} {acct.currency}</ThemedText>
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
  accountCard: { borderRadius: 10, padding: 12, marginTop: 8 },
});
