import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { IoniconsName } from '@/utils/types';

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: IoniconsName;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  secureTextEntry,
  keyboardType = 'default',
  multiline = false,
  maxLength,
  editable = true,
  onPress,
  rightElement,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, !!error), [colors, error]);

  const content = (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon && (
          <Ionicons name={icon} size={18} color={error ? colors.expense : colors.textMuted} />
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable && !onPress}
          accessibilityLabel={label}
        />
        {rightElement}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {content}
      </Pressable>
    );
  }
  return content;
};

function createStyles(colors: ThemeColors, hasError: boolean) {
  return StyleSheet.create({
    container: {
      gap: SPACING.xs,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: hasError ? colors.expense : colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderWidth: 1,
      borderColor: hasError ? colors.expense : colors.border,
      gap: SPACING.sm,
      minHeight: 48,
    },
    input: {
      flex: 1,
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    error: {
      ...TYPOGRAPHY.caption,
      color: colors.expense,
      fontSize: 11,
      fontWeight: '500',
    },
  });
}
