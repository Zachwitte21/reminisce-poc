import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

type BadgeVariant = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';

interface BadgeProps {
  count?: number;
  label?: string;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
  style?: ViewStyle;
  showClose?: boolean;
  onClose?: () => void;
}

export function Badge({
  count,
  label,
  variant = 'primary',
  size = 'medium',
  style,
  showClose,
  onClose,
}: BadgeProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const displayText = count !== undefined ? (count > 99 ? '99+' : String(count)) : label;

  if (!displayText) return null;

  const variantStyles = {
    primary: styles.primary,
    success: styles.success,
    danger: styles.danger,
    warning: styles.warning,
    neutral: styles.neutral,
  };

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
  };

  const textSizeStyles = {
    small: styles.smallText,
    medium: styles.mediumText,
  };

  return (
    <View style={[styles.badge, variantStyles[variant], sizeStyles[size], style, showClose && styles.withClose]}>
      <Text style={[styles.text, textSizeStyles[size]]}>{displayText}</Text>
      {showClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.text, textSizeStyles[size], styles.closeText]}>x</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  withClose: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primary: {
    backgroundColor: theme.primary,
  },
  success: {
    backgroundColor: theme.success,
  },
  danger: {
    backgroundColor: theme.danger,
  },
  warning: {
    backgroundColor: theme.warning,
  },
  neutral: {
    backgroundColor: theme.textSecondary,
  },
  small: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
  },
  medium: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.sm,
  },
  text: {
    color: theme.textInverse,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  closeBtn: {
    marginLeft: 2,
    paddingHorizontal: 2,
  },
  closeText: {
    opacity: 0.8,
  },
});
