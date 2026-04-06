import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { logger } from '../../utils/logger';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ScreenErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.warn('ScreenErrorBoundary', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: SPACING.lg,
          }}
        >
          <Text
            style={{
              ...TYPOGRAPHY.h3,
              marginBottom: SPACING.sm,
              color: '#EF4444',
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              ...TYPOGRAPHY.body,
              color: '#64748B',
              textAlign: 'center',
            }}
          >
            An unexpected error occurred. Please go back and try again.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{
              marginTop: SPACING.lg,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
              backgroundColor: '#7C3AED',
              borderRadius: RADIUS.md,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
