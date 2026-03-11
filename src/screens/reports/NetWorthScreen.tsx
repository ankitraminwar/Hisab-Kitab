import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, formatCurrency, formatCompact } from '../../utils/constants';
import { NetWorthService } from '../../services/dataServices';
import { Asset, Liability, AssetType, LiabilityType } from '../../utils/types';
import { Card, SectionHeader, Button } from '../../components/common';

const ASSET_TYPES: { key: AssetType; label: string; icon: string; color: string }[] = [
  { key: 'bank', label: 'Bank', icon: 'business', color: '#3B82F6' },
  { key: 'cash', label: 'Cash', icon: 'cash', color: '#22C55E' },
  { key: 'stocks', label: 'Stocks', icon: 'trending-up', color: '#F97316' },
  { key: 'mutual_funds', label: 'Mutual Funds', icon: 'pie-chart', color: '#8B5CF6' },
  { key: 'crypto', label: 'Crypto', icon: 'logo-bitcoin', color: '#EAB308' },
  { key: 'gold', label: 'Gold', icon: 'diamond', color: '#F59E0B' },
  { key: 'real_estate', label: 'Property', icon: 'home', color: '#06B6D4' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

const LIABILITY_TYPES: { key: LiabilityType; label: string; icon: string; color: string }[] = [
  { key: 'credit_card', label: 'Credit Card', icon: 'card', color: '#F43F5E' },
  { key: 'loan', label: 'Loan', icon: 'cash', color: '#F97316' },
  { key: 'mortgage', label: 'Mortgage', icon: 'home', color: '#8B5CF6' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

export default function NetWorthScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [nw, setNw] = useState({ assets: 0, liabilities: 0, netWorth: 0 });
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [a, l, n] = await Promise.all([
      NetWorthService.getAssets(),
      NetWorthService.getLiabilities(),
      NetWorthService.getNetWorth(),
    ]);
    setAssets(a);
    setLiabilities(l);
    setNw(n);
  };

  const assetsByType = ASSET_TYPES.map(t => ({
    ...t,
    items: assets.filter(a => a.type === t.key),
    total: assets.filter(a => a.type === t.key).reduce((s, a) => s + a.value, 0),
  })).filter(t => t.items.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Net Worth</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Net Worth Card */}
        <Card style={styles.nwCard} glow>
          <Text style={styles.nwLabel}>NET WORTH</Text>
          <Text style={[styles.nwValue, { color: nw.netWorth >= 0 ? COLORS.income : COLORS.expense }]}>
            {formatCurrency(nw.netWorth)}
          </Text>
          <View style={styles.nwRow}>
            <View style={styles.nwStat}>
              <View style={styles.nwDot} />
              <Text style={styles.nwStatLabel}>Assets</Text>
              <Text style={[styles.nwStatValue, { color: COLORS.income }]}>{formatCompact(nw.assets)}</Text>
            </View>
            <View style={styles.nwDivider} />
            <View style={styles.nwStat}>
              <View style={[styles.nwDot, { backgroundColor: COLORS.expense }]} />
              <Text style={styles.nwStatLabel}>Liabilities</Text>
              <Text style={[styles.nwStatValue, { color: COLORS.expense }]}>{formatCompact(nw.liabilities)}</Text>
            </View>
          </View>
        </Card>

        {/* Assets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assets</Text>
          <TouchableOpacity onPress={() => setShowAddAsset(true)} style={styles.sectionAddBtn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={styles.sectionAddText}>Add</Text>
          </TouchableOpacity>
        </View>

        {assetsByType.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No assets added yet</Text>
          </Card>
        ) : (
          assetsByType.map(group => (
            <Card key={group.key} style={styles.assetGroupCard}>
              <View style={styles.assetGroupHeader}>
                <View style={[styles.assetGroupIcon, { backgroundColor: group.color + '20' }]}>
                  <Ionicons name={group.icon as any} size={16} color={group.color} />
                </View>
                <Text style={styles.assetGroupName}>{group.label}</Text>
                <Text style={[styles.assetGroupTotal, { color: group.color }]}>{formatCurrency(group.total)}</Text>
              </View>
              {group.items.map(asset => (
                <View key={asset.id} style={styles.assetItem}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <View style={styles.assetRight}>
                    <Text style={styles.assetValue}>{formatCurrency(asset.value)}</Text>
                    <TouchableOpacity onPress={async () => {
                      await NetWorthService.deleteAsset(asset.id);
                      loadData();
                    }}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Card>
          ))
        )}

        {/* Liabilities */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
          <Text style={styles.sectionTitle}>Liabilities</Text>
          <TouchableOpacity onPress={() => setShowAddLiability(true)} style={styles.sectionAddBtn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={styles.sectionAddText}>Add</Text>
          </TouchableOpacity>
        </View>

        {liabilities.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No liabilities added</Text>
          </Card>
        ) : (
          liabilities.map(liability => {
            const typeInfo = LIABILITY_TYPES.find(t => t.key === liability.type);
            return (
              <Card key={liability.id} style={styles.liabilityCard}>
                <View style={styles.liabilityRow}>
                  <View style={[styles.assetGroupIcon, { backgroundColor: (typeInfo?.color || COLORS.expense) + '20' }]}>
                    <Ionicons name={(typeInfo?.icon || 'card') as any} size={16} color={typeInfo?.color || COLORS.expense} />
                  </View>
                  <View style={styles.liabilityInfo}>
                    <Text style={styles.liabilityName}>{liability.name}</Text>
                    {liability.interestRate > 0 && (
                      <Text style={styles.liabilityRate}>{liability.interestRate}% p.a.</Text>
                    )}
                  </View>
                  <Text style={[styles.liabilityAmount, { color: COLORS.expense }]}>
                    -{formatCurrency(liability.amount)}
                  </Text>
                  <TouchableOpacity onPress={async () => {
                    await NetWorthService.deleteLiability(liability.id);
                    loadData();
                  }}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <AddAssetModal visible={showAddAsset} onClose={() => setShowAddAsset(false)} onSave={() => { loadData(); setShowAddAsset(false); }} />
      <AddLiabilityModal visible={showAddLiability} onClose={() => setShowAddLiability(false)} onSave={() => { loadData(); setShowAddLiability(false); }} />
    </SafeAreaView>
  );
}

// Add Asset Modal
const AddAssetModal: React.FC<{ visible: boolean; onClose: () => void; onSave: () => void }> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('bank');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !value) return;
    setLoading(true);
    await NetWorthService.createAsset({ name, type, value: parseFloat(value), lastUpdated: new Date().toISOString() });
    setLoading(false);
    setName(''); setValue('');
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Add Asset</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            {ASSET_TYPES.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setType(t.key)}
                style={[mStyles.typeChip, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}>
                <Ionicons name={t.icon as any} size={14} color={type === t.key ? '#fff' : COLORS.textMuted} />
                <Text style={[mStyles.typeLabel, type === t.key && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput value={name} onChangeText={setName} placeholder="Asset name" placeholderTextColor={COLORS.textMuted} style={mStyles.input} />
          <TextInput value={value} onChangeText={setValue} keyboardType="numeric" placeholder="Current value (₹)" placeholderTextColor={COLORS.textMuted} style={mStyles.input} />
          <View style={mStyles.actions}>
            <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
            <Button title="Add Asset" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Add Liability Modal
const AddLiabilityModal: React.FC<{ visible: boolean; onClose: () => void; onSave: () => void }> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<LiabilityType>('loan');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !amount) return;
    setLoading(true);
    await NetWorthService.createLiability({
      name, type, amount: parseFloat(amount),
      interestRate: parseFloat(rate) || 0,
      lastUpdated: new Date().toISOString(),
    });
    setLoading(false);
    setName(''); setAmount(''); setRate('');
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Add Liability</Text>
          <View style={mStyles.typeRow}>
            {LIABILITY_TYPES.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setType(t.key)}
                style={[mStyles.typeChip, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}>
                <Text style={[mStyles.typeLabel, type === t.key && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Liability name" placeholderTextColor={COLORS.textMuted} style={mStyles.input} />
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Outstanding amount (₹)" placeholderTextColor={COLORS.textMuted} style={mStyles.input} />
          <TextInput value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="Interest rate % (optional)" placeholderTextColor={COLORS.textMuted} style={mStyles.input} />
          <View style={mStyles.actions}>
            <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
            <Button title="Add Liability" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40, borderWidth: 1, borderColor: COLORS.border,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgElevated,
  },
  typeLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md, padding: SPACING.md,
    color: COLORS.textPrimary, ...TYPOGRAPHY.body, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  scroll: { paddingHorizontal: SPACING.md },
  nwCard: {
    marginBottom: SPACING.lg,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
  },
  nwLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  nwValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: SPACING.md },
  nwRow: { flexDirection: 'row', gap: SPACING.md },
  nwStat: { flex: 1, alignItems: 'center', gap: 4 },
  nwDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.income },
  nwStatLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  nwStatValue: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
  nwDivider: { width: 1, backgroundColor: COLORS.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.primary + '20', borderWidth: 1, borderColor: COLORS.primary + '40' },
  sectionAddText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600' },
  emptyCard: { marginBottom: SPACING.sm },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' },
  assetGroupCard: { marginBottom: SPACING.sm },
  assetGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 8 },
  assetGroupIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assetGroupName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, flex: 1 },
  assetGroupTotal: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
  assetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  assetName: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  assetRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
  liabilityCard: { marginBottom: SPACING.sm },
  liabilityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  liabilityInfo: { flex: 1 },
  liabilityName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  liabilityRate: { ...TYPOGRAPHY.caption, color: COLORS.warning },
  liabilityAmount: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
});
