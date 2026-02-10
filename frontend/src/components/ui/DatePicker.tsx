import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing, touchTargetSize } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  error?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  containerStyle?: ViewStyle;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  containerStyle,
}: DatePickerProps) {
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const styles = getStyles(theme);

  const showPicker = () => {
    setPickerVisible(true);
    setIsFocused(true);
  };

  const hidePicker = () => {
    setPickerVisible(false);
    setIsFocused(false);
  };

  const handleConfirm = (date: Date) => {
    onChange(date);
    hidePicker();
  };

  // Helper: Format Date to display string (e.g., "June 15, 1945")
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Helper: Format Date to ISO string for API (e.g., "1945-06-15")
  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper: Parse ISO string to Date
  const parseDateFromISO = (dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        onPress={showPicker}
        activeOpacity={0.7}
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isPickerVisible}
        mode="date"
        date={value || new Date(1950, 0, 1)}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onConfirm={handleConfirm}
        onCancel={hidePicker}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: theme.text,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.md,
    minHeight: touchTargetSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputFocused: {
    borderColor: theme.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.danger,
  },
  inputText: {
    flex: 1,
    ...typography.body,
    color: theme.text,
  },
  placeholderText: {
    color: theme.textLight,
  },
  errorText: {
    ...typography.caption,
    color: theme.danger,
    marginTop: spacing.xs,
  },
});

