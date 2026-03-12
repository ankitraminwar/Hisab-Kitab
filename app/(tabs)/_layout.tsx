import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../src/hooks/useTheme';

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

const TabIcon: React.FC<{ name: string; color: string; focused: boolean }> = ({
  name,
  color,
  focused,
}) => {
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.15 : 1, SPRING_CONFIG) }],
    backgroundColor: focused ? colors.primary + '20' : 'transparent',
  }));

  return (
    <Animated.View style={[iconStyles.container, animatedStyle]}>
      <Ionicons name={name as never} size={22} color={color} />
    </Animated.View>
  );
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'receipt' : 'receipt-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'pie-chart' : 'pie-chart-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'flag' : 'flag-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.bgCard,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 72,
      paddingBottom: 8,
    },
  });
