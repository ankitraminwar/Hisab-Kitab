import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const CenterFAB: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 10, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 300 });
      }}
      onPress={() => router.push('/transactions/add')}
      accessibilityLabel="Add transaction"
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          fabStyles.container,
          { backgroundColor: colors.primary, shadowColor: colors.primary },
          animatedStyle,
        ]}
      >
        <Ionicons name="add" size={28} color={colors.heroText} />
      </Animated.View>
    </Pressable>
  );
};

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const styles = React.useMemo(
    () => createStyles(colors, bottom, isDark),
    [colors, bottom, isDark],
  );

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      setToastMsg(msg);
    }
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // A custom wrapper for the bottom tabs to intercept onLongPress
  const CustomTabBarButton = (props: any, name: string) => {
    return (
      <Pressable
        {...props}
        onLongPress={() => showToast(name)}
        style={[props.style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
        android_ripple={{ color: colors.primary + '20', borderless: true, radius: 24 }}
      >
        {props.children}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
          tabBarItemStyle: { paddingTop: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />
            ),
            tabBarButton: (props) => CustomTabBarButton(props, 'Dashboard'),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'receipt' : 'receipt-outline'}
                color={color}
                focused={focused}
              />
            ),
            tabBarButton: (props) => CustomTabBarButton(props, 'History'),
          }}
        />
        <Tabs.Screen
          name="add-placeholder"
          options={{
            title: '',
            tabBarButton: () => <CenterFAB />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="budgets"
          options={{
            title: 'Budgets',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'business' : 'business-outline'}
                color={color}
                focused={focused}
              />
            ),
            tabBarButton: (props) => CustomTabBarButton(props, 'Budgets'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'person' : 'person-outline'}
                color={color}
                focused={focused}
              />
            ),
            tabBarButton: (props) => CustomTabBarButton(props, 'Profile'),
          }}
        />
        {/* Hidden tabs accessible via navigation but not shown in tab bar */}
        <Tabs.Screen
          name="goals"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* iOS Custom Toast */}
      {Platform.OS === 'ios' && toastMsg && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Animated.View
            entering={FadeInDown.springify()}
            exiting={FadeOutDown}
            style={styles.toast}
          >
            <Text style={styles.toastText}>{toastMsg}</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    width: 44, // increased touch target internally
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});

const fabStyles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

const createStyles = (colors: any, bottomInset: number, isDark: boolean) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.bgCard,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 60 + bottomInset,
      paddingBottom: bottomInset > 0 ? bottomInset : 8,
    },
    toastContainer: {
      position: 'absolute',
      bottom: 80 + bottomInset,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 1000,
    },
    toast: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    toastText: {
      color: isDark ? '#000' : '#FFF',
      fontSize: 12,
      fontWeight: '600',
    },
  });
