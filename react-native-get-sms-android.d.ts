declare module 'react-native-get-sms-android' {
  const SmsAndroid: {
    list: (
      filter: string,
      failCallback: (error: string) => void,
      successCallback: (count: number, smsList: string) => void,
    ) => void;
  };

  export default SmsAndroid;
}
