import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SPACING } from '../../utils/constants';

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  fullHeight?: boolean;
  hideCloseBtn?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CustomModal({
  visible,
  onClose,
  title,
  children,
  contentStyle,
  fullHeight = false,
  hideCloseBtn = false,
}: CustomModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [localVisible, setLocalVisible] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setLocalVisible(visible);
  }, [visible]);

  if (!localVisible) return null;

  return (
    <Modal visible={localVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlayContainer, { paddingBottom: keyboardHeight }]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <View style={[styles.backdrop]} />
        </Pressable>

        <View style={[styles.sheet, fullHeight && { height: SCREEN_HEIGHT * 0.9 }]}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {(title || !hideCloseBtn) && (
            <View style={styles.header}>
              <Text style={styles.title}>{title || ''}</Text>
              {!hideCloseBtn && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlayContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: RADIUS.lg + 8,
      borderTopRightRadius: RADIUS.lg + 8,
      paddingTop: SPACING.md,
      paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
      maxHeight: SCREEN_HEIGHT * 0.9,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 20,
    },
    dragHandleContainer: {
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: SPACING.xs,
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.full,
    },
    content: {
      paddingHorizontal: SPACING.lg,
    },
  });
