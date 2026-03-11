import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { initDatabase } from "@/database/schema";
import { initNotifications } from "@/services/notifications";
import { processRecurringTransactions } from "@/services/recurrence";

const queryClient = new QueryClient();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initDatabase();
    initNotifications();
    processRecurringTransactions();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
