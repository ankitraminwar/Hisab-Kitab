import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
      'Open Settings to review your profile, appearance, biometric lock, and SMS options.',
      'Add your bank, cash, wallet, or UPI accounts from Settings -> Bank Accounts.',
      'If you sign in, cloud sync can back up your data when you are online.',
    ],
  },
  {
    title: '2. Add your first transaction',
    steps: [
      'Tap the + button from the dashboard or transactions screen.',
      'Choose Expense, Income, or Transfer.',
      'Enter amount, select account and category, then save.',
    ],
  },
  {
    title: '3. Track your monthly progress',
    steps: [
      'Use Dashboard for balance, recent transactions, and quick actions.',
      'Use Budgets to set monthly limits by category.',
      'Use Reports to review category spending and trends.',
    ],
  },
];

const FLOW_GUIDES: HelpStep[] = [
  {
    title: 'Transaction flow',
    steps: [
      'Expense decreases the selected account balance.',
      'Income increases the selected account balance.',
      'Transfer moves the same amount from one account to another.',
    ],
  },
  {
    title: 'Split expense flow',
    steps: [
      'Create or open an expense transaction.',
      'Tap Split This Expense and choose Equal, Exact, or Percent.',
      'Add members, save the split, and later mark each member as paid or pending.',
    ],
  },
  {
    title: 'Backup and sync flow',
    steps: [
      'Every change is saved locally first, so the app works offline.',
      'If you are signed in, Sync Now or background sync sends updates to the cloud.',
      'Export Data creates CSV, PDF, or JSON files. Import Backup restores JSON backups.',
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
    a: 'Choose Transfer, select the source account and destination account, then save the amount. The app subtracts from one account and adds to the other automatically.',
  },
  {
    q: 'How do budgets help me?',
    a: 'Budgets let you set a monthly category limit. You can quickly see spent amount, remaining amount, and alerts when you approach or exceed the limit.',
  },
  {
    q: 'How does split expense work?',
    a: 'A split is linked to an expense transaction. You can add friends to a split, divide the amount equally, by exact values, or by percentages, then track which friends have paid.',
  },
  {
    q: 'How does SMS import work?',
    a: 'Enable SMS Auto-import in Settings or open the SMS Import screen. On Android native builds, the app reads transaction-like bank messages and lets you review them before import.',
  },
  {
    q: 'Will the app work without internet?',
    a: 'Yes. The app is offline-first, so data is stored on your device immediately. If you are signed in, sync uploads changes later when internet is available.',
  },
  {
    q: 'How do I back up my data?',
    a: 'Go to Settings -> Export Data. CSV is good for spreadsheets, PDF is good for readable reports, and JSON is best for full backup and restore.',
  },
  {
    q: 'How do I restore a backup?',
    a: 'Go to Settings -> Import Backup and choose a JSON backup file exported from the app. Imported records are merged into your current local data.',
  },
  {
    q: 'How do reports and email summaries work?',
    a: 'Reports screen shows your trends and category breakdown inside the app. Email Monthly Report sends a summary to your signed-in email address.',
  },
  {
    q: 'How do I secure the app?',
    a: 'Enable Biometric Lock from Settings. Once enabled, the app can require fingerprint or face authentication when opening it again.',
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="FAQ & Help" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="help-circle" size={34} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              Understand the app faster
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Start with the basic flows below, then open the questions for more detail.
            </Text>
          </View>
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
