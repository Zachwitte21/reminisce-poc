import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing, touchTargetSize } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  error,
  secureTextEntry,
  containerStyle,
  inputStyle,
  ...props
}: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={theme.textLight}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsSecure(!isSecure)}
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
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
  },
  inputFocused: {
    borderColor: theme.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.danger,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: theme.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargetSize,
  },
  eyeButton: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: theme.danger,
    marginTop: spacing.xs,
  },
});
