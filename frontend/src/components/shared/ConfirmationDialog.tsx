import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationDialogProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <View style={styles.buttons}>
                <Button
                  title={cancelText}
                  onPress={onCancel}
                  variant="ghost"
                  style={styles.button}
                  disabled={loading}
                />
                <Button
                  title={confirmText}
                  onPress={onConfirm}
                  variant={confirmVariant}
                  style={styles.button}
                  loading={loading}
                />
              </View>
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
  },
  title: {
    ...typography.heading3,
    color: theme.text,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: theme.textSecondary,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  button: {
    minWidth: 100,
  },
});
