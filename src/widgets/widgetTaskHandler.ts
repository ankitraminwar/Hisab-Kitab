import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { WidgetDataService } from '../services/widgetDataService';
import { BudgetHealthWidget } from './BudgetHealthWidget';
import { ExpenseSummaryWidget } from './ExpenseSummaryWidget';
import { QuickAddWidget } from './QuickAddWidget';

const WIDGET_NAMES = {
  EXPENSE_SUMMARY: 'ExpenseSummary',
  QUICK_ADD: 'QuickAdd',
  BUDGET_HEALTH: 'BudgetHealth',
} as const;

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  // Skip deleted widgets
  if (widgetAction === 'WIDGET_DELETED') return;

  try {
    switch (widgetInfo.widgetName) {
      case WIDGET_NAMES.EXPENSE_SUMMARY: {
        const data = await WidgetDataService.getExpenseSummary();
        renderWidget(ExpenseSummaryWidget(data));
        break;
      }
      case WIDGET_NAMES.QUICK_ADD: {
        renderWidget(QuickAddWidget());
        break;
      }
      case WIDGET_NAMES.BUDGET_HEALTH: {
        const data = await WidgetDataService.getBudgetHealth();
        renderWidget(BudgetHealthWidget(data));
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Widget task handler failed:', error);
    // Optionally render a fallback widget or re-throw? For now, just log.
  }
}
