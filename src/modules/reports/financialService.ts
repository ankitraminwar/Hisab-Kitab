import { getAccounts } from "@/modules/accounts/accountsService";
import { getBudgets } from "@/modules/budgets/budgetsService";
import { getGoals } from "@/modules/goals/goalsService";
import { getTransactions } from "@/modules/transactions/transactionsService";

export type FinancialSummary = {
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  savingsRate: number;
  netWorth: number;
  budgets: {
    categoryId: string;
    limitAmount: number;
    used: number;
    remaining: number;
  }[];
  goalsProgress: { name: string; progress: number }[];
};

export const getFinancialSummary = async (): Promise<FinancialSummary> => {
  const [accounts, transactions, budgets, goals] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getBudgets(),
    getGoals(),
  ]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const savingsRate =
    totalIncome > 0
      ? Math.max(0, (totalIncome - totalExpense) / totalIncome)
      : 0;
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0); // can extend with liability + assets

  const budgetByCategory = budgets.map((budget) => {
    const used = transactions
      .filter((t) => t.categoryId === budget.categoryId && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      categoryId: budget.categoryId,
      limitAmount: budget.limitAmount,
      used,
      remaining: Math.max(0, budget.limitAmount - used),
    };
  });

  const goalsProgress = goals.map((goal) => ({
    name: goal.name,
    progress:
      goal.targetAmount > 0
        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
        : 0,
  }));

  return {
    totalIncome,
    totalExpense,
    totalBalance,
    savingsRate,
    netWorth,
    budgets: budgetByCategory,
    goalsProgress,
  };
};
