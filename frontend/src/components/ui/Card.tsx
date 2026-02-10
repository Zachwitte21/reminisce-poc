import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export function Card({ children, style, padding = 'medium' }: CardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.card, styles[padding], style]}>
      {children}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  none: {
    padding: 0,
  },
  small: {
    padding: spacing.sm,
  },
  medium: {
    padding: spacing.md,
  },
  large: {
    padding: spacing.lg,
  },
});
