import BottomSheetLib, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';

interface AppBottomSheetProps {
  snapPoints?: (string | number)[];
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  enableScroll?: boolean;
  enableDynamicSizing?: boolean;
}

export const AppBottomSheet = forwardRef<BottomSheetLib, AppBottomSheetProps>(
  (
    {
      snapPoints = ['50%'],
      title,
      children,
      onClose,
      enableScroll = false,
      enableDynamicSizing = false,
    },
    ref,
  ) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={isDark ? 0.6 : 0.35}
        />
      ),
      [isDark],
    );

    const Content = enableScroll ? BottomSheetScrollView : BottomSheetView;

    return (
      <BottomSheetLib
        ref={ref}
        index={-1}
        snapPoints={enableDynamicSizing ? undefined : snapPoints}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        style={styles.sheet}
      >
        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}
        <Content style={styles.content}>{children}</Content>
      </BottomSheetLib>
    );
  },
);

AppBottomSheet.displayName = 'AppBottomSheet';

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    sheet: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 16,
    },
    background: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
    },
    handle: {
      backgroundColor: colors.textMuted,
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.lg,
    },
  });
}
