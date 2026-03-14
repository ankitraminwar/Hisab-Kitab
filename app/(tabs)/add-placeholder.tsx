import { Redirect } from 'expo-router';

/**
 * Placeholder route for the center FAB tab.
 * If navigated to directly, redirect back to dashboard.
 */
export default function AddPlaceholder() {
  return <Redirect href="/" />;
}
