import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const BudgetsScreen = React.lazy(
  () => import('../../src/screens/budgets/BudgetsScreen'),
);

export default function Budgets() {
  return (
    <Suspense
      fallback={
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" />
        </View>
      }
    >
      <BudgetsScreen />
    </Suspense>
  );
}
