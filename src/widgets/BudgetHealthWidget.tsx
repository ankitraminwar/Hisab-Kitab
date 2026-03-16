import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget/src/widgets/utils/style.props';
import type { WidgetBudgetHealth } from '../services/widgetDataService';

type C = {
  card: ColorProp;
  text: ColorProp;
  muted: ColorProp;
  barBg: ColorProp;
  danger: ColorProp;
  warning: ColorProp;
  success: ColorProp;
  primary: ColorProp;
};

const DARK: C = {
  card: '#1E293B',
  text: '#F1F5F9',
  muted: '#94A3B8',
  barBg: '#334155',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#10B981',
  primary: '#6C63FF',
};

const LIGHT: C = {
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  barBg: '#E2E8F0',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  primary: '#6C63FF',
};

function getStatusColor(pct: number, colors: C): ColorProp {
  if (pct >= 100) return colors.danger;
  if (pct >= 80) return colors.warning;
  return colors.success;
}

function buildWidget(data: WidgetBudgetHealth, colors: C) {
  const statusColor = getStatusColor(data.overallPercent, colors);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'hisabkitab:///(tabs)/budgets' }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text="Budget Health"
          style={{ fontSize: 13, fontWeight: '600', color: colors.text }}
        />
        <TextWidget
          text={`${data.overallPercent}% used`}
          style={{ fontSize: 12, fontWeight: '600', color: statusColor }}
        />
      </FlexWidget>

      {/* Progress bar */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 6,
          backgroundColor: colors.barBg,
          borderRadius: 3,
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <FlexWidget
          style={{
            width: Math.min(data.overallPercent, 100) as number,
            height: 6,
            backgroundColor: statusColor,
            borderRadius: 3,
          }}
        />
      </FlexWidget>

      {/* Budget items */}
      {data.budgets.length > 0 && (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          {data.budgets.slice(0, 3).map((b, i) => {
            const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
            return (
              <TextWidget
                key={i}
                text={`${b.name}: ${pct}%`}
                maxLines={1}
                truncate="END"
                style={{
                  fontSize: 10,
                  color: getStatusColor(pct, colors),
                }}
              />
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

export function BudgetHealthWidget(data: WidgetBudgetHealth) {
  return {
    light: buildWidget(data, LIGHT),
    dark: buildWidget(data, DARK),
  };
}
