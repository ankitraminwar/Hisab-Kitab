import React, { useEffect, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { configureAppwrite } from "@/services/appwrite";
import {
  authenticateBiometric,
  getPin,
  removePin,
  setPin,
} from "@/services/auth";

export default function SettingsScreen() {
  const [pin, setPinState] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [appwriteEndpoint, setAppwriteEndpoint] = useState("");
  const [appwriteProject, setAppwriteProject] = useState("");
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      setStoredPin(await getPin());
    })();
  }, []);

  const savePin = async () => {
    if (pin.length < 4) return Alert.alert("PIN must be at least 4 digits");
    await setPin(pin);
    setStoredPin(pin);
    setPinState("");
    Alert.alert("Success", "PIN saved");
  };

  const clearPin = async () => {
    await removePin();
    setStoredPin(null);
    Alert.alert("Removed", "App lock PIN cleared");
  };

  const tryBio = async () => {
    const success = await authenticateBiometric();
    Alert.alert(
      success ? "Authenticated" : "Failed",
      success ? "Biometric OK" : "Biometric failed",
    );
  };

  const saveAppwrite = () => {
    configureAppwrite(appwriteEndpoint, appwriteProject);
    Alert.alert("Appwrite", "Appwrite configured (for sync)");
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Settings</ThemedText>

        <ThemedView
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="subtitle">Security</ThemedText>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
            value={pin}
            onChangeText={setPinState}
            placeholder="Set PIN"
            secureTextEntry
            placeholderTextColor={theme.textSecondary}
          />
          <Button title="Save PIN" onPress={savePin} />
          <Button title="Clear PIN" onPress={clearPin} color="red" />
          <Button title="Test Biometric" onPress={tryBio} />
          <ThemedText>Stored PIN: {storedPin ? "****" : "Not set"}</ThemedText>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="subtitle">Cloud Sync (Appwrite)</ThemedText>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
            value={appwriteEndpoint}
            onChangeText={setAppwriteEndpoint}
            placeholder="Appwrite URL"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
            value={appwriteProject}
            onChangeText={setAppwriteProject}
            placeholder="Project ID"
            placeholderTextColor={theme.textSecondary}
          />
          <Button title="Configure Appwrite" onPress={saveAppwrite} />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10 },
  card: { borderRadius: 10, padding: 12 },
});
