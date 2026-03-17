import NetInfo from '@react-native-community/netinfo';
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';

import { getSyncState, setSyncState } from '../database';
import { useAppStore } from '../store/appStore';
import type {
  Account,
  Category,
  PaymentMethod,
  TransactionType,
} from '../utils/types';
import {
  AccountService,
  CategoryService,
  UserProfileService,
} from './dataServices';
import { triggerBackgroundSync } from './syncService';
import { TransactionService } from './transactionService';

const SMS_IMPORT_STATE_KEY = 'sms.lastImportedAt';
const SMS_POLL_INTERVAL_MS = 60_000;
const INITIAL_IMPORT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

type SmsMessage = {
  _id: string | number;
  address?: string;
  body?: string;
  date: number;
  read?: number;
};

type ParsedSmsTransaction = {
  messageId: string;
  amount: number;
  type: TransactionType;
  merchant?: string;
  paymentMethod: PaymentMethod;
  date: string;
  accountId: string;
  categoryId: string;
  notes: string;
  tags: string[];
};

export interface SmsImportResult {
  granted: boolean;
  supported: boolean;
  importedCount: number;
  message: string;
}

const BANK_SENDERS = [
  'VK',
  'VM',
  'AX',
  'AD',
  'BZ',
  'ICICI',
  'HDFC',
  'SBI',
  'KOTAK',
  'AXIS',
  'BOI',
  'PNB',
  'IDFC',
  'PAYTM',
  'GPAY',
  'PHONEPE',
];

const normalizeAmount = (value: string) => Number(value.replace(/,/g, ''));

const extractAmount = (body: string): number | null => {
  const patterns = [
    /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i,
    /([0-9,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      const amount = normalizeAmount(match[1]);
      if (Number.isFinite(amount) && amount > 0) {
        return amount;
      }
    }
  }

  return null;
};

const detectType = (body: string): TransactionType | null => {
  const normalized = body.toLowerCase();

  if (
    /(credited|deposit|salary|refund|received|cashback)/i.test(normalized) &&
    !/(debited|spent|withdrawn|sent|paid)/i.test(normalized)
  ) {
    return 'income';
  }

  if (
    /(debited|spent|withdrawn|sent|paid|purchase|dr\b|txn)/i.test(normalized)
  ) {
    return 'expense';
  }

  return null;
};

const detectPaymentMethod = (body: string): PaymentMethod => {
  const normalized = body.toLowerCase();

  if (normalized.includes('upi')) {
    return 'upi';
  }
  if (normalized.includes('credit card')) {
    return 'credit_card';
  }
  if (normalized.includes('debit card')) {
    return 'debit_card';
  }
  if (normalized.includes('wallet')) {
    return 'wallet';
  }
  if (normalized.includes('atm') || normalized.includes('cash withdrawal')) {
    return 'cash';
  }
  if (
    normalized.includes('bank') ||
    normalized.includes('imps') ||
    normalized.includes('neft') ||
    normalized.includes('rtgs')
  ) {
    return 'bank_transfer';
  }

  return 'other';
};

const extractMerchant = (
  body: string,
  address?: string,
): string | undefined => {
  const patterns = [
    /(?:at|to|towards|for)\s+([A-Za-z0-9 .,&-]{3,40})/i,
    /merchant[:\s]+([A-Za-z0-9 .,&-]{3,40})/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return address?.trim() || undefined;
};

const inferCategory = (
  body: string,
  type: TransactionType,
  categories: Category[],
): Category | undefined => {
  const normalized = body.toLowerCase();
  const pool = categories.filter(
    (category) => category.type === type || category.type === 'both',
  );

  const keywordMap: { keyword: RegExp; categoryNames: string[] }[] = [
    {
      keyword: /(grocery|supermarket|bigbasket|blinkit|zepto)/i,
      categoryNames: ['Groceries'],
    },
    {
      keyword: /(restaurant|food|dining|swiggy|zomato)/i,
      categoryNames: ['Food & Dining'],
    },
    {
      keyword: /(uber|ola|metro|fuel|petrol|diesel|transport)/i,
      categoryNames: ['Transport'],
    },
    { keyword: /(salary|payroll)/i, categoryNames: ['Salary'] },
    { keyword: /(rent|landlord)/i, categoryNames: ['Rent'] },
    {
      keyword: /(electricity|water|gas|broadband|recharge|utility)/i,
      categoryNames: ['Utilities'],
    },
    {
      keyword: /(shopping|amazon|flipkart|myntra)/i,
      categoryNames: ['Shopping'],
    },
  ];

  const matched = keywordMap.find((entry) => entry.keyword.test(normalized));
  if (matched) {
    return pool.find((category) =>
      matched.categoryNames.includes(category.name),
    );
  }

  return pool.find((category) => category.name === 'Other') ?? pool[0];
};

const selectAccount = (
  accounts: Account[],
  paymentMethod: PaymentMethod,
  body: string,
): Account | undefined => {
  const normalized = body.toLowerCase();

  if (paymentMethod === 'upi') {
    return (
      accounts.find((account) => account.type === 'upi') ??
      accounts.find((account) => account.isDefault) ??
      accounts[0]
    );
  }

  if (paymentMethod === 'wallet') {
    return (
      accounts.find((account) => account.type === 'wallet') ??
      accounts.find((account) => account.isDefault) ??
      accounts[0]
    );
  }

  if (paymentMethod === 'credit_card' || normalized.includes('credit card')) {
    return (
      accounts.find((account) => account.type === 'credit_card') ??
      accounts.find((account) => account.isDefault) ??
      accounts[0]
    );
  }

  return (
    accounts.find((account) => account.isDefault) ??
    accounts.find((account) => account.type === 'bank') ??
    accounts[0]
  );
};

const listSmsMessages = (minDate: number): Promise<SmsMessage[]> =>
  new Promise((resolve, reject) => {
    SmsAndroid.list(
      JSON.stringify({
        box: 'inbox',
        minDate,
        indexFrom: 0,
        maxCount: 200,
      }),
      (fail: string) => reject(new Error(fail)),
      (_count: number, smsList: string) => {
        const messages = JSON.parse(smsList) as SmsMessage[];
        resolve(messages);
      },
    );
  });

export const hasSmsReadPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
};

export const requestSmsReadPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const ensureLocalProfile = async () => {
  const existing = await UserProfileService.getProfile();
  if (existing) {
    return existing;
  }

  return UserProfileService.upsertProfile({});
};

const parseSmsToTransaction = async (
  message: SmsMessage,
  accounts: Account[],
  categories: Category[],
): Promise<ParsedSmsTransaction | null> => {
  const body = message.body?.trim();
  if (!body) {
    return null;
  }

  const sender = message.address ?? '';
  const senderLooksBank = BANK_SENDERS.some((token) =>
    sender.toUpperCase().includes(token),
  );
  if (
    !senderLooksBank &&
    !/(debited|credited|upi|a\/c|account|txn|spent|paid|received)/i.test(body)
  ) {
    return null;
  }

  const amount = extractAmount(body);
  const type = detectType(body);
  if (!amount || !type) {
    return null;
  }

  const paymentMethod = detectPaymentMethod(body);
  const account = selectAccount(accounts, paymentMethod, body);
  const category = inferCategory(body, type, categories);
  if (!account || !category) {
    return null;
  }

  const messageId = String(message._id);
  const merchant = extractMerchant(body, sender);
  const notes = `${body}\n[sms:${messageId}]`;

  return {
    messageId,
    amount,
    type,
    merchant,
    paymentMethod,
    date: new Date(message.date).toISOString().slice(0, 10),
    accountId: account.id,
    categoryId: category.id,
    notes,
    tags: ['sms-import', `sms:${messageId}`],
  };
};

export const importSmsTransactions = async (
  interactive = true,
): Promise<SmsImportResult> => {
  if (Platform.OS !== 'android') {
    return {
      granted: false,
      supported: false,
      importedCount: 0,
      message: 'SMS import is only available on Android devices.',
    };
  }

  const granted = interactive
    ? await requestSmsReadPermission()
    : await hasSmsReadPermission();
  if (!granted) {
    return {
      granted: false,
      supported: true,
      importedCount: 0,
      message: interactive
        ? 'SMS read permission was denied.'
        : 'SMS permission is not granted.',
    };
  }

  await ensureLocalProfile();

  const lastImportedAt = await getSyncState(SMS_IMPORT_STATE_KEY);
  const minDate = lastImportedAt
    ? new Date(lastImportedAt).getTime() - 60_000
    : Date.now() - INITIAL_IMPORT_WINDOW_MS;

  const [messages, accounts, categories] = await Promise.all([
    listSmsMessages(minDate),
    AccountService.getAll(),
    CategoryService.getAll(),
  ]);

  let importedCount = 0;
  let newestTimestamp = minDate;

  const orderedMessages = [...messages].sort(
    (left, right) => left.date - right.date,
  );

  for (const message of orderedMessages) {
    newestTimestamp = Math.max(newestTimestamp, message.date);
    const parsed = await parseSmsToTransaction(message, accounts, categories);
    if (!parsed) {
      continue;
    }

    const alreadyImported = await TransactionService.hasImportedSms(
      parsed.messageId,
    );
    if (alreadyImported) {
      continue;
    }

    await TransactionService.create({
      amount: parsed.amount,
      type: parsed.type,
      categoryId: parsed.categoryId,
      accountId: parsed.accountId,
      merchant: parsed.merchant,
      notes: parsed.notes,
      tags: parsed.tags,
      date: parsed.date,
      paymentMethod: parsed.paymentMethod,
      isRecurring: false,
    });
    importedCount += 1;
  }

  if (newestTimestamp > minDate) {
    await setSyncState(
      SMS_IMPORT_STATE_KEY,
      new Date(newestTimestamp).toISOString(),
    );
  }

  const network = await NetInfo.fetch();
  if (
    network.isConnected &&
    network.isInternetReachable !== false &&
    importedCount > 0
  ) {
    void triggerBackgroundSync('sms-import');
  }

  return {
    granted: true,
    supported: true,
    importedCount,
    message:
      importedCount > 0
        ? `Imported ${importedCount} SMS transaction${importedCount === 1 ? '' : 's'}.`
        : 'No new bank SMS transactions found.',
  };
};

class SmsImportService {
  private intervalId?: ReturnType<typeof setInterval>;

  start() {
    if (Platform.OS !== 'android' || this.intervalId) {
      return;
    }

    void this.run();
    this.intervalId = setInterval(() => {
      void this.run();
    }, SMS_POLL_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  async run() {
    const autoImportEnabled = useAppStore.getState().smsEnabled;
    if (!autoImportEnabled) {
      return;
    }
    try {
      await importSmsTransactions(false);
    } catch (error) {
      console.warn('SMS import failed', error);
    }
  }
}

export const smsImportService = new SmsImportService();
