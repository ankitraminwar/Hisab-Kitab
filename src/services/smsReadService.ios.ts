export interface ParsedSms {
  id: string;
  sender: string;
  body: string;
  date: number;
  amount: number;
  type: 'expense' | 'income';
  merchant: string;
  categoryName: string;
}

export const SmsReadService = {
  async requestPermission(): Promise<boolean> {
    return false;
  },
  async scanSms(_minDate?: number): Promise<ParsedSms[]> {
    return [];
  },
  async importTransactions(_smsList: ParsedSms[]) {
    return { imported: 0, skipped: 0 };
  },
};
