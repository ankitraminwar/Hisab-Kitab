import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { CategoryService } from './dataServices';
import { TransactionService } from './transactionService';

interface SmsMessage {
  _id: number;
  address: string;
  body: string;
  date: number;
}

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

const TRANSACTION_KEYWORDS = [
  'debited',
  'credited',
  'spent',
  'received',
  'payment',
  'txn',
  'transaction',
];

export const SmsReadService = {
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: 'SMS Permission',
        message: 'Hisab-Kitab needs access to your SMS to import transactions.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  },

  async scanSms(minDate?: number): Promise<ParsedSms[]> {
    if (Platform.OS !== 'android') return [];

    return new Promise((resolve, reject) => {
      const filter = {
        box: 'inbox',
        minDate: minDate || Date.now() - 7 * 24 * 60 * 60 * 1000, // Default last 7 days
      };

      SmsAndroid.list(
        JSON.stringify(filter),
        (fail: string) => {
          console.error('Failed to list SMS:', fail);
          reject(fail);
        },
        async (count: number, smsList: string) => {
          try {
            const messages = JSON.parse(smsList) as SmsMessage[];
            const parsedResults: ParsedSms[] = [];

            for (const msg of messages) {
              const body = msg.body.toLowerCase();
              if (TRANSACTION_KEYWORDS.some((k) => body.includes(k))) {
                const parsed = this.parseMessage(msg);
                if (parsed) parsedResults.push(parsed);
              }
            }
            resolve(parsedResults);
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  },

  parseMessage(msg: SmsMessage): ParsedSms | null {
    const body = msg.body;
    const cleanBody = body.toLowerCase();

    // Simple regex for amounts like "INR 100.00" or "Rs. 100"
    const amountRegex = /(?:rs\.?|inr)\s?(\d+(?:\.\d+)?)/i;
    const match = body.match(amountRegex);

    if (!match) return null;

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount === 0) return null;

    const isExpense =
      cleanBody.includes('debited') || cleanBody.includes('spent') || cleanBody.includes('paid');
    const isIncome = cleanBody.includes('credited') || cleanBody.includes('received');

    if (!isExpense && !isIncome) return null;

    // Try to extract merchant
    let merchant = 'Unknown Merchant';
    const atRegex = /at\s+([^,.\n]+)/i;
    const merchantMatch = body.match(atRegex);
    if (merchantMatch) {
      merchant = merchantMatch[1].trim();
    } else {
      // Common split patterns
      const toRegex = /to\s+([^,.\n]+)/i;
      const toMatch = body.match(toRegex);
      if (toMatch) {
        merchant = toMatch[1].trim();
      }
    }

    return {
      id: msg._id.toString(),
      sender: msg.address,
      body: msg.body,
      date: msg.date,
      amount,
      type: isExpense ? 'expense' : 'income',
      merchant,
      categoryName: 'General', // Default, will be refined in UI or via rules
    };
  },

  async importTransactions(smsList: ParsedSms[]) {
    const categories = await CategoryService.getAll();
    const otherCat = categories.find((c) => c.name === 'Other') || categories[0];

    const { AccountService: AccService } = await import('./dataServices');
    const accounts = await AccService.getAll();
    const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
    const accountId = defaultAccount?.id ?? 'default';

    for (const sms of smsList) {
      await TransactionService.create({
        amount: sms.amount,
        type: sms.type,
        categoryId: otherCat.id,
        accountId,
        merchant: sms.merchant,
        notes: `Imported from SMS: ${sms.body.substring(0, 50)}...`,
        date: new Date(sms.date).toISOString().split('T')[0],
        paymentMethod: 'other',
        isRecurring: false,
        tags: ['sms-import'],
      });
    }
  },
};
