import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY, formatCurrency } from '@/utils/constants';

type SplitMethod = 'equal' | 'exact' | 'percent';

interface SplitMember {
  id: string;
  name: string;
  role: 'owner' | 'member';
  amount: number;
}

const INITIAL_MEMBERS: SplitMember[] = [
  { id: 'you', name: 'You', role: 'owner', amount: 500 },
  { id: '1', name: 'Rahul', role: 'member', amount: 500 },
  { id: '2', name: 'Amit', role: 'member', amount: 500 },
  { id: '3', name: 'Neha', role: 'member', amount: 500 },
];

export default function SplitExpenseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [splitMethod, setSplitMethod] = useState<SplitMethod>('exact');
  const [members, setMembers] = useState<SplitMember[]>(INITIAL_MEMBERS);
  const [friendSearch, setFriendSearch] = useState('');
  const totalExpense = 2000;

  const totalToReceive = members
    .filter((m) => m.role === 'member')
    .reduce((sum, m) => sum + m.amount, 0);

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const METHODS: { key: SplitMethod; label: string }[] = [
    { key: 'equal', label: 'Equal' },
    { key: 'exact', label: 'Exact' },
    { key: 'percent', label: 'Percent' },
  ];

  // Recalculate equal split whenever members or method changes
  useMemo(() => {
    if (splitMethod === 'equal' && members.length > 0) {
      const splitAmount = totalExpense / members.length;
      setMembers((current) => {
        // Only update if needed to prevent infinite loops
        const needsUpdate = current.some(
          (m) => Math.abs(m.amount - splitAmount) > 0.01,
        );
        if (!needsUpdate) return current;
        return current.map((m) => ({ ...m, amount: splitAmount }));
      });
    }
  }, [splitMethod, members.length, totalExpense]);

  const handleSave = () => {
    Alert.alert('Saved', 'Split expense saved successfully');
    router.back();
  };

  const handleAddFriend = () => {
    if (!friendSearch.trim()) {
      Alert.alert(
        'Add Friend',
        'Please type a name in the search box above to add a friend.',
      );
      return;
    }
    const newFriend: SplitMember = {
      id: Date.now().toString(),
      name: friendSearch.trim(),
      role: 'member',
      amount: splitMethod === 'equal' ? 0 : 0, // Will be recalculated by useMemo if equal
    };
    setMembers([...members, newFriend]);
    setFriendSearch('');
  };

  const handleRemoveFriend = (id: string) => {
    if (id === 'you') return;
    setMembers(members.filter((m) => m.id !== id));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Split Expense</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Expense Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.expenseCard}>
            <View>
              <Text style={styles.paidBy}>PAID BY YOU</Text>
              <Text style={styles.expenseName}>Dinner</Text>
              <Text style={styles.expenseAmount}>
                {formatCurrency(totalExpense)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Select Friends */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={styles.sectionLabel}>SELECT FRIENDS</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={friendSearch}
              onChangeText={setFriendSearch}
              placeholder="Search friends or contacts..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.chipRow}>
            {members.map((m) => (
              <View key={m.id} style={styles.friendChip}>
                <View
                  style={[
                    styles.chipAvatar,
                    { backgroundColor: colors.primary + '30' },
                  ]}
                >
                  <Text style={[styles.chipInitial, { color: colors.primary }]}>
                    {getInitial(m.name)}
                  </Text>
                </View>
                <Text style={styles.chipName}>{m.name}</Text>
                {m.id !== 'you' && (
                  <TouchableOpacity onPress={() => handleRemoveFriend(m.id)}>
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Split Method */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <View style={styles.methodHeader}>
            <Text style={styles.sectionLabel}>SPLIT METHOD</Text>
            <TouchableOpacity>
              <Text style={styles.adjustLink}>Adjust amounts manually</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.methodBtn,
                  splitMethod === m.key && styles.methodBtnActive,
                ]}
                onPress={() => setSplitMethod(m.key)}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    splitMethod === m.key && styles.methodBtnTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Members List */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionLabel}>SPLITTING WITH</Text>
            <Text style={styles.peopleCount}>{members.length} People</Text>
          </View>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View
                style={[
                  styles.memberAvatar,
                  { backgroundColor: colors.primary + '30' },
                ]}
              >
                <Text style={[styles.memberInitial, { color: colors.primary }]}>
                  {getInitial(member.name)}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>
                  {member.role === 'owner' ? 'OWNER' : 'OWES YOU'}
                </Text>
              </View>
              <View style={styles.memberAmountBox}>
                <Text style={styles.memberCurrency}>₹</Text>
                {splitMethod === 'equal' ? (
                  <Text style={styles.memberAmount}>
                    {member.amount.toFixed(2)}
                  </Text>
                ) : (
                  <TextInput
                    style={styles.memberAmountInput}
                    value={member.amount ? String(member.amount) : ''}
                    keyboardType="numeric"
                    onChangeText={(val) => {
                      const num = parseFloat(val) || 0;
                      setMembers(
                        members.map((m) =>
                          m.id === member.id ? { ...m, amount: num } : m,
                        ),
                      );
                    }}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                  />
                )}
              </View>
            </View>
          ))}

          {/* Add Friend */}
          <TouchableOpacity
            style={styles.addFriendBtn}
            onPress={handleAddFriend}
          >
            <Ionicons name="person-add" size={18} color={colors.primary} />
            <Text style={styles.addFriendText}>Add Friend</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Total To Receive */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalCard}
          >
            <View>
              <View style={styles.totalLabelRow}>
                <Text style={styles.totalLabel}>TOTAL TO RECEIVE</Text>
                <Ionicons
                  name="information-circle"
                  size={16}
                  color="rgba(255,255,255,0.6)"
                />
              </View>
              <Text style={styles.totalAmount}>
                {formatCurrency(totalToReceive)}
              </Text>
              <Text style={styles.totalRemaining}>Remaining: ₹0.00</Text>
            </View>
            <View style={styles.totalAvatars}>
              {members
                .filter((m) => m.role === 'member')
                .slice(0, 3)
                .map((m) => (
                  <View key={m.id} style={styles.totalAvatarCircle}>
                    <Text style={styles.totalAvatarText}>
                      {getInitial(m.name)}
                    </Text>
                  </View>
                ))}
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    title: { ...TYPOGRAPHY.h3, color: colors.textPrimary },
    saveBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: { padding: SPACING.md },

    // Expense card
    expenseCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.lg,
    },
    paidBy: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
      fontSize: 10,
      textTransform: 'uppercase',
    },
    expenseName: {
      ...TYPOGRAPHY.h2,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 4,
    },
    expenseAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },

    // Search & chips
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: SPACING.sm,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      marginBottom: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      ...TYPOGRAPHY.body,
      paddingVertical: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: SPACING.lg,
    },
    friendChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipInitial: { fontSize: 10, fontWeight: '800' },
    chipName: {
      ...TYPOGRAPHY.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },

    // Split method
    methodHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    adjustLink: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '600',
      fontStyle: 'italic',
    },
    methodRow: {
      flexDirection: 'row',
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: SPACING.lg,
    },
    methodBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
    },
    methodBtnActive: {
      backgroundColor: colors.primary,
    },
    methodBtnText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '700',
    },
    methodBtnTextActive: { color: '#fff' },

    // Members
    membersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    peopleCount: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      gap: 12,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberInitial: { fontSize: 16, fontWeight: '800' },
    memberInfo: { flex: 1 },
    memberName: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    memberRole: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    memberAmountBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 2,
      minWidth: 80,
    },
    memberCurrency: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    memberAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    memberAmountInput: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
      padding: 0,
      margin: 0,
      textAlign: 'right',
      flex: 1,
    },

    // Add friend
    addFriendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.lg,
    },
    addFriendText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.primary,
      fontWeight: '600',
    },

    // Total card
    totalCard: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    totalLabel: {
      ...TYPOGRAPHY.caption,
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    totalAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
      marginTop: 4,
    },
    totalRemaining: {
      ...TYPOGRAPHY.caption,
      color: 'rgba(255,255,255,0.6)',
      marginTop: 2,
    },
    totalAvatars: { flexDirection: 'row' },
    totalAvatarCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -6,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    totalAvatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  });
