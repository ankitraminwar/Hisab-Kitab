import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const ReportsScreen = React.lazy(
  () => import('../../src/screens/reports/ReportsScreen'),
);

export default function Reports() {
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
      <ReportsScreen />
    </Suspense>
  );
}
