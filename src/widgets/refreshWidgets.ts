import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { WidgetDataService } from '../services/widgetDataService';
import { BudgetHealthWidget } from './BudgetHealthWidget';
import { ExpenseSummaryWidget } from './ExpenseSummaryWidget';
import { QuickAddWidget } from './QuickAddWidget';

/** Call this after data changes to refresh all home screen widgets */
export async function refreshAllWidgets() {
  if (Platform.OS !== 'android') return;

  try {
    const [expenseData, budgetData] = await Promise.all([
      WidgetDataService.getExpenseSummary(),
      WidgetDataService.getBudgetHealth(),
    ]);

    await Promise.all([
      requestWidgetUpdate({
        widgetName: 'ExpenseSummary',
        renderWidget: () => ExpenseSummaryWidget(expenseData),
      }),
      requestWidgetUpdate({
        widgetName: 'QuickAdd',
        renderWidget: () => QuickAddWidget(),
      }),
      requestWidgetUpdate({
        widgetName: 'BudgetHealth',
        renderWidget: () => BudgetHealthWidget(budgetData),
      }),
    ]);
  } catch (error) {
    // Widget update failures are non-critical — log warning but do not rethrow
    console.warn('Widget refresh failed:', error);
  }
}
