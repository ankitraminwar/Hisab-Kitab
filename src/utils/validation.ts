import { z } from 'zod/v4';

// ─── Transaction Schema ───────────────────────────────────────────────────────
export const transactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.string().min(1, 'Category is required'),
  accountId: z.string().min(1, 'Account is required'),
  toAccountId: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Budget Schema ────────────────────────────────────────────────────────────
export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Select a category'),
  limitAmount: z.number().positive('Budget amount must be greater than zero'),
  alertAt: z.number().min(1).max(100).default(80),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;

// ─── Goal Schema ──────────────────────────────────────────────────────────────
export const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required').max(100, 'Name too long'),
  targetAmount: z.number().positive('Target amount must be greater than zero'),
  deadline: z.string().min(1, 'Deadline is required'),
  color: z.string().default('#7C3AED'),
  icon: z.string().default('flag'),
});

export type GoalFormData = z.infer<typeof goalSchema>;

// ─── Note Schema ──────────────────────────────────────────────────────────────
export const noteSchema = z
  .object({
    title: z.string().max(200, 'Title too long').optional(),
    content: z.string().max(10000, 'Content too long').optional(),
    color: z.string().default('#7C3AED'),
    isPinned: z.boolean().default(false),
  })
  .refine((data) => data.title?.trim() || data.content?.trim(), {
    message: 'Note must have a title or content',
  });

export type NoteFormData = z.infer<typeof noteSchema>;

// ─── Fund Goal Schema ─────────────────────────────────────────────────────────
export const fundGoalSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
});

export type FundGoalFormData = z.infer<typeof fundGoalSchema>;
