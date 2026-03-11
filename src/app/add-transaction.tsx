import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { getAccounts } from "@/modules/accounts/accountsService";
import { builtInCategories } from "@/modules/data/defaultCategories";
import {
  createTransaction,
  getTransactionById,
  TransactionEntity,
  updateTransaction,
} from "@/modules/transactions/transactionsService";

export default function AddTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [transaction, setTransaction] = useState<Partial<TransactionEntity>>({
    type: "expense",
    amount: 0,
    date: Date.now(),
    isRecurring: false,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [category, setCategory] = useState("food");
  const [accountId, setAccountId] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const fetchedAccounts = await getAccounts();
      setAccounts(fetchedAccounts);
      if (fetchedAccounts.length > 0 && !accountId) {
        setAccountId(fetchedAccounts[0].id);
      }

      if (id) {
        const t = await getTransactionById(id);
        if (t) {
          setTransaction(t);
          setCategory(t.categoryId || "food");
          setAccountId(t.accountId || null);
        }
      }
    })();
  }, [id, accountId]);

  const onSave = async () => {
    const amount = Number(transaction.amount || 0);
    if (!amount || !transaction.type) {
      Alert.alert("Validation", "Amount and type are required");
      return;
    }

    const payload = {
      amount,
      type: transaction.type as TransactionEntity["type"],
      categoryId: category,
      accountId: accountId ?? null,
      merchant: transaction.merchant || "",
      notes: transaction.notes || "",
      tags: transaction.tags || "",
      date: transaction.date || Date.now(),
      isRecurring: transaction.isRecurring ?? false,
      recurrence: transaction.recurrence ?? null,
    };

    if (id) {
      await updateTransaction(id, payload as TransactionEntity);
    } else {
      await createTransaction(payload as any);
    }

    Alert.alert("Saved", "Transaction saved successfully");
    router.push("/explore");
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">
            {id ? "Edit" : "Add"} Transaction
          </ThemedText>
          <TextInput
            placeholder="Amount"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={transaction.amount?.toString() ?? ""}
            onChangeText={(text) =>
              setTransaction((prev) => ({ ...prev, amount: Number(text) }))
            }
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
          />
          <TextInput
            placeholder="Merchant"
            placeholderTextColor={theme.textSecondary}
            value={transaction.merchant || ""}
            onChangeText={(text) =>
              setTransaction((prev) => ({ ...prev, merchant: text }))
            }
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
          />
          <TextInput
            placeholder="Notes"
            placeholderTextColor={theme.textSecondary}
            value={transaction.notes || ""}
            onChangeText={(text) =>
              setTransaction((prev) => ({ ...prev, notes: text }))
            }
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
          />
          <TextInput
            placeholder="Tags (comma separated)"
            placeholderTextColor={theme.textSecondary}
            value={transaction.tags || ""}
            onChangeText={(text) =>
              setTransaction((prev) => ({ ...prev, tags: text }))
            }
            style={[
              styles.input,
              { borderColor: theme.textSecondary, color: theme.text },
            ]}
          />

          <View style={styles.typeRow}>
            <Button
              title="Expense"
              color={transaction.type === "expense" ? "#208AEF" : "#999"}
              onPress={() => setTransaction((p) => ({ ...p, type: "expense" }))}
            />
            <Button
              title="Income"
              color={transaction.type === "income" ? "#208AEF" : "#999"}
              onPress={() => setTransaction((p) => ({ ...p, type: "income" }))}
            />
            <Button
              title="Transfer"
              color={transaction.type === "transfer" ? "#208AEF" : "#999"}
              onPress={() =>
                setTransaction((p) => ({ ...p, type: "transfer" }))
              }
            />
          </View>

          <ThemedText type="smallBold">Category</ThemedText>
          {builtInCategories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              style={[
                styles.categoryButton,
                {
                  backgroundColor:
                    category === cat.id ? "#208AEF" : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                style={{ color: category === cat.id ? "#fff" : theme.text }}
              >
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}

          <ThemedText type="smallBold">Account</ThemedText>
          {accounts.map((acct) => (
            <Pressable
              key={acct.id}
              onPress={() => setAccountId(acct.id)}
              style={[
                styles.categoryButton,
                {
                  backgroundColor:
                    accountId === acct.id ? "#208AEF" : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                style={{ color: accountId === acct.id ? "#fff" : theme.text }}
              >
                {acct.name}
              </ThemedText>
            </Pressable>
          ))}

          <Button title="Save" onPress={onSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10 },
  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 8,
  },
  categoryButton: { borderRadius: 8, padding: 8, marginVertical: 2 },
});
