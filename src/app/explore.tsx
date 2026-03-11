import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import {
  deleteTransaction,
  getTransactions,
  TransactionEntity,
} from "@/modules/transactions/transactionsService";

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<TransactionEntity[]>([]);
  const [search, setSearch] = useState("");
  const theme = useTheme();
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    const tx = await getTransactions({ search });
    setTransactions(tx);
  }, [search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteItem = async (id: string) => {
    await deleteTransaction(id);
    Alert.alert("Deleted", "Transaction removed successfully");
    refresh();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <ThemedText type="title">Transactions</ThemedText>
        <Pressable
          onPress={() => router.push("/add-transaction")}
          style={styles.addButton}
        >
          <ThemedText type="smallBold">+ Add</ThemedText>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by merchant, tags, notes"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.search,
          { borderColor: theme.textSecondary, color: theme.text },
        ]}
      />

      <FlashList
        data={transactions}
        estimatedItemSize={70}
        renderItem={({ item }) => (
          <ThemedView
            style={[styles.item, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.itemRow}>
              <ThemedText type="smallBold">
                {item.merchant || item.categoryId || "Transaction"}
              </ThemedText>
              <ThemedText>
                {item.type === "expense" ? "-" : "+"}₹{item.amount}
              </ThemedText>
            </View>
            <ThemedText>{new Date(item.date).toLocaleDateString()}</ThemedText>
            <View style={styles.itemActions}>
              <Pressable
                onPress={() => router.push(`/add-transaction?id=${item.id}`)}
              >
                <ThemedText type="smallBold">Edit</ThemedText>
              </Pressable>
              <Pressable onPress={() => deleteItem(item.id)}>
                <ThemedText type="smallBold" style={{ color: "red" }}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: { padding: 8, backgroundColor: "#208AEF", borderRadius: 8 },
  search: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  item: { borderRadius: 10, padding: 12, marginBottom: 10 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  itemActions: { flexDirection: "row", gap: 24, marginTop: 8 },
});
