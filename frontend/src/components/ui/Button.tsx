import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, touchTargetSize, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'ghost' ? theme.primary : theme.textInverse}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              styles[`${variant}Text`],
              styles[`${size}Text`],
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    minHeight: touchTargetSize,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  primary: {
    backgroundColor: theme.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.primary,
  },
  danger: {
    backgroundColor: theme.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Sizes
  small: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTargetSize,
  },
  large: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 56,
  },

  // Text
  text: {
    ...typography.button,
  },
  primaryText: {
    color: theme.textInverse,
  },
  secondaryText: {
    color: theme.primary,
  },
  dangerText: {
    color: theme.textInverse,
  },
  ghostText: {
    color: theme.primary,
  },
  smallText: {
    ...typography.buttonSmall,
  },
  mediumText: {
    ...typography.button,
  },
  largeText: {
    ...typography.button,
    fontSize: 20,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
});
