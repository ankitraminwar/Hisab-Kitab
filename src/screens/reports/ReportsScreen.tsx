import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryPie, VictoryBar, VictoryLine, VictoryChart, VictoryAxis, VictoryTheme } from 'victory-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, formatCurrency, formatCompact } from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import { Card, SectionHeader } from '../../components/common';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.md * 2 - 32;

export default function ReportsScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [stats, setStats] = useState({ income: 0, expense: 0 });

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    const [exp, inc, trend, monthStats] = await Promise.all([
      TransactionService.getCategoryBreakdown(year, month, 'expense'),
      TransactionService.getCategoryBreakdown(year, month, 'income'),
      TransactionService.getMonthlyTrend(6),
      TransactionService.getMonthlyStats(year, month),
    ]);
    setExpenseBreakdown(exp);
    setIncomeBreakdown(inc);
    setMonthlyTrend(trend);
    setStats(monthStats);
  };

  const pieColors = COLORS.chart;

  const expensePieData = expenseBreakdown.slice(0, 6).map((item, i) => ({
    x: item.categoryName,
    y: item.total,
    color: item.categoryColor || pieColors[i % pieColors.length],
  }));

  const trendBarData = monthlyTrend.map(m => ({
    month: m.month.slice(5),
    income: m.income,
    expense: m.expense,
  }));

  const savingsRate = stats.income > 0
    ? ((stats.income - stats.expense) / stats.income * 100).toFixed(1)
    : '0';

  const prevMonth = () => {
    const d = new Date(year, parseInt(month) - 2, 1);
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  const nextMonth = () => {
    const d = new Date(year, parseInt(month), 1);
    setYear(d.getFullYear());
    setMonth(String(d.getMonth() + 1).padStart(2, '0'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
      </View>

      {/* Month Picker */}
      <View style={styles.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{format(new Date(year, parseInt(month) - 1), 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statValue, { color: COLORS.income }]}>{formatCompact(stats.income)}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Expenses</Text>
            <Text style={[styles.statValue, { color: COLORS.expense }]}>{formatCompact(stats.expense)}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Savings</Text>
            <Text style={[styles.statValue, { color: parseFloat(savingsRate) >= 0 ? COLORS.income : COLORS.expense }]}>
              {savingsRate}%
            </Text>
          </Card>
        </View>

        {/* Expense Breakdown Pie */}
        {expensePieData.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="Expense Breakdown" />
            <VictoryPie
              data={expensePieData}
              colorScale={expensePieData.map(d => d.color)}
              width={CHART_WIDTH}
              height={200}
              innerRadius={50}
              padAngle={2}
              style={{
                labels: { fill: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
              }}
              labelRadius={({ innerRadius }) => (typeof innerRadius === 'number' ? innerRadius : 0) + 40}
            />
            {/* Legend */}
            <View style={styles.legend}>
              {expensePieData.map((item, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>{item.x}</Text>
                  <Text style={styles.legendValue}>{formatCompact(item.y)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Monthly Trend */}
        {trendBarData.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="6-Month Trend" />
            <VictoryChart
              width={CHART_WIDTH}
              height={200}
              theme={VictoryTheme.material}
              domainPadding={{ x: 20 }}
            >
              <VictoryAxis
                style={{
                  axis: { stroke: COLORS.border },
                  tickLabels: { fill: COLORS.textMuted, fontSize: 10 },
                  grid: { stroke: 'transparent' },
                }}
              />
              <VictoryAxis
                dependentAxis
                style={{
                  axis: { stroke: 'transparent' },
                  tickLabels: { fill: COLORS.textMuted, fontSize: 10 },
                  grid: { stroke: COLORS.border, strokeDasharray: '4' },
                }}
                tickFormat={v => formatCompact(v)}
              />
              <VictoryBar
                data={trendBarData}
                x="month"
                y="income"
                style={{ data: { fill: COLORS.income + 'CC', width: 12, borderRadius: 4 } }}
              />
              <VictoryBar
                data={trendBarData}
                x="month"
                y="expense"
                style={{ data: { fill: COLORS.expense + 'CC', width: 12, borderRadius: 4 } }}
              />
            </VictoryChart>
            <View style={styles.chartLegend}>
              <View style={styles.chartLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.income }]} />
                <Text style={styles.legendLabel}>Income</Text>
              </View>
              <View style={styles.chartLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.expense }]} />
                <Text style={styles.legendLabel}>Expenses</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Category Table */}
        {expenseBreakdown.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="Top Expenses" />
            {expenseBreakdown.slice(0, 8).map((item, i) => {
              const pct = stats.expense > 0 ? (item.total / stats.expense * 100).toFixed(1) : '0';
              return (
                <View key={item.categoryId} style={styles.tableRow}>
                  <View style={[styles.rankBadge, { backgroundColor: COLORS.bgElevated }]}>
                    <Text style={styles.rankText}>#{i + 1}</Text>
                  </View>
                  <View style={[styles.catDot, { backgroundColor: item.categoryColor || COLORS.primary }]} />
                  <Text style={styles.catName} numberOfLines={1}>{item.categoryName}</Text>
                  <Text style={styles.catPct}>{pct}%</Text>
                  <Text style={styles.catAmount}>{formatCurrency(item.total)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.sm,
  },
  arrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  monthLabel: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, minWidth: 140, textAlign: 'center' },
  scroll: { paddingHorizontal: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 4 },
  statValue: { ...TYPOGRAPHY.h3, fontWeight: '800' },
  chartCard: { marginBottom: SPACING.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '48%' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, flex: 1 },
  legendValue: { ...TYPOGRAPHY.caption, color: COLORS.textPrimary, fontWeight: '600' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  rankBadge: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  rankText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontWeight: '700' },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, flex: 1 },
  catPct: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, width: 40, textAlign: 'right' },
  catAmount: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600', width: 80, textAlign: 'right' },
});
