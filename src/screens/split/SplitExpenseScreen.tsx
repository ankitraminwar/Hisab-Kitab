import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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

import { CustomPopup } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { SplitService } from '../../services/splitService';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type {
  SplitExpense,
  SplitFriend,
  SplitMember as SplitMemberType,
  SplitStatus,
  Transaction,
} from '../../utils/types';

type SplitMethod = 'equal' | 'exact' | 'percent';

interface LocalMember {
  id: string;
  name: string;
  role: 'owner' | 'member';
  amount: number;
  sharePercent?: number;
  status?: SplitStatus;
  dbId?: string; // ID from the database for existing members
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SplitExpenseScreen() {
  const router = useRouter();
  const { id, txId } = useLocalSearchParams<{ id: string; txId?: string }>();
  const isNewSplit = !id || id === 'new';

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);

  // ── Existing split view state ────────────────────────────────────────────
  const [existingSplit, setExistingSplit] = useState<SplitExpense | null>(null);
  const [existingMembers, setExistingMembers] = useState<SplitMemberType[]>([]);
  const [existingMerchant, setExistingMerchant] = useState<string>('');
  const [existingDate, setExistingDate] = useState<string>('');
  const [viewLoading, setViewLoading] = useState(!isNewSplit);

  // ── Create split state ───────────────────────────────────────────────────
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [members, setMembers] = useState<LocalMember[]>([
    { id: 'you', name: 'You', role: 'owner', amount: 0 },
  ]);
  const [friendSearch, setFriendSearch] = useState('');
  const [allFriends, setAllFriends] = useState<SplitFriend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({ visible: false, title: '', message: '', type: 'info' });

  const [saving, setSaving] = useState(false);
  const friendSearchRef = useRef<TextInput>(null);
  const hasLoadedDetailRef = useRef(false);

  const totalExpense = selectedTransaction?.amount || 0;

  useEffect(() => {
    void SplitService.getFriends().then(setAllFriends);
  }, [dataRevision]);

  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return [];
    const lowerSearch = friendSearch.toLowerCase();
    return allFriends.filter(
      (f) =>
        f.name.toLowerCase().includes(lowerSearch) &&
        !members.some((m) => m.dbId === f.id || m.name === f.name),
    );
  }, [allFriends, friendSearch, members]);

  // ── Load existing split ──────────────────────────────────────────────────
  const loadExistingSplit = useCallback(
    async (showLoader = false) => {
      if (isNewSplit || !id) return;
      if (showLoader) {
        setViewLoading(true);
      }
      const data = await SplitService.getById(id);
      if (data) {
        setExistingSplit(data.expense);
        setExistingMembers(data.members);
        setExistingMerchant(data.transactionMerchant || 'Untitled');
        setExistingDate(data.transactionDate || data.expense.createdAt);
      }
      hasLoadedDetailRef.current = true;
      setViewLoading(false);
    },
    [id, isNewSplit],
  );

  useEffect(() => {
    if (!isNewSplit) {
      void loadExistingSplit(!hasLoadedDetailRef.current);
    }
  }, [loadExistingSplit, dataRevision, isNewSplit]);

  // ── Load transactions for new split ──────────────────────────────────────
  const loadTransactions = useCallback(async () => {
    const data = await TransactionService.getAll(undefined, 100);
    const expenseList = data.filter((t) => t.type === 'expense');
    setTransactions(expenseList);
    const preselected = txId ? expenseList.find((t) => t.id === txId) : expenseList[0];
    if (preselected) setSelectedTransaction(preselected);
  }, [txId]);

  useEffect(() => {
    if (isNewSplit) {
      void loadTransactions();
    }
  }, [isNewSplit, loadTransactions]);

  const handleOpenTransactionModal = useCallback(async () => {
    await loadTransactions();
    setShowTransactionModal(true);
  }, [loadTransactions]);

  // ── Recalculate equal split ──────────────────────────────────────────────
  useEffect(() => {
    if (isNewSplit && splitMethod === 'equal' && members.length > 0) {
      const splitAmount = totalExpense / members.length;
      setMembers((current) => {
        const needsUpdate = current.some((m) => Math.abs(m.amount - splitAmount) > 0.01);
        if (!needsUpdate) return current;
        return current.map((m) => ({ ...m, amount: splitAmount }));
      });
    }
  }, [isNewSplit, splitMethod, members.length, totalExpense]);

  // ── Recalculate amounts when percent changes ────────────────────────────
  useEffect(() => {
    if (isNewSplit && splitMethod === 'percent' && totalExpense > 0) {
      setMembers((current) =>
        current.map((m) => {
          const pct = m.sharePercent ?? 0;
          return { ...m, amount: (totalExpense * pct) / 100 };
        }),
      );
    }
  }, [isNewSplit, splitMethod, totalExpense]);

  const totalToReceive = members
    .filter((m) => m.role === 'member')
    .reduce((sum, m) => sum + m.amount, 0);

  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase();

  const METHODS: { key: SplitMethod; label: string }[] = [
    { key: 'equal', label: 'Equal' },
    { key: 'exact', label: 'Exact' },
    { key: 'percent', label: 'Percent' },
  ];

  // ── Save new split ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedTransaction) {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Please select a transaction to split.',
        type: 'error',
      });
      return;
    }

    if (splitMethod === 'percent') {
      const totalPercent = members.reduce((sum, m) => sum + (m.sharePercent ?? 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        setPopupConfig({
          visible: true,
          title: 'Percent Mismatch',
          message: `Total percentage is ${totalPercent.toFixed(1)}%. It must add up to 100%.`,
          type: 'error',
        });
        return;
      }
    }

    const totalSplit = members.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(totalSplit - totalExpense) > 0.05) {
      setPopupConfig({
        visible: true,
        title: 'Mismatch',
        message: `Split amounts (${formatCurrency(totalSplit)}) do not match total expense (${formatCurrency(totalExpense)}).`,
        type: 'error',
      });
      return;
    }

    const otherMembers = members.filter((m) => m.role === 'member' && m.amount > 0);
    if (otherMembers.length === 0) {
      setPopupConfig({
        visible: true,
        title: 'No Splits',
        message: 'Add at least one friend with an amount greater than 0.',
        type: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      await SplitService.createSplit(
        {
          transactionId: selectedTransaction.id,
          paidByUserId: 'you',
          totalAmount: totalExpense,
          splitMethod,
          notes: selectedTransaction.notes,
        },
        otherMembers.map((m) => ({
          friendId: m.dbId,
          name: m.name,
          shareAmount: m.amount,
          sharePercent: splitMethod === 'percent' ? m.sharePercent : undefined,
          status: 'pending' as const,
        })),
      );

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPopupConfig({
        visible: true,
        title: 'Success',
        message: 'Expense split successfully!',
        type: 'success',
        onClose: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/splits' as Href);
          }
        },
      });
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to split expense.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Mark member paid/pending ─────────────────────────────────────────────
  const handleToggleMemberStatus = async (member: SplitMemberType) => {
    const newStatus: SplitStatus = member.status === 'paid' ? 'pending' : 'paid';
    const previousMembers = existingMembers;
    setExistingMembers((current) =>
      current.map((item) => (item.id === member.id ? { ...item, status: newStatus } : item)),
    );
    try {
      await SplitService.markSharePaid(member.id, newStatus);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setExistingMembers(previousMembers);
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to update payment status.',
        type: 'error',
      });
    }
  };

  // ── Delete split ─────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!existingSplit) return;
    Alert.alert('Delete Split', 'Are you sure you want to delete this split expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await SplitService.deleteSplit(existingSplit.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPopupConfig({
              visible: true,
              title: 'Deleted',
              message: 'Split expense removed.',
              type: 'success',
              onClose: () => router.back(),
            });
          } catch {
            setPopupConfig({
              visible: true,
              title: 'Error',
              message: 'Failed to delete split.',
              type: 'error',
            });
          }
        },
      },
    ]);
  };

  const handleAddNewFriend = async () => {
    if (!friendSearch.trim()) {
      setPopupConfig({
        visible: true,
        title: 'Add Friend',
        message: 'Please type a name in the search box above.',
        type: 'info',
      });
      return;
    }
    setSaving(true);
    try {
      const friend = await SplitService.saveFriend(friendSearch.trim());
      const newFriend: LocalMember = {
        id: Date.now().toString(),
        name: friend.name,
        role: 'member',
        amount: 0,
        dbId: friend.id,
      };
      setMembers([...members, newFriend]);
      setFriendSearch('');
      setIsSearching(false);
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to add friend.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddExistingFriend = (friend: SplitFriend) => {
    const newFriend: LocalMember = {
      id: Date.now().toString(),
      name: friend.name,
      role: 'member',
      amount: 0,
      dbId: friend.id,
    };
    setMembers([...members, newFriend]);
    setFriendSearch('');
    setIsSearching(false);
  };

  const handleRemoveFriend = (friendId: string) => {
    if (friendId === 'you') return;
    setMembers(members.filter((m) => m.id !== friendId));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW EXISTING SPLIT
  // ══════════════════════════════════════════════════════════════════════════
  if (!isNewSplit) {
    if (viewLoading) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Split Detail</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textMuted }}>Loading...</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (!existingSplit) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Split Detail</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 12,
                fontSize: 16,
              }}
            >
              Split not found
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    const pendingMembers = existingMembers.filter((m) => m.status === 'pending');
    const paidMembers = existingMembers.filter((m) => m.status === 'paid');
    const pendingAmount = pendingMembers.reduce((s, m) => s + m.shareAmount, 0);
    const collectedAmount = paidMembers.reduce((s, m) => s + m.shareAmount, 0);
    const isSettled = pendingMembers.length === 0 && paidMembers.length > 0;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Split Detail</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.backBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.expense} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero card */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <LinearGradient
              colors={isSettled ? [colors.income, '#047857'] : [colors.primary, '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHero}
            >
              <View style={styles.detailHeroBlob} />
              <Text style={styles.detailHeroLabel}>{existingMerchant}</Text>
              <Text style={styles.detailHeroAmount}>
                {formatCurrency(existingSplit.totalAmount)}
              </Text>
              <View style={styles.detailHeroMeta}>
                <View style={styles.detailHeroMetaItem}>
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.detailHeroMetaText}>
                    {new Date(existingDate || existingSplit.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.detailHeroMetaItem}>
                  <Ionicons name="git-branch-outline" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.detailHeroMetaText}>
                    {existingSplit?.splitMethod?.charAt(0)?.toUpperCase() +
                      existingSplit?.splitMethod?.slice(1)}{' '}
                    split
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Status summary */}
          <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.statusRow}>
            <View style={[styles.statusCard, { borderColor: colors.warning + '30' }]}>
              <Text style={[styles.statusLabel, { color: colors.warning }]}>Pending</Text>
              <Text style={styles.statusValue}>{formatCurrency(pendingAmount)}</Text>
            </View>
            <View style={[styles.statusCard, { borderColor: colors.income + '30' }]}>
              <Text style={[styles.statusLabel, { color: colors.income }]}>Collected</Text>
              <Text style={styles.statusValue}>{formatCurrency(collectedAmount)}</Text>
            </View>
          </Animated.View>

          {/* Members */}
          <Animated.View entering={FadeInDown.duration(400).delay(160)}>
            <Text style={styles.sectionLabel}>MEMBERS ({existingMembers.length})</Text>
            {existingMembers.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View
                  style={[
                    styles.memberAvatar,
                    {
                      backgroundColor:
                        member.status === 'paid' ? colors.income + '20' : colors.primary + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberInitial,
                      {
                        color: member.status === 'paid' ? colors.income : colors.primary,
                      },
                    ]}
                  >
                    {member?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text
                    style={[
                      styles.memberRole,
                      {
                        color: member.status === 'paid' ? colors.income : colors.warning,
                      },
                    ]}
                  >
                    {member.status === 'paid' ? 'PAID' : 'PENDING'}
                  </Text>
                </View>
                <Text style={styles.memberAmountText}>{formatCurrency(member.shareAmount)}</Text>
                <TouchableOpacity
                  onPress={() => void handleToggleMemberStatus(member)}
                  style={[
                    styles.statusToggle,
                    {
                      backgroundColor:
                        member.status === 'paid' ? colors.income + '15' : colors.bgElevated,
                      borderColor: member.status === 'paid' ? colors.income + '30' : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={member.status === 'paid' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={member.status === 'paid' ? colors.income : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <CustomPopup
          visible={popupConfig.visible}
          title={popupConfig.title}
          message={popupConfig.message}
          type={popupConfig.type}
          onClose={() => {
            setPopupConfig((prev) => ({ ...prev, visible: false }));
            if (popupConfig.onClose) setTimeout(popupConfig.onClose, 300);
          }}
        />
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE NEW SPLIT
  // ══════════════════════════════════════════════════════════════════════════
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
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Ionicons name={saving ? 'hourglass' : 'checkmark'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Transaction Selection */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <TouchableOpacity
              style={styles.expenseCard}
              onPress={() => void handleOpenTransactionModal()}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.paidBy}>SELECTED EXPENSE</Text>
                <Text style={styles.expenseName}>
                  {selectedTransaction
                    ? selectedTransaction.merchant || selectedTransaction.notes || 'Unnamed Expense'
                    : 'Tap to select an expense'}
                </Text>
                <Text style={styles.expenseAmount}>{formatCurrency(totalExpense)}</Text>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>

          {/* Select Friends */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ zIndex: 10 }}>
            <Text style={styles.sectionLabel}>ADD FRIENDS</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                ref={friendSearchRef}
                value={friendSearch}
                onChangeText={(t) => {
                  setFriendSearch(t);
                  setIsSearching(true);
                }}
                placeholder="Search or enter new friend"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                onSubmitEditing={handleAddNewFriend}
                returnKeyType="done"
                onFocus={() => setIsSearching(true)}
              />
              {friendSearch.trim() !== '' && (
                <TouchableOpacity onPress={handleAddNewFriend}>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {isSearching && friendSearch.trim() !== '' && (
              <View
                style={[
                  styles.friendsDropdown,
                  { backgroundColor: colors.bgElevated, borderColor: colors.border },
                ]}
              >
                {filteredFriends.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.friendDropdownItem}
                    onPress={() => handleAddExistingFriend(f)}
                  >
                    <Ionicons name="person" size={16} color={colors.primary} />
                    <Text style={{ color: colors.textPrimary, marginLeft: 8, fontWeight: '600' }}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.friendDropdownItem} onPress={handleAddNewFriend}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, marginLeft: 8, fontWeight: '700' }}>
                    Add &quot;{friendSearch.trim()}&quot; as new friend
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.chipRow}>
              {members.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.friendChip,
                    m.id === 'you' && {
                      backgroundColor: colors.primary + '20',
                      borderWidth: 1,
                      borderColor: colors.primary + '30',
                    },
                  ]}
                >
                  <View style={[styles.chipAvatar, { backgroundColor: colors.primary + '30' }]}>
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
            <Text style={styles.sectionLabel}>SPLIT METHOD</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodBtn, splitMethod === m.key && styles.methodBtnActive]}
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
              <Text style={styles.sectionLabel}>SPLITTING WITH ({members.length})</Text>
            </View>
            {members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '30' }]}>
                  <Text style={[styles.memberInitial, { color: colors.primary }]}>
                    {getInitial(member.name)}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>
                    {member.role === 'owner' ? 'PAID BY YOU' : 'OWES YOU'}
                  </Text>
                </View>
                {splitMethod === 'percent' && (
                  <View
                    style={[
                      styles.memberAmountBox,
                      {
                        minWidth: 60,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      style={styles.memberAmountInput}
                      value={member.sharePercent ? String(member.sharePercent) : ''}
                      keyboardType="numeric"
                      onChangeText={(val) => {
                        const pct = parseFloat(val) || 0;
                        setMembers(
                          members.map((m) =>
                            m.id === member.id
                              ? {
                                  ...m,
                                  sharePercent: pct,
                                  amount: (totalExpense * pct) / 100,
                                }
                              : m,
                          ),
                        );
                      }}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.memberCurrency}>%</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.memberAmountBox,
                    splitMethod !== 'equal' && {
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={styles.memberCurrency}>₹</Text>
                  {splitMethod === 'equal' || splitMethod === 'percent' ? (
                    <Text style={styles.memberAmount}>{member.amount.toFixed(2)}</Text>
                  ) : (
                    <TextInput
                      style={styles.memberAmountInput}
                      value={member.amount ? String(member.amount) : ''}
                      keyboardType="numeric"
                      onChangeText={(val) => {
                        const num = parseFloat(val) || 0;
                        setMembers(
                          members.map((m) => (m.id === member.id ? { ...m, amount: num } : m)),
                        );
                      }}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                    />
                  )}
                </View>
                {member.id !== 'you' && (
                  <TouchableOpacity
                    onPress={() => handleRemoveFriend(member.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Add Friend */}
            <TouchableOpacity
              style={styles.addFriendBtn}
              onPress={() => {
                friendSearchRef.current?.focus();
              }}
            >
              <Ionicons name="person-add" size={18} color={colors.primary} />
              <Text style={styles.addFriendText}>Add Friend</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Total To Receive */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)}>
            <LinearGradient
              colors={[colors.primary, '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalCard}
            >
              <View>
                <Text style={styles.totalLabel}>TOTAL TO RECEIVE</Text>
                <Text style={styles.totalAmount}>{formatCurrency(totalToReceive)}</Text>
                <Text style={styles.totalSub}>
                  from {members.filter((m) => m.role === 'member').length} people
                </Text>
              </View>
              <View style={styles.totalAvatars}>
                {members
                  .filter((m) => m.role === 'member')
                  .slice(0, 3)
                  .map((m) => (
                    <View key={m.id} style={styles.totalAvatarCircle}>
                      <Text style={styles.totalAvatarText}>{getInitial(m.name)}</Text>
                    </View>
                  ))}
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showTransactionModal ? (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTransactionModal(false)}
          />
          <Animated.View
            entering={FadeInDown.duration(250)}
            style={[styles.modalContent, { backgroundColor: colors.bgCard }]}
          >
            <View style={styles.modalHeader}>
              <Text style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary }}>Select Expense</Text>
              <TouchableOpacity onPress={() => setShowTransactionModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {transactions.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.modalTxRow}
                  onPress={() => {
                    setSelectedTransaction(t);
                    setShowTransactionModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...TYPOGRAPHY.bodyMedium,
                        color: colors.textPrimary,
                        fontWeight: '600',
                      }}
                    >
                      {t.merchant || t.notes || 'Unnamed expense'}
                    </Text>
                    <Text
                      style={{
                        ...TYPOGRAPHY.caption,
                        color: colors.textMuted,
                      }}
                    >
                      {new Date(t.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...TYPOGRAPHY.bodyMedium,
                      color: colors.expense,
                      fontWeight: '700',
                    }}
                  >
                    {formatCurrency(t.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
              {transactions.length === 0 ? (
                <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
                  <Text
                    style={{
                      color: colors.textMuted,
                      marginTop: 12,
                      textAlign: 'center',
                    }}
                  >
                    No expense transactions found.{'\n'}Add a transaction first.
                  </Text>
                </View>
              ) : null}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}

      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => {
          setPopupConfig((prev) => ({ ...prev, visible: false }));
          if (popupConfig.onClose) setTimeout(popupConfig.onClose, 300);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    title: { ...TYPOGRAPHY.h3, color: colors.textPrimary, fontWeight: '700' },
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    paidBy: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    expenseName: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 4,
    },
    expenseAmount: {
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },

    // Sections
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: SPACING.sm,
    },
    friendsDropdown: {
      position: 'absolute',
      top: 60,
      left: 0,
      right: 0,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      zIndex: 100,
      padding: 4,
    },
    friendDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(150,150,150,0.2)',
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

    // Method
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
    methodBtnActive: { backgroundColor: colors.primary },
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
      borderRadius: 10,
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
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
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
    memberAmountText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    statusToggle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
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
    totalLabel: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
      marginTop: 4,
    },
    totalSub: {
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

    // Detail view
    detailHero: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      overflow: 'hidden',
    },
    detailHeroBlob: {
      position: 'absolute',
      right: -30,
      top: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    detailHeroLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
    },
    detailHeroAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginTop: 4,
    },
    detailHeroMeta: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 12,
    },
    detailHeroMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    detailHeroMetaText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '500',
    },

    // Status row
    statusRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    statusCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statusValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 4,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      padding: SPACING.md,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      borderRadius: RADIUS.xl,
      maxHeight: Platform.OS === 'ios' ? '85%' : '90%',
      alignSelf: 'stretch',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    modalTxRow: {
      padding: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
  });
}
