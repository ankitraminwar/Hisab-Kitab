import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '../../utils/constants';

interface PeriodTabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const PeriodTabs: React.FC<PeriodTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  const { colors } = useTheme();

  const handleTabPress = (tab: string) => {
    if (tab !== activeTab) {
      onTabChange(tab);
    }
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => handleTabPress(tab)}
            style={[
              styles.tab,
              isActive && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            accessibilityLabel={`${tab} period tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isActive ? colors.primary : colors.textMuted,
                  fontWeight: isActive ? '700' : '600',
                },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    minHeight: 44,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
  },
});
