import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
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
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Button } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { NetWorthService } from '../../services/dataService';
import { useAppStore } from '../../store/appStore';
import {
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  formatCompact,
  formatCurrency,
} from '../../utils/constants';
import { Asset, AssetType, Liability, LiabilityType } from '../../utils/types';

const ASSET_TYPES: {
  key: AssetType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'bank', label: 'Savings', icon: 'wallet', color: '#10B981' },
  {
    key: 'stocks',
    label: 'Investments',
    icon: 'trending-up',
    color: '#3B82F6',
  },
  {
    key: 'mutual_funds',
    label: 'Mutual Funds',
    icon: 'pie-chart',
    color: '#8B5CF6',
  },
  { key: 'cash', label: 'Cash', icon: 'cash', color: '#F59E0B' },
  { key: 'crypto', label: 'Crypto', icon: 'logo-bitcoin', color: '#EAB308' },
  { key: 'gold', label: 'Gold', icon: 'diamond', color: '#F59E0B' },
  { key: 'real_estate', label: 'Property', icon: 'home', color: '#06B6D4' },
  {
    key: 'other',
    label: 'Other',
    icon: 'ellipsis-horizontal',
    color: '#6B7280',
  },
];

const LIABILITY_TYPES: {
  key: LiabilityType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'credit_card', label: 'Credit Card', icon: 'card', color: '#F43F5E' },
  { key: 'loan', label: 'Loan', icon: 'cash', color: '#F97316' },
  { key: 'mortgage', label: 'Mortgage', icon: 'home', color: '#8B5CF6' },
  {
    key: 'other',
    label: 'Other',
    icon: 'ellipsis-horizontal',
    color: '#6B7280',
  },
];

export default function NetWorthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [nw, setNw] = useState({ assets: 0, liabilities: 0, netWorth: 0 });
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);

  useEffect(() => {
    loadData();
  }, [dataRevision]);

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

  const assetsByType = ASSET_TYPES.map((t) => ({
    ...t,
    items: assets.filter((a) => a.type === t.key),
    total: assets
      .filter((a) => a.type === t.key)
      .reduce((s, a) => s + a.value, 0),
  })).filter((t) => t.items.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Net Worth"
        rightAction={{
          icon: 'ellipsis-vertical',
          onPress: () => {},
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>TOTAL NET WORTH</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroAmount}>
                {formatCurrency(nw.netWorth)}
              </Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>+5.2%</Text>
              </View>
            </View>
            <Text style={styles.heroSub}>Last updated: Today</Text>
          </View>
        </Animated.View>

        {/* Growth Chart */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <View style={styles.card}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartLabel}>GROWTH OVER TIME</Text>
                <Text style={styles.chartValue}>
                  {formatCompact(nw.netWorth)}
                </Text>
              </View>
              <View style={styles.chartBadge}>
                <Text
                  style={[styles.chartBadgeText, { color: colors.primary }]}
                >
                  LAST 6 MONTHS
                </Text>
              </View>
            </View>
            <Svg
              width="100%"
              height={120}
              viewBox="0 0 472 150"
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient
                  id="chartGrad"
                  x1="236"
                  y1="1"
                  x2="236"
                  y2="149"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop
                    offset="0"
                    stopColor={colors.primary}
                    stopOpacity={0.3}
                  />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path
                d="M0 109C18 109 18 21 36 21C54 21 54 41 73 41C91 41 91 93 109 93C127 93 127 33 145 33C163 33 163 101 182 101C200 101 200 61 218 61C236 61 236 45 254 45C272 45 272 121 290 121C309 121 309 149 327 149C345 149 345 1 363 1C381 1 381 81 399 81C418 81 418 129 436 129C454 129 454 25 472 25V149H0V109Z"
                fill="url(#chartGrad)"
              />
              <Path
                d="M0 109C18 109 18 21 36 21C54 21 54 41 73 41C91 41 91 93 109 93C127 93 127 33 145 33C163 33 163 101 182 101C200 101 200 61 218 61C236 61 236 45 254 45C272 45 272 121 290 121C309 121 309 149 327 149C345 149 345 1 363 1C381 1 381 81 399 81C418 81 418 129 436 129C454 129 454 25 472 25"
                fill="none"
                stroke={colors.primary}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </Svg>
            <View style={styles.chartMonths}>
              {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'].map((m) => (
                <Text key={m} style={styles.chartMonth}>
                  {m}
                </Text>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Assets Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assets</Text>
            <View style={styles.sectionBadge}>
              <Text style={[styles.sectionBadgeText, { color: colors.income }]}>
                {formatCurrency(nw.assets)}
              </Text>
            </View>
          </View>
          {assetsByType.length === 0 ? (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => setShowAddAsset(true)}
                style={styles.emptyBtn}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.emptyText, { color: colors.primary }]}>
                  Add Asset
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {assetsByType.flatMap((group) =>
                group.items.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    typeInfo={group}
                    colors={colors}
                    onDelete={async () => {
                      await NetWorthService.deleteAsset(asset.id);
                      loadData();
                    }}
                  />
                )),
              )}
              <TouchableOpacity
                onPress={() => setShowAddAsset(true)}
                style={[styles.addRow, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Add Asset
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Liabilities Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
            <Text style={styles.sectionTitle}>Liabilities</Text>
            <View
              style={[
                styles.sectionBadge,
                { backgroundColor: colors.expense + '15' },
              ]}
            >
              <Text
                style={[styles.sectionBadgeText, { color: colors.expense }]}
              >
                {formatCurrency(nw.liabilities)}
              </Text>
            </View>
          </View>
          {liabilities.length === 0 ? (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => setShowAddLiability(true)}
                style={styles.emptyBtn}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.emptyText, { color: colors.primary }]}>
                  Add Liability
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {liabilities.map((liability) => {
                const typeInfo = LIABILITY_TYPES.find(
                  (t) => t.key === liability.type,
                );
                return (
                  <LiabilityCard
                    key={liability.id}
                    liability={liability}
                    typeInfo={typeInfo}
                    colors={colors}
                    onDelete={async () => {
                      await NetWorthService.deleteLiability(liability.id);
                      loadData();
                    }}
                  />
                );
              })}
              <TouchableOpacity
                onPress={() => setShowAddLiability(true)}
                style={[styles.addRow, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Add Liability
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <AddAssetModal
        visible={showAddAsset}
        onClose={() => setShowAddAsset(false)}
        onSave={() => {
          loadData();
          setShowAddAsset(false);
        }}
        colors={colors}
      />
      <AddLiabilityModal
        visible={showAddLiability}
        onClose={() => setShowAddLiability(false)}
        onSave={() => {
          loadData();
          setShowAddLiability(false);
        }}
        colors={colors}
      />
    </SafeAreaView>
  );
}

/* ---------- Item Cards ---------- */

const AssetCard: React.FC<{
  asset: Asset;
  typeInfo: { label: string; icon: string; color: string };
  colors: ThemeColors;
  onDelete: () => void;
}> = ({ asset, typeInfo, colors, onDelete }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.bgCard,
      padding: 14,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: typeInfo.color + '15',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={typeInfo.icon as never}
        size={20}
        color={typeInfo.color}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
      >
        {asset.name}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
        {typeInfo.label}
      </Text>
    </View>
    <Text
      style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
    >
      {formatCurrency(asset.value)}
    </Text>
    <TouchableOpacity
      onPress={onDelete}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  </View>
);

const LiabilityCard: React.FC<{
  liability: Liability;
  typeInfo?: { label: string; icon: string; color: string };
  colors: ThemeColors;
  onDelete: () => void;
}> = ({ liability, typeInfo, colors, onDelete }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.bgCard,
      padding: 14,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: (typeInfo?.color || colors.expense) + '15',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={(typeInfo?.icon || 'card') as never}
        size={20}
        color={typeInfo?.color || colors.expense}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
      >
        {liability.name}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
        {typeInfo?.label || liability.type}
      </Text>
    </View>
    <Text
      style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
    >
      {formatCurrency(liability.amount)}
    </Text>
    <TouchableOpacity
      onPress={onDelete}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  </View>
);

/* ---------- Modals ---------- */

const AddAssetModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  colors: ThemeColors;
}> = ({ visible, onClose, onSave, colors }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('bank');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const mStyles = useMemo(() => modalStyles(colors), [colors]);

  const handleSave = async () => {
    if (!name || !value) return;
    setLoading(true);
    await NetWorthService.createAsset({
      name,
      type,
      value: parseFloat(value),
      lastUpdated: new Date().toISOString(),
    });
    setLoading(false);
    setName('');
    setValue('');
    onSave();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={mStyles.overlay}>
          <View style={mStyles.sheet}>
            <View style={mStyles.handle} />
            <Text style={mStyles.title}>Add Asset</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: SPACING.md }}
            >
              {ASSET_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setType(t.key)}
                  style={[
                    mStyles.chip,
                    type === t.key && {
                      backgroundColor: t.color,
                      borderColor: t.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={t.icon as never}
                    size={14}
                    color={type === t.key ? '#fff' : colors.textMuted}
                  />
                  <Text
                    style={[
                      mStyles.chipText,
                      type === t.key && { color: '#fff' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Asset name"
              placeholderTextColor={colors.textMuted}
              style={mStyles.input}
            />
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder="Current value (₹)"
              placeholderTextColor={colors.textMuted}
              style={mStyles.input}
            />
            <View style={mStyles.actions}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Add Asset"
                onPress={() => void handleSave()}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const AddLiabilityModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  colors: ThemeColors;
}> = ({ visible, onClose, onSave, colors }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<LiabilityType>('loan');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const mStyles = useMemo(() => modalStyles(colors), [colors]);

  const handleSave = async () => {
    if (!name || !amount) return;
    setLoading(true);
    await NetWorthService.createLiability({
      name,
      type,
      amount: parseFloat(amount),
      interestRate: parseFloat(rate) || 0,
      lastUpdated: new Date().toISOString(),
    });
    setLoading(false);
    setName('');
    setAmount('');
    setRate('');
    onSave();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={mStyles.overlay}>
          <View style={mStyles.sheet}>
            <View style={mStyles.handle} />
            <Text style={mStyles.title}>Add Liability</Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: SPACING.md,
              }}
            >
              {LIABILITY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setType(t.key)}
                  style={[
                    mStyles.chip,
                    type === t.key && {
                      backgroundColor: t.color,
                      borderColor: t.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      mStyles.chipText,
                      type === t.key && { color: '#fff' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Liability name"
              placeholderTextColor={colors.textMuted}
              style={mStyles.input}
            />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Outstanding amount (₹)"
              placeholderTextColor={colors.textMuted}
              style={mStyles.input}
            />
            <TextInput
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
              placeholder="Interest rate % (optional)"
              placeholderTextColor={colors.textMuted}
              style={mStyles.input}
            />
            <View style={mStyles.actions}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Add Liability"
                onPress={() => void handleSave()}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ---------- Styles ---------- */

const modalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: 40,
      borderWidth: 1,
      borderColor: colors.border,
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
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      marginRight: 8,
    },
    chipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  });

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.md },
    heroCard: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      backgroundColor: colors.primary,
      marginVertical: SPACING.md,
      overflow: 'hidden',
      position: 'relative',
    },
    heroGlow: {
      position: 'absolute',
      right: -16,
      bottom: -16,
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    heroLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    heroAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
    },
    heroBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    heroSub: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 10,
      marginTop: 8,
      fontStyle: 'italic',
      fontWeight: '500',
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    chartLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    chartValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
    chartBadge: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    chartBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    chartMonths: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginTop: 8,
    },
    chartMonth: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    sectionBadge: {
      backgroundColor: colors.income + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    sectionBadgeText: { fontSize: 11, fontWeight: '700' },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    emptyText: { fontWeight: '700', fontSize: 13 },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
  });
