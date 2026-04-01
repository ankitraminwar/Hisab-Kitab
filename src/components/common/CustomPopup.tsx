import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import { Button } from './Button';

interface CustomPopupProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actions?: { label: string; onPress: () => void }[];
}

export const CustomPopup: React.FC<CustomPopupProps> = ({
  visible,
  title,
  message,
  type = 'info',
  onClose,
  actionLabel = 'OK',
  onAction,
  actions,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    if (visible && type === 'success' && !actions) {
      const timer = setTimeout(() => {
        (onAction || onClose)();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, type, actions, onAction, onClose]);

  const iconName =
    type === 'success'
      ? 'checkmark-circle'
      : type === 'error'
        ? 'close-circle'
        : 'information-circle';
  const iconColor =
    type === 'success' ? colors.income : type === 'error' ? colors.expense : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.popupOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.popupCard}>
          <View style={[styles.popupIconBg, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>
          <Text style={styles.popupTitle}>{title}</Text>
          <Text style={styles.popupMessage}>{message}</Text>

          {actions ? (
            <View style={{ width: '100%', gap: SPACING.sm, marginTop: SPACING.md }}>
              {actions.map((action) => (
                <Button
                  key={action.label}
                  title={action.label}
                  onPress={action.onPress}
                  style={{ width: '100%' }}
                  variant="primary"
                />
              ))}
              <Button title="Cancel" onPress={onClose} style={{ width: '100%' }} variant="ghost" />
            </View>
          ) : (
            <Button
              title={actionLabel}
              onPress={onAction || onClose}
              style={{ width: '100%', marginTop: SPACING.md }}
              variant={type === 'error' ? 'danger' : 'primary'}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    popupOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    popupCard: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(40, 40, 45, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      borderRadius: RADIUS.xxl,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      ...SHADOWS.lg,
    },
    popupIconBg: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    popupTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    popupMessage: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
  });
