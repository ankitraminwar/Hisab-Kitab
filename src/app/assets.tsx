import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { AssetEntity, AssetType, createAsset, getAssets } from '@/modules/assets/assetsService';

const assetTypes: AssetType[] = ['bank', 'cash', 'stocks', 'mutual_funds', 'crypto', 'gold', 'other'];

export default function AssetsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<AssetEntity[]>([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('0');
  const [type, setType] = useState<AssetType>('bank');

  const refresh = async () => setItems(await getAssets());
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name || Number(value) < 0) return Alert.alert('Validation', 'Enter valid name and value');
    await createAsset({ name, type, value: Number(value) });
    setName('');
    setValue('0');
    refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Assets</ThemedText>
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} placeholder="Asset name" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { borderColor: theme.textSecondary, color: theme.text }]} keyboardType="numeric" placeholder="Value" placeholderTextColor={theme.textSecondary} value={value} onChangeText={setValue} />
        <View style={styles.buttonRow}>
          {assetTypes.map((item) => <Button key={item} title={item} color={type === item ? '#208AEF' : '#999'} onPress={() => setType(item)} />)}
        </View>
        <Button title="Add Asset" onPress={add} />

        {items.map((asset) => (
          <ThemedView key={asset.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{asset.name}</ThemedText>
            <ThemedText>{asset.type}</ThemedText>
            <ThemedText>₹{asset.value.toFixed(2)}</ThemedText>
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
