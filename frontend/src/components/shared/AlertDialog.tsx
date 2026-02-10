import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onDismiss: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export function AlertDialog({
  visible,
  title,
  message,
  buttonText = 'OK',
  onDismiss,
  icon,
  iconColor,
}: AlertDialogProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              {icon && (
                <View style={[styles.iconContainer, { backgroundColor: (iconColor || theme.primary) + '20' }]}>
                  <Ionicons name={icon} size={32} color={iconColor || theme.primary} />
                </View>
              )}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <Button
                title={buttonText}
                onPress={onDismiss}
                style={styles.button}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading3,
    color: theme.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: theme.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: {
    minWidth: 120,
  },
});
