import { TransactionEntity } from "@/modules/transactions/transactionsService";

export const asCSV = (transactions: TransactionEntity[]): string => {
  const header =
    "id,amount,type,categoryId,accountId,merchant,notes,tags,date,createdAt,updatedAt";
  const rows = transactions.map((t) =>
    [
      t.id,
      t.amount,
      t.type,
      t.categoryId ?? "",
      t.accountId ?? "",
      (t.merchant ?? "").replace(/\n/g, " "),
      (t.notes ?? "").replace(/\n/g, " "),
      (t.tags ?? "").replace(/\n/g, " "),
      t.date,
      t.createdAt,
      t.updatedAt,
    ].join(","),
  );
  return [header, ...rows].join("\n");
};

export const asJSON = (transactions: TransactionEntity[]): string =>
  JSON.stringify({ transactions }, null, 2);
