import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';

const BudgetsScreen = React.lazy(() => import('../../src/screens/budgets/BudgetsScreen'));

export default function Budgets() {
  const { colors } = useTheme();

  return (
    <Suspense
      fallback={
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bg,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      }
    >
      <BudgetsScreen />
    </Suspense>
  );
}
