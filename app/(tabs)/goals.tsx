import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const GoalsScreen = React.lazy(
  () => import('../../src/screens/goals/GoalsScreen'),
);

export default function Goals() {
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
      <GoalsScreen />
    </Suspense>
  );
}
