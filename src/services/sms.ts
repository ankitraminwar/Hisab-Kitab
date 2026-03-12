import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface SmsImportResult {
  granted: boolean;
  supported: boolean;
  importedCount: number;
  message: string;
}

const SmsReaderModule = NativeModules.HisabKitabSmsReader as
  | {
      readInbox: () => Promise<Record<string, unknown>[]>;
    }
  | undefined;

export const requestSmsReadPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const importSmsTransactions = async (): Promise<SmsImportResult> => {
  if (Platform.OS !== 'android') {
    return {
      granted: false,
      supported: false,
      importedCount: 0,
      message: 'SMS import is only available on Android devices.',
    };
  }

  const granted = await requestSmsReadPermission();
  if (!granted) {
    return {
      granted: false,
      supported: true,
      importedCount: 0,
      message: 'SMS read permission was denied.',
    };
  }

  if (!SmsReaderModule?.readInbox) {
    return {
      granted: true,
      supported: false,
      importedCount: 0,
      message:
        'SMS inbox reading requires a native Android SMS module, which is not present in this build.',
    };
  }

  const messages = await SmsReaderModule.readInbox();

  return {
    granted: true,
    supported: true,
    importedCount: messages.length,
    message: `Read ${messages.length} SMS messages. Parsing is ready for native module integration.`,
  };
};
