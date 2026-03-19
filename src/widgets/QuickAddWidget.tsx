import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

function buildWidget(isDark: boolean) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#6C63FF',
        borderRadius: 16,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'hisabkitab://transactions/add' }}
    >
      <TextWidget
        text="+"
        style={{
          fontSize: 36,
          fontWeight: '700',
          color: '#FFFFFF',
        }}
      />
      <TextWidget
        text="Add Transaction"
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: '#FFFFFFCC',
          marginTop: 4,
        }}
      />
    </FlexWidget>
  );
}

export function QuickAddWidget() {
  // Same design for both themes since it uses solid primary color
  const widget = buildWidget(false);
  return { light: widget, dark: widget };
}
