import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { RADIUS, TYPOGRAPHY } from '../../utils/constants';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onDone: () => void;
  doneLabel?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const KeyButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'default' | 'accent' | 'action';
  span?: number;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ label, onPress, variant = 'default', span = 1, colors }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgColor =
    variant === 'accent'
      ? colors.primary + '15'
      : variant === 'action'
        ? colors.primary
        : colors.bgCard;
  const textColor =
    variant === 'accent'
      ? colors.primary
      : variant === 'action'
        ? '#FFFFFF'
        : colors.textPrimary;
  const borderColor = variant === 'default' ? colors.border : 'transparent';

  return (
    <AnimatedTouchable
      onPressIn={() => {
        scale.value = withSpring(0.93, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
      style={[
        animStyle,
        styles.key,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === 'default' ? 1 : 0,
          flex: span,
        },
      ]}
    >
      <Text
        style={[
          styles.keyText,
          {
            color: textColor,
            fontWeight: variant === 'action' ? '800' : '600',
            fontSize: variant === 'action' ? 15 : 22,
            letterSpacing: variant === 'action' ? 1.5 : 0,
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedTouchable>
  );
};

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onDigit,
  onBackspace,
  onDone,
  doneLabel = 'DONE',
}) => {
  const { colors } = useTheme();
  const containerStyle = useMemo(
    () => [
      styles.container,
      { borderTopColor: colors.border, backgroundColor: colors.bg + 'CC' },
    ],
    [colors],
  );

  return (
    <View style={containerStyle}>
      <View style={styles.grid}>
        {/* Row 1 */}
        <KeyButton label="1" onPress={() => onDigit('1')} colors={colors} />
        <KeyButton label="2" onPress={() => onDigit('2')} colors={colors} />
        <KeyButton label="3" onPress={() => onDigit('3')} colors={colors} />
        <TouchableOpacity
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBackspace();
          }}
          style={[styles.key, { backgroundColor: colors.bgElevated + '60' }]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="backspace-outline"
            size={22}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Row 2 */}
        <KeyButton label="4" onPress={() => onDigit('4')} colors={colors} />
        <KeyButton label="5" onPress={() => onDigit('5')} colors={colors} />
        <KeyButton label="6" onPress={() => onDigit('6')} colors={colors} />
        <KeyButton
          label="+"
          onPress={() => onDigit('+')}
          variant="accent"
          colors={colors}
        />

        {/* Row 3 */}
        <KeyButton label="7" onPress={() => onDigit('7')} colors={colors} />
        <KeyButton label="8" onPress={() => onDigit('8')} colors={colors} />
        <KeyButton label="9" onPress={() => onDigit('9')} colors={colors} />
        <KeyButton
          label="-"
          onPress={() => onDigit('-')}
          variant="accent"
          colors={colors}
        />

        {/* Row 4 */}
        <KeyButton label="." onPress={() => onDigit('.')} colors={colors} />
        <KeyButton label="0" onPress={() => onDigit('0')} colors={colors} />
        <KeyButton
          label={doneLabel}
          onPress={onDone}
          variant="action"
          span={2}
          colors={colors}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  key: {
    flex: 1,
    minWidth: '22%',
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    ...TYPOGRAPHY.h3,
  },
});
