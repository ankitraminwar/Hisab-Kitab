import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';

const ReportsScreen = React.lazy(() => import('../../src/screens/reports/ReportsScreen'));

export default function Reports() {
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
      <ReportsScreen />
    </Suspense>
  );
}
