import {
  createTransaction,
  getTransactions,
  updateTransaction,
} from "@/modules/transactions/transactionsService";

const recurrenceToDays = (recurrence: string | null): number => {
  switch (recurrence) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "yearly":
      return 365;
    default:
      return 0;
  }
};

export const processRecurringTransactions = async () => {
  const all = await getTransactions();
  const now = Date.now();
  for (const txn of all) {
    if (!txn.isRecurring || !txn.recurrence) continue;
    const intervalDays = recurrenceToDays(txn.recurrence);
    if (!intervalDays) continue;
    const lastDate = new Date(txn.date).getTime();
    if (now - lastDate >= intervalDays * 24 * 60 * 60 * 1000) {
      const nextDate = lastDate + intervalDays * 24 * 60 * 60 * 1000;
      const newTx = {
        ...txn,
        id: undefined as any,
        date: nextDate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await createTransaction(newTx as any);
      // update original transaction as processed timestamp
      await updateTransaction(txn.id, { date: nextDate });
    }
  }
};
