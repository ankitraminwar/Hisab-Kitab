import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
    COLORS,
    SPACING,
    TYPOGRAPHY,
    formatCurrency
} from "../utils/constants";
import { Transaction } from "../utils/types";

interface TransactionItemProps {
  item: Transaction;
  onPress?: (t: Transaction) => void;
  onLongPress?: (t: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  onPress,
  onLongPress,
}) => {
  const amountColor =
    item.type === "income"
      ? COLORS.income
      : item.type === "expense"
        ? COLORS.expense
        : COLORS.transfer;

  const prefix =
    item.type === "income" ? "+" : item.type === "expense" ? "-" : "↔";

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.iconBg,
          { backgroundColor: (item.categoryColor || COLORS.primary) + "20" },
        ]}
      >
        <Ionicons
          name={(item.categoryIcon || "receipt-outline") as any}
          size={22}
          color={item.categoryColor || COLORS.primary}
        />
      </View>

      <View style={styles.details}>
        <Text style={styles.merchant} numberOfLines={1}>
          {item.merchant || item.categoryName || "Transaction"}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{item.categoryName}</Text>
          {item.tags.length > 0 && (
            <>
              <View style={styles.dot} />
              <Text style={styles.tag}>{item.tags[0]}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {prefix}
          {formatCurrency(item.amount)}
        </Text>
        <Text style={styles.date}>{format(new Date(item.date), "dd MMM")}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default memo(TransactionItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  details: {
    flex: 1,
    gap: 3,
  },
  merchant: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  category: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  tag: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  right: {
    alignItems: "flex-end",
    gap: 3,
  },
  amount: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: "700",
  },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
});
