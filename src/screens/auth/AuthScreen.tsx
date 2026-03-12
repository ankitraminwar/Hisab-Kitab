import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common';
import { authService } from '@/services/auth';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';

type Mode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

const copy: Record<Mode, { title: string; primary: string }> = {
  login: { title: 'Welcome back', primary: 'Login' },
  signup: { title: 'Create account', primary: 'Sign up' },
  'forgot-password': { title: 'Reset password', primary: 'Send reset link' },
  'reset-password': {
    title: 'Choose a new password',
    primary: 'Update password',
  },
};

export default function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await authService.signIn({ email, password });
        if (error) {
          throw error;
        }
      } else if (mode === 'signup') {
        const { error } = await authService.signUp({ email, password });
        if (error) {
          throw error;
        }
        Alert.alert(
          'Account created',
          'Check your email if confirmation is enabled in Supabase.',
        );
        router.replace('/login');
      } else if (mode === 'forgot-password') {
        const { error } = await authService.requestPasswordReset(email);
        if (error) {
          throw error;
        }
        Alert.alert(
          'Reset email sent',
          'Use the link in your email to continue.',
        );
      } else {
        const { error } = await authService.resetPassword(password);
        if (error) {
          throw error;
        }
        Alert.alert(
          'Password updated',
          'You can now log in with your new password.',
        );
        router.replace('/login');
      }
    } catch (error) {
      Alert.alert(
        'Auth failed',
        error instanceof Error
          ? error.message
          : 'Unable to complete the request.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrapper}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{copy[mode].title}</Text>
          <Text style={styles.subtitle}>
            Supabase auth with local offline data still available after login.
          </Text>

          {mode !== 'reset-password' ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          ) : null}

          {mode !== 'forgot-password' ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          ) : null}

          <Button
            title={copy[mode].primary}
            onPress={() => void submit()}
            loading={loading}
          />

          <View style={styles.links}>
            {mode === 'login' ? (
              <>
                <Link href="/auth/signup" style={styles.linkText}>
                  Create an account
                </Link>
                <Link href="/auth/forgot-password" style={styles.linkText}>
                  Forgot password?
                </Link>
              </>
            ) : null}
            {mode === 'signup' ? (
              <Link href="/login" style={styles.linkText}>
                Back to login
              </Link>
            ) : null}
            {mode === 'forgot-password' ? (
              <Link href="/login" style={styles.linkText}>
                Back to login
              </Link>
            ) : null}
            {mode === 'reset-password' ? (
              <Link href="/login" style={styles.linkText}>
                Back to login
              </Link>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  wrapper: { flex: 1, justifyContent: 'center', padding: SPACING.md },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  title: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  links: { marginTop: SPACING.sm, gap: 8 },
  linkText: { color: COLORS.primary, fontWeight: '600' },
});
