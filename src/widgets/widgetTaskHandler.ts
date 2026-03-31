import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { initializeDatabase } from '../database';
import { WidgetDataService } from '../services/widgetDataService';
import { BudgetHealthWidget } from './BudgetHealthWidget';
import { ExpenseSummaryWidget } from './ExpenseSummaryWidget';
import { QuickAddWidget } from './QuickAddWidget';

const WIDGET_NAMES = {
  EXPENSE_SUMMARY: 'ExpenseSummary',
  QUICK_ADD: 'QuickAdd',
  BUDGET_HEALTH: 'BudgetHealth',
} as const;

const WIDGET_TIMEOUT_MS = 10000;

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  let didTimeout = false;

  const runWithTimeout = async () => {
    try {
      // Ensure DB is initialized for headless task (Finding 4)
      await initializeDatabase();

      switch (widgetInfo.widgetName) {
        case WIDGET_NAMES.EXPENSE_SUMMARY: {
          const data = await WidgetDataService.getExpenseSummary();
          if (!didTimeout) renderWidget(ExpenseSummaryWidget(data));
          break;
        }
        case WIDGET_NAMES.QUICK_ADD: {
          if (!didTimeout) renderWidget(QuickAddWidget());
          break;
        }
        case WIDGET_NAMES.BUDGET_HEALTH: {
          const data = await WidgetDataService.getBudgetHealth();
          if (!didTimeout) renderWidget(BudgetHealthWidget(data));
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('Widget task handler failed:', error);
    }
  };

  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => {
      didTimeout = true;
      console.warn(`Widget task ${widgetInfo.widgetName} timed out after ${WIDGET_TIMEOUT_MS}ms`);
      resolve(null);
    }, WIDGET_TIMEOUT_MS);
  });

  const workPromise = runWithTimeout().finally(() => {
    clearTimeout(timeoutHandle!);
  });

  await Promise.race([workPromise, timeoutPromise]);
}
