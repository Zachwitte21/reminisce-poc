import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'large',
  color,
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const indicatorColor = color ?? theme.primary;

  const content = (
    <>
      <ActivityIndicator size={size} color={indicatorColor} />
      {message && <Text style={styles.message}>{message}</Text>}
    </>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return <View style={styles.container}>{content}</View>;
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  message: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
