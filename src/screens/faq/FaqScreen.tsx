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
      'Tap the + button on the dashboard or the Transactions screen.',
      'Choose Expense, Income, or Transfer, then enter amount, account, and category.',
      'Enable Recurring to repeat the transaction daily, weekly, or monthly automatically.',
    ],
  },
  {
    title: '3. Track your monthly progress',
    steps: [
      'Use the Dashboard for balance overview, donut chart, savings ring, and quick actions.',
      'Use Budgets to set monthly spending limits per category and get alerts.',
      'Use Reports to review trends, category breakdown, and exportable financial reports.',
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
    title: 'Backup and sync flow',
    steps: [
      'Every change is saved locally first — the app works fully offline.',
      'If you are signed in, background sync quietly pushes updates to the cloud.',
      'Export Data creates CSV, PDF, or JSON files. Import Backup restores JSON exports.',
    ],
  },
];

const FAQ_DATA: FaqItem[] = [
  {
    q: 'How do I add a transaction?',
    a: 'Tap the + button on the dashboard or transactions screen. Choose the type, enter amount, select account and category, add notes if needed, then save.',
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
    a: 'Budgets let you set a monthly category limit. You can see spent vs. remaining amounts and get alerts when you reach 80% or exceed the limit.',
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
    q: 'How does SMS import work?',
    a: 'Enable SMS import in Settings or open the SMS Import screen. On Android native builds, the app reads transaction-like bank messages and lets you review them before importing.',
  },
  {
    q: 'How do the home screen widgets work?',
    a: 'On Android, long-press your home screen, select Widgets, and choose from Expense Summary, Budget Health, or Quick Add. Widgets update automatically and Quick Add lets you log a transaction without opening the app.',
  },
  {
    q: 'Will the app work without internet?',
    a: 'Yes. The app is offline-first — data is stored on your device immediately. If you are signed in, sync uploads changes in the background when internet is available.',
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
    q: 'How do reports and email summaries work?',
    a: 'The Reports screen shows trends, category breakdown, and net worth inside the app. Email Monthly Report sends a formatted PDF summary to your signed-in email address.',
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
            <View style={[styles.heroIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Ionicons name="help-circle" size={34} color="#FFF" />
            </View>
            <Text style={[styles.heroTitle, { color: '#FFF' }]}>Understand the app faster</Text>
            <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
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
