import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TimePickerModal } from '../../../src/components/ui';
import { typography } from '../../../src/theme/typography';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import { useTheme } from '../../../src/hooks/useTheme';
import { ThemeColors } from '../../../src/theme/colors';
import { usePatientStore, useScheduleStore } from '../../../src/stores';
import { ScheduleSession } from '../../../src/types/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_WIDTH = 540;

function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ScheduleSetupScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState('14:00');
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { patient } = usePatientStore();
  const { saveSchedule } = useScheduleStore();

  const isLargeScreen = windowWidth > MAX_WIDTH;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleTimeConfirm = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    setSelectedTime(`${h}:${m}`);
    setTimePickerVisible(false);
  };

  const handleSkip = () => {
    router.replace('/(caregiver)');
  };

  const handleContinue = async () => {
    if (selectedDays.length === 0 || !patient?.id) {
      router.replace('/(caregiver)');
      return;
    }

    setIsSaving(true);
    try {
      const sessions = selectedDays.map((day) => ({
        day_of_week: day,
        time_of_day: selectedTime,
        enabled: true,
      }));

      await saveSchedule(
        patient.id,
        {
          patient_id: patient.id,
          session_duration: 15,
          notification_minutes_before: 0,
          sessions: sessions as ScheduleSession[],
        },
        patient.first_name || 'your loved one',
      );

      router.replace('/(caregiver)');
    } catch {
      Alert.alert('Note', 'Schedule could not be saved, but you can set it up later in Settings.');
      router.replace('/(caregiver)');
    } finally {
      setIsSaving(false);
    }
  };

  const pickerDate = useMemo(() => {
    const [h, m] = selectedTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, [selectedTime]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: contentPadding }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.title}>Therapy Schedule</Text>
            <Text style={styles.subtitle}>
              Choose days and time for therapy sessions (you can change this later)
            </Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Select Days</Text>
            <View style={styles.daysGrid}>
              {DAYS.map((day, index) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(index) && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(index)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selectedDays.includes(index) && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                  {selectedDays.includes(index) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.textInverse}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedDays.length > 0 && (
              <TouchableOpacity
                style={styles.timeInfo}
                onPress={() => setTimePickerVisible(true)}
              >
                <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                <Text style={styles.timeText}>
                  Sessions at {formatTime(selectedTime)}
                </Text>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            )}
          </Card>

          <View style={styles.buttons}>
            <Button
              title="Skip for Now"
              onPress={handleSkip}
              variant="ghost"
              style={styles.skipButton}
            />
            <Button
              title={selectedDays.length > 0 ? 'Continue' : 'Get Started'}
              onPress={handleContinue}
              fullWidth
              loading={isSaving}
              disabled={isSaving}
            />
          </View>
        </View>
      </ScrollView>

      <TimePickerModal
        isVisible={timePickerVisible}
        date={pickerDate}
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.heading1,
    color: theme.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading3,
    color: theme.text,
    marginBottom: spacing.md,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    minWidth: 70,
  },
  dayButtonSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  dayText: {
    ...typography.body,
    color: theme.text,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: theme.textInverse,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: theme.background,
    borderRadius: borderRadius.md,
  },
  timeText: {
    ...typography.bodySmall,
    color: theme.textSecondary,
    flex: 1,
  },
  changeText: {
    ...typography.bodySmall,
    color: theme.primary,
    fontWeight: '600',
  },
  buttons: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  skipButton: {
    alignSelf: 'center',
  },
});
