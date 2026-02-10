import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface TherapyButtonProps {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function TherapyButton({ onPress, disabled = false, style }: TherapyButtonProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>START THERAPY</Text>
    </TouchableOpacity>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  button: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.xl,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.heading1,
    color: theme.textInverse,
    letterSpacing: 2,
  },
});
