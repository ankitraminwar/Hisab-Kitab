import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';

interface HelpStep {
  title: string;
  steps: string[];
}

interface FaqItem {
  q: string;
  a: string;
}

const QUICK_START_STEPS: HelpStep[] = [
  {
    title: '1. Set up your account',
    steps: [
      'Open the Accounts tab (bottom navigation) to add your bank, cash, wallet, UPI, or credit card accounts.',
      'A default Cash account is created automatically when you first open the app.',
      'Sign in to enable cloud sync, which backs up your data whenever you are online.',
    ],
  },
  {
    title: '2. Add your first transaction',
    steps: [
      'Tap the + FAB button (bottom centre) to open quick actions: Add Expense, Split Expense, Add Note, or Add Budget.',
      'Choose Expense, Income, or Transfer, then enter amount, account, and category.',
      'Enable Recurring to repeat the transaction daily, weekly, or monthly automatically.',
    ],
  },
  {
    title: '3. Track your monthly progress',
    steps: [
      'Use the Dashboard for balance overview, spending donut chart, savings ring, and quick actions.',
      'Use Budgets to set monthly spending limits per category and get an alert (default 80%) before you overspend.',
      'Use Reports to review income/expense trend charts, category breakdown, and exportable financial reports.',
    ],
  },
];

const FLOW_GUIDES: HelpStep[] = [
  {
    title: 'Transaction flow',
    steps: [
      'Expense decreases the selected account balance.',
      'Income increases the selected account balance.',
      'Transfer moves the same amount from one account to another — both balances update.',
      'Recurring transactions auto-generate future entries on the chosen schedule.',
      'Swipe a transaction card left to reveal Edit and Delete action buttons.',
      'Tap a transaction card to open a quick preview with Edit and Delete options.',
    ],
  },
  {
    title: 'Split expense flow',
    steps: [
      'Open Split Expenses from the Splits screen or create an expense and tap Split This Expense.',
      'Choose Equal, Exact Amount, or Percentage split and add members.',
      'Swipe left/right on the Splits screen or tap the tabs to switch between By Split and By Friend views.',
      'Tap a friend card to see your full balance history with that person.',
    ],
  },
  {
    title: 'Notes flow',
    steps: [
      'Access Notes from the Home screen quick action or the bottom navigation.',
      'Create colour-coded notes with rich text for financial reminders, goals, or ideas.',
      'Notes are stored locally and sync to the cloud when you are signed in.',
    ],
  },
  {
    title: 'Filtering and searching transactions',
    steps: [
      'Use the search bar on the Transactions screen to find by category, account, or notes.',
      'Tap the filter icon to open the filter sheet and filter by type, category, account, or date range.',
      'Quick date chips (Last 7 Days, This Month, Last Month) appear in the filter bar for fast access.',
      'Active filters are shown as chips below the search bar — tap one to remove it.',
    ],
  },
  {
    title: 'Backup and sync flow',
    steps: [
      'Every change is saved locally first — the app works fully offline.',
      'If you are signed in, background sync quietly pushes updates to the cloud.',
      'Conflicts are resolved automatically: the most recently updated record wins. Deleted-and-recreated items sync cleanly without errors.',
      'Export Data creates CSV, PDF, or JSON files. Import Backup restores JSON exports.',
    ],
  },
];

const FAQ_DATA: FaqItem[] = [
  {
    q: 'How do I add a transaction?',
    a: 'Tap the + FAB button at the bottom centre of any tab screen. Choose Add Expense from the quick-action menu, select the type, enter the amount, pick an account and category, then save.',
  },
  {
    q: 'How does transfer work?',
    a: 'Choose Transfer, select the source and destination accounts, then save. The app subtracts from one account and adds to the other automatically.',
  },
  {
    q: 'What are recurring transactions?',
    a: 'When adding a transaction, turn on Recurring and choose a frequency (daily, weekly, monthly). The app auto-creates the next entry on schedule so you never miss a regular expense or income.',
  },
  {
    q: 'How do budgets help me?',
    a: 'Budgets let you set a monthly category limit. You can see spent vs. remaining amounts and get an alert (default 80%) before you overspend. Each category can only have one active budget per month.',
  },
  {
    q: 'How does split expense work?',
    a: 'A split is linked to an expense transaction. Add friends, divide the amount equally, by exact values, or by percentages, then track who has paid. Swipe between By Split and By Friend tabs to see different views.',
  },
  {
    q: 'How do I view my balance with a specific friend?',
    a: "On the Split Expenses screen, switch to the By Friend tab (swipe left or tap the tab). Tap a friend's card to see your full shared expense history and total balance with them.",
  },
  {
    q: 'What are Notes for?',
    a: 'Notes let you keep colour-coded financial reminders, goal ideas, or quick memos inside the app. Access them from the Home screen quick action or the Notes screen.',
  },
  {
    q: 'What is Net Worth and how does it work?',
    a: 'Net Worth tracks your total assets minus liabilities over time. Add asset accounts (bank, investment) and liability accounts (credit card, loan) in the Accounts tab. Reports shows a snapshot of your net worth for the selected period.',
  },
  {
    q: 'How does offline mode work?',
    a: 'The app is offline-first — every transaction, budget, and note is saved instantly to a local SQLite database on your device. You can use the app fully without any internet connection. Changes sync automatically in the background when you are signed in and online.',
  },
  {
    q: 'How is my data synced?',
    a: 'Every change is saved to your device immediately. If you are signed in, the app quietly pushes updates to the cloud in the background. On next login, it pulls any remote changes and merges them using last-write-wins conflict resolution. If you delete and recreate the same item, sync handles the conflict automatically.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your data is stored locally and encrypted in transit when syncing. In the cloud, row-level security (RLS) ensures only your authenticated account can read, write, or delete your records — no other user can access your data even if they know your record IDs. Enable Biometric Lock in Settings for additional on-device protection.',
  },
  {
    q: 'How do I export my data?',
    a: 'Go to Settings → Export Reports for PDF/CSV, or Export JSON Backup for a full restorable backup. You can also email a monthly report summary.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Contact support to request account deletion. All your cloud data will be permanently removed. Local data on your device can be cleared by uninstalling the app.',
  },
  {
    q: 'Will the app work without internet?',
    a: 'Yes. The app is offline-first — data is stored on your device immediately. If you are signed in, sync uploads changes in the background when internet is available.',
  },
  {
    q: 'How do I edit or delete a transaction?',
    a: 'Swipe a transaction card left to reveal the Edit (blue) and Delete (red) buttons. You can also tap the card to open a quick preview and then choose Edit or Delete from there.',
  },
  {
    q: 'How do I filter transactions?',
    a: 'On the Transactions screen, tap the filter icon (top right) to open the filter sheet. You can filter by transaction type, category, account, or a custom date range. Use the quick-date chips (Last 7 Days, This Month) for instant filtering.',
  },
  {
    q: 'How do reports and trend charts work?',
    a: 'The Reports screen shows Income vs Expenses bars, an Expense Trend line chart, and an Income Trend line chart for the selected period. Swipe between Weekly, Monthly, and Yearly tabs, or tap the arrows to navigate periods. Low/Avg/High stats appear below each chart.',
  },
  {
    q: 'How do I back up my data?',
    a: 'Go to Settings → Export Data. CSV is good for spreadsheets, PDF creates a formatted report, and JSON is best for full backup and restore.',
  },
  {
    q: 'How do I restore a backup?',
    a: 'Go to Settings → Import Backup and choose a JSON file previously exported from the app. Imported records are merged into your existing local data.',
  },
  {
    q: 'How do I send a report by email?',
    a: 'In the Reports screen, tap the share icon (top right) to generate a PDF for the current period. Email Monthly Report in Settings sends a formatted PDF summary to your signed-in email address.',
  },
  {
    q: 'How do I secure the app?',
    a: 'Enable Biometric Lock in Settings. Once enabled, the app requires fingerprint or face authentication each time you open it.',
  },
];

const GuideCard: React.FC<{
  guide: HelpStep;
  colors: ThemeColors;
}> = ({ guide, colors }) => (
  <View
    style={[
      styles.guideCard,
      {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
      },
    ]}
  >
    <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>{guide.title}</Text>
    {guide.steps.map((step) => (
      <View key={step} style={styles.guideRow}>
        <View style={[styles.guideDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.guideText, { color: colors.textSecondary }]}>{step}</Text>
      </View>
    ))}
  </View>
);

const FaqItemCard: React.FC<{
  item: FaqItem;
  colors: ThemeColors;
}> = ({ item, colors }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((value) => !value)}
      style={[
        styles.faqCard,
        {
          backgroundColor: colors.bgCard,
          borderColor: expanded ? colors.primary + '40' : colors.border,
        },
      ]}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>{item.q}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>
      {expanded ? (
        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{item.a}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

export default function FaqScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="FAQ & Help" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(600)}>
          <LinearGradient
            colors={isDark ? ['#4C1D95', '#1E1B4B'] : ['#8B5CF6', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: colors.heroOverlay }]}>
              <Ionicons name="help-circle" size={34} color={colors.heroText} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.heroText }]}>
              Understand the app faster
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.heroTextMuted }]}>
              Start with the basic flows below, then open the questions for more detail.
            </Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Start</Text>
          {QUICK_START_STEPS.map((guide) => (
            <GuideCard key={guide.title} guide={guide} colors={colors} />
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(140)}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Basic Flows</Text>
          {FLOW_GUIDES.map((guide) => (
            <GuideCard key={guide.title} guide={guide} colors={colors} />
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Common Questions</Text>
          {FAQ_DATA.map((item, index) => (
            <Animated.View key={item.q} entering={FadeInDown.duration(400).delay(220 + index * 40)}>
              <FaqItemCard item={item} colors={colors} />
            </Animated.View>
          ))}
        </Animated.View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  guideCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  guideTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  guideDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
  },
  guideText: {
    ...TYPOGRAPHY.body,
    flex: 1,
    lineHeight: 22,
  },
  faqCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    flex: 1,
    marginRight: SPACING.sm,
  },
  faqAnswer: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ...styles,
    container: {
      ...styles.container,
      backgroundColor: colors.bg,
    },
  });
}
