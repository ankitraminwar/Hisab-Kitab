import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import AddTransactionScreen from '../../src/screens/transactions/AddTransactionScreen';
import TransactionDetailScreen from '../../src/screens/transactions/TransactionDetailScreen';

export default function TransactionRoute() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  if (edit === '1') {
    return <AddTransactionScreen />;
  }
  return <TransactionDetailScreen />;
}
