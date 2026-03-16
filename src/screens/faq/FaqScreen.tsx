import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    q: 'How do I add a transaction?',
    a: 'Tap the + button on the dashboard or transactions screen. Choose a type (expense, income, or transfer), enter the amount, pick a category, and tap Done.',
  },
  {
    q: 'How does the transfer feature work?',
    a: 'Select "Transfer" as the transaction type, choose your source (payment) account and a destination account, then enter the amount. The balance moves from one account to the other.',
  },
  {
    q: 'How do I set up a budget?',
    a: 'Go to the Budgets tab, tap the + icon, select a category and enter your monthly limit. You will see alerts when spending reaches 80% or exceeds the budget.',
  },
  {
    q: 'How does SMS import work?',
    a: 'Enable SMS Auto-import in Settings, then tap "Run manual SMS check now" or open the SMS Import screen. The app scans your inbox for transaction messages (debit/credit), lets you review and select which ones to import.',
  },
  {
    q: 'Is my data synced to the cloud?',
    a: 'Yes. When you are signed in, data syncs automatically to Supabase when you are online. You can also tap "Sync Now" in Settings. All data is stored locally first (offline-first) so the app works without internet.',
  },
  {
    q: 'How do I export my data?',
    a: 'Go to Settings → Export Data. You can export as CSV (for spreadsheets) or JSON (for backup). Use Import Backup to restore a JSON backup.',
  },
  {
    q: 'Can I split an expense with friends?',
    a: 'Yes. After creating an expense transaction, open it and tap "Split This Expense". You can divide the cost equally, by exact amounts, or by percentage among participants.',
  },
  {
    q: 'How do I change the app theme?',
    a: 'Go to Settings → Appearance and choose Light, Dark, or System (follows your device setting).',
  },
  {
    q: 'What happens if I delete a transaction?',
    a: 'The transaction is soft-deleted and the corresponding account balance is adjusted. If cloud sync is enabled, the deletion syncs to the server as well.',
  },
  {
    q: 'How do I enable biometric lock?',
    a: 'Go to Settings and toggle Biometric Lock. You will need to authenticate once to enable it. After that, the app requires fingerprint or face unlock to open.',
  },
];

const FaqItemCard: React.FC<{
  item: FaqItem;
  colors: ThemeColors;
}> = ({ item, colors }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded((v) => !v)}
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: expanded ? colors.primary + '40' : colors.border,
        marginBottom: SPACING.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            ...TYPOGRAPHY.body,
            color: colors.textPrimary,
            fontWeight: '700',
            flex: 1,
            marginRight: SPACING.sm,
          }}
        >
          {item.q}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>
      {expanded && (
        <Text
          style={{
            ...TYPOGRAPHY.body,
            color: colors.textSecondary,
            marginTop: SPACING.sm,
            lineHeight: 22,
          }}
        >
          {item.a}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default function FaqScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="FAQ & Help" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.heroCard}>
            <Ionicons name="help-circle" size={40} color={colors.primary} />
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroSubtitle}>
              Find answers to common questions below
            </Text>
          </View>
        </Animated.View>

        {FAQ_DATA.map((item, idx) => (
          <Animated.View
            key={idx}
            entering={FadeInDown.duration(400).delay(100 + idx * 50)}
          >
            <FaqItemCard item={item} colors={colors} />
          </Animated.View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.md, paddingBottom: 40 },
    heroCard: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    heroTitle: {
      ...TYPOGRAPHY.h2,
      color: colors.textPrimary,
      marginTop: SPACING.sm,
    },
    heroSubtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
