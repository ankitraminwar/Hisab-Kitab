import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CustomPopup } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { authService } from '../../services/auth';
import { RADIUS } from '../../utils/constants';

type Mode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

const copy: Record<Mode, { title: string; subtitle: string; primary: string }> =
  {
    login: {
      title: 'Welcome back',
      subtitle: 'Log in to manage your finances securely.',
      primary: 'Login',
    },
    signup: {
      title: 'Create Account',
      subtitle: 'Join Hisab-Kitab to start managing your finances with ease.',
      primary: 'Sign Up',
    },
    'forgot-password': {
      title: 'Forgot Password',
      subtitle: 'Enter your email to receive a password reset link.',
      primary: 'Send Reset Link',
    },
    'reset-password': {
      title: 'New Password',
      subtitle: 'Choose a strong password for your account.',
      primary: 'Update Password',
    },
  };

// ─── Input with Icon ──────────────────────────────────────────────────────────
const IconInput: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  label: string;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  colors: ThemeColors;
}> = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  label,
  keyboardType = 'default',
  autoCapitalize = 'none',
  colors,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isDark = colors.bg === '#0F0F1A';

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: '600',
          marginLeft: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            left: 16,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Ionicons name={icon as any} size={20} color={colors.textMuted} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          style={{
            backgroundColor: colors.primary + '08',
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: colors.primary + '20',
            color: colors.textPrimary,
            paddingLeft: 48,
            paddingRight: secureTextEntry ? 48 : 16,
            height: 56,
            fontSize: 16,
          }}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 16,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── OR Divider ───────────────────────────────────────────────────────────────
const OrDivider: React.FC<{ colors: ThemeColors }> = ({ colors }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 16,
    }}
  >
    <View
      style={{
        flex: 1,
        height: 1,
        backgroundColor: colors.primary + '20',
      }}
    />
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}
    >
      OR
    </Text>
    <View
      style={{
        flex: 1,
        height: 1,
        backgroundColor: colors.primary + '20',
      }}
    />
  </View>
);

// ─── Social Button ────────────────────────────────────────────────────────────
const SocialButton: React.FC<{
  icon: string;
  label: string;
  colors: ThemeColors;
}> = ({ icon, label, colors }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    style={{
      height: 56,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary + '20',
      backgroundColor: colors.primary + '08',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}
  >
    <Ionicons name={icon as any} size={20} color={colors.textPrimary} />
    <Text
      style={{
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({ visible: false, title: '', message: '', type: 'info' });
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await authService.signIn({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await authService.signUp({ email, password });
        if (error) throw error;
        setPopupConfig({
          visible: true,
          title: 'Account created',
          message: 'Check your email if confirmation is enabled.',
          type: 'success',
          onClose: () => router.replace('/login'),
        });
      } else if (mode === 'forgot-password') {
        const { error } = await authService.requestPasswordReset(email);
        if (error) throw error;
        setPopupConfig({
          visible: true,
          title: 'Reset email sent',
          message: 'Use the link in your email to continue.',
          type: 'success',
        });
      } else {
        const { error } = await authService.resetPassword(password);
        if (error) throw error;
        setPopupConfig({
          visible: true,
          title: 'Password updated',
          message: 'You can now log in with your new password.',
          type: 'success',
          onClose: () => router.replace('/login'),
        });
      }
    } catch (error) {
      setPopupConfig({
        visible: true,
        title: 'Auth failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to complete the request.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password layout ─────────────────────────────────────────────────
  if (mode === 'forgot-password') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.forgotCenter}>
            {/* Icon with glow */}
            <View style={styles.forgotIconWrap}>
              <View style={styles.forgotIconGlow} />
              <View style={styles.forgotIconBox}>
                <Ionicons
                  name="lock-open-outline"
                  size={44}
                  color={colors.primary}
                />
              </View>
            </View>

            {/* Title & subtitle centered */}
            <Text style={styles.forgotTitle}>{copy[mode].title}</Text>
            <Text style={styles.forgotSubtitle}>{copy[mode].subtitle}</Text>

            {/* Email input */}
            <View style={{ width: '100%', marginTop: 32 }}>
              <IconInput
                icon="mail-outline"
                label="EMAIL ADDRESS"
                placeholder="yourname@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                colors={colors}
              />
            </View>

            {/* Button */}
            <Button
              title={copy[mode].primary}
              onPress={() => void submit()}
              loading={loading}
              style={styles.bigButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <Link href="/login" style={styles.footerLink}>
              Log In
            </Link>
          </View>
        </KeyboardAvoidingView>
        <CustomPopup
          visible={popupConfig.visible}
          title={popupConfig.title}
          message={popupConfig.message}
          type={popupConfig.type}
          onClose={() => {
            setPopupConfig((prev) => ({ ...prev, visible: false }));
            if (popupConfig.onClose) setTimeout(popupConfig.onClose, 300);
          }}
        />
      </SafeAreaView>
    );
  }

  // ── Reset Password layout ──────────────────────────────────────────────────
  if (mode === 'reset-password') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.forgotCenter}>
            <View style={styles.forgotIconWrap}>
              <View style={styles.forgotIconGlow} />
              <View style={styles.forgotIconBox}>
                <Ionicons name="key-outline" size={44} color={colors.primary} />
              </View>
            </View>

            <Text style={styles.forgotTitle}>{copy[mode].title}</Text>
            <Text style={styles.forgotSubtitle}>{copy[mode].subtitle}</Text>

            <View style={{ width: '100%', marginTop: 32 }}>
              <IconInput
                icon="lock-closed-outline"
                label="NEW PASSWORD"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                colors={colors}
              />
            </View>

            <Button
              title={copy[mode].primary}
              onPress={() => void submit()}
              loading={loading}
              style={styles.bigButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Back to </Text>
            <Link href="/login" style={styles.footerLink}>
              Log In
            </Link>
          </View>
        </KeyboardAvoidingView>
        <CustomPopup
          visible={popupConfig.visible}
          title={popupConfig.title}
          message={popupConfig.message}
          type={popupConfig.type}
          onClose={() => {
            setPopupConfig((prev) => ({ ...prev, visible: false }));
            if (popupConfig.onClose) setTimeout(popupConfig.onClose, 300);
          }}
        />
      </SafeAreaView>
    );
  }

  // ── Login & Signup layout ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header bar */}
          <View style={styles.headerBar}>
            {mode === 'signup' ? (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.headerBackBtn}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 48 }} />
            )}
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="wallet" size={18} color="#fff" />
              </View>
              <Text style={styles.brandText}>Hisab-Kitab</Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          {/* Hero area */}
          {mode === 'login' ? (
            <View style={styles.heroImage}>
              <View style={styles.heroGradient} />
            </View>
          ) : (
            <View style={styles.signupHero}>
              <View style={styles.signupIconBox}>
                <Ionicons name="wallet" size={32} color="#fff" />
              </View>
            </View>
          )}

          {/* Title & subtitle */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{copy[mode].title}</Text>
            <Text style={styles.subtitle}>{copy[mode].subtitle}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <IconInput
                icon="person-outline"
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                colors={colors}
              />
            )}

            <IconInput
              icon="mail-outline"
              label="Email Address"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              colors={colors}
            />

            <IconInput
              icon="lock-closed-outline"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              colors={colors}
            />

            {mode === 'login' && (
              <View style={{ alignItems: 'flex-end' }}>
                <Link href="/auth/forgot-password" style={styles.forgotLink}>
                  Forgot Password?
                </Link>
              </View>
            )}
          </View>

          {/* Action area */}
          <View style={styles.actionArea}>
            <Button
              title={copy[mode].primary}
              onPress={() => void submit()}
              loading={loading}
              style={styles.bigButton}
            />

            <OrDivider colors={colors} />

            <SocialButton
              icon="logo-google"
              label="Continue with Google"
              colors={colors}
            />
            <SocialButton
              icon="logo-apple"
              label="Continue with Apple"
              colors={colors}
            />
          </View>

          {/* Footer */}
          <View style={[styles.footer, { marginTop: 'auto' }]}>
            {mode === 'login' ? (
              <>
                <Text style={styles.footerText}>
                  Don&apos;t have an account?{' '}
                </Text>
                <Link href="/auth/signup" style={styles.footerLink}>
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/login" style={styles.footerLink}>
                  Log In
                </Link>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => {
          setPopupConfig((prev) => ({ ...prev, visible: false }));
          if (popupConfig.onClose) setTimeout(popupConfig.onClose, 300);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Header bar
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerBackBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    brandIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    // Hero (login)
    heroImage: {
      marginHorizontal: 16,
      aspectRatio: 16 / 9,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary + '15',
      overflow: 'hidden',
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primary + '10',
    },

    // Hero (signup)
    signupHero: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 16,
    },
    signupIconBox: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },

    // Title
    titleBlock: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    },

    // Form
    form: {
      paddingHorizontal: 24,
      gap: 16,
    },
    forgotLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },

    // Actions
    actionArea: {
      paddingHorizontal: 24,
      paddingTop: 24,
      gap: 12,
    },
    bigButton: {
      height: 56,
      borderRadius: RADIUS.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 32,
    },
    footerText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },

    // Back button (forgot/reset)
    backBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      marginTop: 4,
    },

    // Forgot/Reset center layout
    forgotCenter: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    forgotIconWrap: {
      marginBottom: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    forgotIconGlow: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '15',
    },
    forgotIconBox: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: colors.primary + '10',
      borderWidth: 1,
      borderColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    forgotTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 12,
    },
    forgotSubtitle: {
      fontSize: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
    },
  });
