import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget/src/widgets/utils/style.props';
import type { WidgetExpenseSummary } from '../services/widgetDataService';

type C = {
  bg: ColorProp;
  card: ColorProp;
  text: ColorProp;
  muted: ColorProp;
  primary: ColorProp;
  danger: ColorProp;
  success: ColorProp;
};

const DARK: C = {
  bg: '#1A1A2E',
  card: '#1E293B',
  text: '#F1F5F9',
  muted: '#94A3B8',
  primary: '#6C63FF',
  danger: '#F87171',
  success: '#10B981',
};

const LIGHT: C = {
  bg: '#F8F9FF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#6C63FF',
  danger: '#EF4444',
  success: '#10B981',
};

function formatAmount(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function buildWidget(data: WidgetExpenseSummary, colors: C) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'hisabkitab://transactions' }}
    >
      {/* Header Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text="Expense Summary"
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
          }}
        />
        <TextWidget
          text={data.monthLabel}
          style={{
            fontSize: 11,
            color: colors.muted,
          }}
        />
      </FlexWidget>

      {/* Amounts Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        {/* Expense */}
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text="Spent"
            style={{ fontSize: 11, color: colors.muted }}
          />
          <TextWidget
            text={formatAmount(data.totalExpense)}
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.danger,
            }}
          />
        </FlexWidget>

        {/* Income */}
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget
            text="Earned"
            style={{ fontSize: 11, color: colors.muted }}
          />
          <TextWidget
            text={formatAmount(data.totalIncome)}
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.success,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Top Categories */}
      {data.topCategories.length > 0 && (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          {data.topCategories.map((cat, i) => (
            <FlexWidget
              key={i}
              style={{ flexDirection: 'column', alignItems: 'center' }}
            >
              <FlexWidget
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: (cat.color || '#6C63FF') as `#${string}`,
                }}
              />
              <TextWidget
                text={cat.name}
                maxLines={1}
                truncate="END"
                style={{
                  fontSize: 9,
                  color: colors.muted,
                  marginTop: 2,
                }}
              />
              <TextWidget
                text={formatAmount(cat.amount)}
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: colors.text,
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

export function ExpenseSummaryWidget(data: WidgetExpenseSummary) {
  return {
    light: buildWidget(data, LIGHT),
    dark: buildWidget(data, DARK),
  };
}
