import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={theme.textLight} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.heading3,
    color: theme.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
  },
});
