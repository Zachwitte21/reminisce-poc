import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModalLib from 'react-native-modal-datetime-picker';
import { useTheme } from '../../hooks/useTheme';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface TimePickerModalProps {
  isVisible: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function TimePickerModal(props: TimePickerModalProps) {
  if (Platform.OS !== 'web') {
    return (
      <DateTimePickerModalLib
        isVisible={props.isVisible}
        mode="time"
        date={props.date}
        onConfirm={props.onConfirm}
        onCancel={props.onCancel}
      />
    );
  }

  return <WebTimePicker {...props} />;
}

function WebTimePicker({ isVisible, date, onConfirm, onCancel }: TimePickerModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [hours, setHours] = useState(date.getHours());
  const [minutes, setMinutes] = useState(date.getMinutes());

  useEffect(() => {
    if (isVisible) {
      setHours(date.getHours());
      setMinutes(date.getMinutes());
    }
  }, [isVisible, date]);

  const handleConfirm = () => {
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    onConfirm(newDate);
  };

  const stepHours = (delta: number) => {
    setHours((prev) => ((prev + delta) % 24 + 24) % 24);
  };

  const stepMinutes = (delta: number) => {
    setMinutes((prev) => ((prev + delta) % 60 + 60) % 60);
  };

  const formatHour12 = (h: number) => {
    const hour12 = h % 12 || 12;
    return hour12.toString();
  };

  const ampm = hours >= 12 ? 'PM' : 'AM';

  const toggleAmPm = () => {
    setHours((prev) => (prev + 12) % 24);
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.card}>
            <Text style={styles.title}>Select Time</Text>

            <View style={styles.pickerRow}>
              {/* Hours */}
              <View style={styles.column}>
                <TouchableOpacity onPress={() => stepHours(1)} style={styles.arrowBtn}>
                  <Ionicons name="chevron-up" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.value}>{formatHour12(hours)}</Text>
                <TouchableOpacity onPress={() => stepHours(-1)} style={styles.arrowBtn}>
                  <Ionicons name="chevron-down" size={28} color={theme.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.colon}>:</Text>

              {/* Minutes */}
              <View style={styles.column}>
                <TouchableOpacity onPress={() => stepMinutes(5)} style={styles.arrowBtn}>
                  <Ionicons name="chevron-up" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.value}>
                  {minutes.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={() => stepMinutes(-5)} style={styles.arrowBtn}>
                  <Ionicons name="chevron-down" size={28} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <TouchableOpacity style={styles.ampmBtn} onPress={toggleAmPm}>
                <Text style={styles.ampmText}>{ampm}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      minWidth: 280,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 16,
    },
    title: {
      ...typography.heading3,
      color: theme.text,
      marginBottom: spacing.lg,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    column: {
      alignItems: 'center',
      minWidth: 64,
    },
    arrowBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    value: {
      fontSize: 40,
      fontWeight: '700',
      color: theme.text,
      marginVertical: spacing.sm,
      minWidth: 56,
      textAlign: 'center',
    },
    colon: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.text,
      marginHorizontal: spacing.sm,
      marginBottom: spacing.md,
    },
    ampmBtn: {
      backgroundColor: theme.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginLeft: spacing.md,
      marginBottom: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    ampmText: {
      ...typography.body,
      fontWeight: '700',
      color: theme.textInverse,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cancelBtn: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelText: {
      ...typography.body,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    confirmBtn: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      backgroundColor: theme.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    confirmText: {
      ...typography.body,
      color: theme.textInverse,
      fontWeight: '600',
    },
  });
