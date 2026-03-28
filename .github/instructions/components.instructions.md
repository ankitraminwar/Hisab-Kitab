---
name: 'Screen & Component Instructions'
description: 'Rules for all screen and component files'
applyTo: 'src/screens/**/*.tsx,src/components/**/*.tsx,app/**/*.tsx'
---

# Screens & Components — Hisab Kitab

## Mandatory Screen Structure

Every screen must follow this exact pattern without exception:

```tsx
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/appStore';
import { getDatabase } from '@/database';
import type { ThemeColors } from '@/hooks/useTheme';

export default function YourScreen() {
  const { colors } = useTheme(); // 1. always first
  const styles = useMemo(() => createStyles(colors), [colors]); // 2. always memoized
  const dataRevision = useAppStore((s) => s.dataRevision); // 3. triggers re-fetch

  const [data, setData] = useState<YourType[]>([]);

  const fetchData = useCallback(async () => {
    const db = getDatabase(); // synchronous — no await
    const rows = await db.getAllAsync<YourType>(
      `SELECT * FROM your_table WHERE deletedAt IS NULL ORDER BY createdAt DESC`,
      [],
    );
    setData(rows);
  }, []);

  useEffect(() => {
    void fetchData(); // use void, not await
  }, [fetchData, dataRevision]); // dataRevision re-triggers on any write

  return (
    <SafeAreaView style={styles.container}>
      {/* <ScreenHeader title="Screen Title" /> — for non-tab screens only */}
      <ScrollView>{/* content */}</ScrollView>
    </SafeAreaView>
  );
}

// styles function MUST be outside the component, accepting colors as param
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.bgCard, borderColor: colors.border },
    elevated: { backgroundColor: colors.bgElevated },
    input: { backgroundColor: colors.bgInput },
    text: { color: colors.textPrimary },
    muted: { color: colors.textMuted },
  });
}
```

---

## Route Files — Thin Re-Exports

Route files in `app/` are thin wrappers (with one known exception):

```tsx
// app/settings/index.tsx
export { default } from '../../src/screens/settings/SettingsScreen';
```

**Exception**: `app/transactions/[id].tsx` contains routing logic (conditionally renders
`TransactionDetailScreen` vs `AddTransactionScreen` based on `?edit=1`). Do not simplify it.

---

## Theme — No Hardcoded Colors, Ever

```tsx
// CORRECT
const { colors, isDark } = useTheme();
style={{ backgroundColor: colors.bg }}
style={{ color: colors.textPrimary }}
style={{ borderColor: colors.border }}

// WRONG — every one of these is a TypeScript error or violation
import { COLORS } from '@/utils/constants';    // ❌ never in screen/component files
style={{ color: '#8B5CF6' }}                   // ❌ hardcoded hex
style={{ color: '#fff' }}                      // ❌ hardcoded hex
colors.background                              // ❌ key doesn't exist → colors.bg
colors.text                                    // ❌ key doesn't exist → colors.textPrimary
colors.card                                    // ❌ key doesn't exist → colors.bgCard
```

---

## FlashList v2 — No `estimatedItemSize`

```tsx
import { FlashList } from '@shopify/flash-list';

const renderItem = useCallback(
  ({ item }: { item: Transaction }) => <TransactionItem transaction={item} />,
  []
);

// CORRECT — v2 does NOT accept estimatedItemSize
<FlashList
  data={transactions}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  showsVerticalScrollIndicator={false}
/>

// WRONG
<FlashList estimatedItemSize={72} ... />  // ❌ prop removed in v2
<FlatList ... />                           // ❌ use FlashList
<ScrollView>{items.map(...)}</ScrollView>  // ❌ for data lists
```

---

## CustomPopup — Never `Alert.alert`

```tsx
import { CustomPopup } from '@/components/common';

// Info / success
CustomPopup.show({ title: 'Saved', message: 'Transaction added.', type: 'success' });

// Destructive confirmation
CustomPopup.show({
  title: 'Delete Transaction',
  message: 'This cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  type: 'danger',
  onConfirm: () => handleDelete(id),
});

// WRONG — never, anywhere
Alert.alert('Delete', '...', [...]); // ❌

// Success-type popups auto-dismiss after 3 seconds
```

---

## Icons — `IoniconsName` from `src/utils/types.ts`

```tsx
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/utils/types';

// CORRECT
const iconName: IoniconsName = 'wallet-outline';
<Ionicons name={iconName} size={24} color={colors.primary} />

// Also correct — explicit cast
<Ionicons name={'wallet-outline' as IoniconsName} size={24} />

// WRONG
<Ionicons name="wallet-outline" size={24} />  // ❌ untyped string
<Ionicons name={icon as any} />               // ❌ as any is forbidden
```

---

## Animations — Reanimated ~4.1.1 only

```tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';

// CORRECT — Reanimated worklets
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
<Animated.View entering={FadeInDown} style={animStyle} />

// WRONG — React Native's built-in Animated API is not used in this project
import { Animated } from 'react-native';              // ❌
Animated.timing(val, { useNativeDriver: true, ... }); // ❌
```

---

## Haptic Feedback

Use `expo-haptics` for interactive gestures:

```ts
import * as Haptics from 'expo-haptics';

// For primary button taps, long presses, keypad presses
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

---

## Skia Charts

```tsx
import { Canvas } from '@shopify/react-native-skia';

// Always wrap Skia chart components in <Canvas>
// Provide stable width/height via onLayout or useWindowDimensions
// Never conditionally render <Canvas> — conditionally render content inside it
```

---

## Common Components — Import Guide

```tsx
// Most common components
import {
  Card,
  Button,
  FAB,
  EmptyState,
  CustomPopup,
  CustomSwitch,
  SearchBar,
  ProgressBar,
  SectionHeader,
  StatCard,
  AmountText,
  CategoryBadge,
} from '@/components/common';

// Specific components (separate imports)
import { CategoryGrid } from '@/components/common/CategoryGrid';
import { NumericKeypad } from '@/components/common/NumericKeypad';
import { PeriodTabs } from '@/components/common/PeriodTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';

// Transaction row
import { TransactionItem } from '@/components/TransactionItem';
```

Use `ScreenHeader` for back-navigation in all non-tab screens.
Use `EmptyState` for empty list placeholders (never custom empty views).
Use `Button` (primary/secondary/danger/ghost) for all tappable actions.
Use `AmountText` for all monetary value display.

---

## Component Rules

- Functional components only — no class components
- Every component has an explicit `interface XxxProps {}` — no inline prop types
- Components under `src/components/common/` are presentational — no DB calls, no Supabase
- All types go in `src/utils/types.ts` — never declare new types inside component files
- `DimensionValue` from `react-native` for percentage widths (e.g. `width: '80%'`)

---

## Navigation

```tsx
import { router } from 'expo-router';
import type { Href } from 'expo-router';

router.push('/(tabs)/goals');
router.push('/transactions/add');
router.push(`/transactions/${id}`); // detail view
router.push(`/transactions/${id}?edit=1` as Href); // edit mode
router.push('/splits' as Href); // as Href for untyped routes
router.replace('/login');

// Reading params
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams<{ id: string }>();
```
