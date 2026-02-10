import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, TimePickerModal } from '../../src/components/ui';
import { useScheduleStore, usePatientStore } from '../../src/stores';
import { ThemeColors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { useTheme } from '../../src/hooks/useTheme';
import { layout } from '../../src/theme/layout';
import { ScheduleSession } from '../../src/types/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30];
const REMINDER_OPTIONS = [0, 5, 10, 15, 30];

interface LocalSession {
  key: string;
  day_of_week: number;
  time_of_day: string;
  enabled: boolean;
}

function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function timeToDate(time24: string): Date {
  const [h, m] = time24.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

let keyCounter = 0;
function nextKey() {
  return `s_${++keyCounter}`;
}

export default function ScheduleScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const { patient } = usePatientStore();
  const { schedule, isLoading, isSaving, fetchSchedule, saveSchedule, updateSchedule } = useScheduleStore();

  const isLargeScreen = windowWidth > layout.maxWidth;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;
  const styles = useMemo(() => getStyles(theme, contentPadding), [theme, contentPadding]);

  // Local edit state
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [duration, setDuration] = useState(15);
  const [reminderMinutes, setReminderMinutes] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // Add session flow
  const [isAdding, setIsAdding] = useState(false);
  const [addDays, setAddDays] = useState<number[]>([]);
  const [addTime, setAddTime] = useState('14:00');

  // Time picker
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingSessionKey, setEditingSessionKey] = useState<string | null>(null);

  // Load schedule on mount
  useEffect(() => {
    if (patient?.id) {
      fetchSchedule(patient.id);
    }
  }, [patient?.id]);

  // Sync local state from fetched schedule
  useEffect(() => {
    if (schedule) {
      setSessions(
        (schedule.sessions || []).map((s) => ({
          key: nextKey(),
          day_of_week: s.day_of_week,
          time_of_day: s.time_of_day,
          enabled: s.enabled,
        }))
      );
      setDuration(schedule.session_duration);
      setReminderMinutes(schedule.notification_minutes_before);
      setIsDirty(false);
    }
  }, [schedule]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const toggleSession = (key: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
    markDirty();
  };

  const deleteSession = (key: string) => {
    setSessions((prev) => prev.filter((s) => s.key !== key));
    markDirty();
  };

  const openTimePicker = (sessionKey: string) => {
    setEditingSessionKey(sessionKey);
    setTimePickerVisible(true);
  };

  const openAddTimePicker = () => {
    setEditingSessionKey('__add__');
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (date: Date) => {
    const time = dateToTime(date);
    if (editingSessionKey === '__add__') {
      setAddTime(time);
    } else if (editingSessionKey) {
      setSessions((prev) =>
        prev.map((s) => (s.key === editingSessionKey ? { ...s, time_of_day: time } : s))
      );
      markDirty();
    }
    setTimePickerVisible(false);
    setEditingSessionKey(null);
  };

  const handleAddConfirm = () => {
    if (addDays.length === 0) return;
    const newSessions: LocalSession[] = addDays.map((day) => ({
      key: nextKey(),
      day_of_week: day,
      time_of_day: addTime,
      enabled: true,
    }));
    setSessions((prev) => [...prev, ...newSessions]);
    setIsAdding(false);
    setAddDays([]);
    setAddTime('14:00');
    markDirty();
  };

  const toggleAddDay = (dayIndex: number) => {
    setAddDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const stepValue = (
    current: number,
    options: number[],
    direction: 1 | -1,
    setter: (v: number) => void,
  ) => {
    const idx = options.indexOf(current);
    const next = idx + direction;
    if (next >= 0 && next < options.length) {
      setter(options[next]);
      markDirty();
    }
  };

  const handleSave = async () => {
    if (!patient?.id) return;
    const patientName = patient.first_name || 'your loved one';
    const sessionData = sessions.map((s) => ({
      day_of_week: s.day_of_week,
      time_of_day: s.time_of_day,
      enabled: s.enabled,
    }));

    try {
      if (schedule?.id) {
        await updateSchedule(
          schedule.id,
          {
            session_duration: duration,
            notification_minutes_before: reminderMinutes,
            sessions: sessionData as ScheduleSession[],
          },
          patientName,
        );
      } else {
        await saveSchedule(
          patient.id,
          {
            patient_id: patient.id,
            session_duration: duration,
            notification_minutes_before: reminderMinutes,
            sessions: sessionData as ScheduleSession[],
          },
          patientName,
        );
      }
      setIsDirty(false);
      Alert.alert('Saved', 'Your schedule has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save schedule. Please try again.');
    }
  };

  // Sort sessions by day then time
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.time_of_day.localeCompare(b.time_of_day);
      }),
    [sessions],
  );

  const currentPickerDate = useMemo(() => {
    if (editingSessionKey === '__add__') return timeToDate(addTime);
    const session = sessions.find((s) => s.key === editingSessionKey);
    return session ? timeToDate(session.time_of_day) : new Date();
  }, [editingSessionKey, sessions, addTime]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Schedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Section A: Weekly Sessions */}
          <Text style={styles.sectionTitle}>Weekly Sessions</Text>
          <Card style={styles.card}>
            {sortedSessions.length === 0 && !isAdding ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={theme.textLight} />
                <Text style={styles.emptyText}>No sessions scheduled</Text>
                <Text style={styles.emptySubtext}>Add your first session to get started</Text>
              </View>
            ) : (
              sortedSessions.map((session) => (
                <View key={session.key} style={styles.sessionRow}>
                  <View style={[styles.dayChip, { backgroundColor: session.enabled ? theme.primary : theme.border }]}>
                    <Text style={[styles.dayChipText, { color: session.enabled ? theme.textInverse : theme.textSecondary }]}>
                      {DAYS[session.day_of_week]}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker(session.key)}>
                    <Text style={styles.timeText}>{formatTime(session.time_of_day)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggle, session.enabled && styles.toggleActive]}
                    onPress={() => toggleSession(session.key)}
                  >
                    <View style={[styles.toggleKnob, session.enabled && styles.toggleKnobActive]} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteButton} onPress={() => deleteSession(session.key)}>
                    <Ionicons name="close-circle" size={22} color={theme.textLight} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {isAdding ? (
              <View style={styles.addForm}>
                <View style={styles.addDivider} />
                <Text style={styles.addLabel}>Select days</Text>
                <View style={styles.addDaysGrid}>
                  {DAYS.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.addDayPill, addDays.includes(index) && styles.addDayPillSelected]}
                      onPress={() => toggleAddDay(index)}
                    >
                      <Text style={[styles.addDayText, addDays.includes(index) && styles.addDayTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.addTimeRow} onPress={openAddTimePicker}>
                  <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                  <Text style={styles.addTimeText}>{formatTime(addTime)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                </TouchableOpacity>

                <View style={styles.addActions}>
                  <TouchableOpacity onPress={() => { setIsAdding(false); setAddDays([]); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Button
                    title="Add"
                    onPress={handleAddConfirm}
                    size="small"
                    disabled={addDays.length === 0}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addSessionButton} onPress={() => setIsAdding(true)}>
                <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
                <Text style={styles.addSessionText}>Add Session</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Section B: Session Settings */}
          <Text style={styles.sectionTitle}>Session Settings</Text>
          <Card style={styles.card}>
            {/* Duration */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Session Duration</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => stepValue(duration, DURATION_OPTIONS, -1, setDuration)}
                  disabled={duration === DURATION_OPTIONS[0]}
                >
                  <Ionicons name="remove" size={18} color={duration === DURATION_OPTIONS[0] ? theme.textLight : theme.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{duration} min</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => stepValue(duration, DURATION_OPTIONS, 1, setDuration)}
                  disabled={duration === DURATION_OPTIONS[DURATION_OPTIONS.length - 1]}
                >
                  <Ionicons name="add" size={18} color={duration === DURATION_OPTIONS[DURATION_OPTIONS.length - 1] ? theme.textLight : theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Reminder */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Remind Me Before</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => stepValue(reminderMinutes, REMINDER_OPTIONS, -1, setReminderMinutes)}
                  disabled={reminderMinutes === REMINDER_OPTIONS[0]}
                >
                  <Ionicons name="remove" size={18} color={reminderMinutes === REMINDER_OPTIONS[0] ? theme.textLight : theme.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{reminderMinutes} min</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => stepValue(reminderMinutes, REMINDER_OPTIONS, 1, setReminderMinutes)}
                  disabled={reminderMinutes === REMINDER_OPTIONS[REMINDER_OPTIONS.length - 1]}
                >
                  <Ionicons name="add" size={18} color={reminderMinutes === REMINDER_OPTIONS[REMINDER_OPTIONS.length - 1] ? theme.textLight : theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Save Button */}
          <Button
            title="Save Schedule"
            onPress={handleSave}
            fullWidth
            disabled={!isDirty || isSaving}
            loading={isSaving}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>

      <TimePickerModal
        isVisible={timePickerVisible}
        date={currentPickerDate}
        onConfirm={handleTimeConfirm}
        onCancel={() => { setTimePickerVisible(false); setEditingSessionKey(null); }}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: ThemeColors, contentPadding: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: contentPadding,
      paddingVertical: spacing.sm,
    },
    backButton: {
      padding: spacing.xs,
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: -spacing.xs,
    },
    headerTitle: {
      ...typography.heading3,
      color: theme.text,
    },
    headerSpacer: {
      width: 44,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: contentPadding,
      paddingBottom: spacing.xxl,
      alignItems: 'center',
    },
    contentWrapper: {
      width: '100%',
      maxWidth: layout.maxWidth,
      alignSelf: 'center',
    },

    sectionTitle: {
      ...typography.bodySmall,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    card: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },

    // Session rows
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm,
    },
    dayChip: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.md,
      minWidth: 48,
      alignItems: 'center',
    },
    dayChipText: {
      ...typography.caption,
      fontWeight: '600',
    },
    timeButton: {
      flex: 1,
      paddingVertical: spacing.xs,
    },
    timeText: {
      ...typography.body,
      color: theme.text,
    },
    toggle: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleActive: {
      backgroundColor: theme.success,
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
        },
        android: { elevation: 2 },
      }),
    },
    toggleKnobActive: {
      alignSelf: 'flex-end' as const,
    },
    deleteButton: {
      padding: spacing.xs,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    emptyText: {
      ...typography.body,
      color: theme.text,
      fontWeight: '600',
      marginTop: spacing.sm,
    },
    emptySubtext: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginTop: spacing.xs,
    },

    // Add session button
    addSessionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    addSessionText: {
      ...typography.body,
      color: theme.primary,
      fontWeight: '600',
    },

    // Add form
    addForm: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    addDivider: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginBottom: spacing.md,
      marginHorizontal: -spacing.md,
    },
    addLabel: {
      ...typography.bodySmall,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: spacing.sm,
    },
    addDaysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    addDayPill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    addDayPillSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    addDayText: {
      ...typography.bodySmall,
      fontWeight: '500',
      color: theme.text,
    },
    addDayTextSelected: {
      color: theme.textInverse,
    },
    addTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.background,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    addTimeText: {
      ...typography.body,
      color: theme.text,
      flex: 1,
    },
    addActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: spacing.md,
    },
    cancelText: {
      ...typography.body,
      color: theme.textSecondary,
    },

    // Settings rows
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    settingLabel: {
      ...typography.body,
      color: theme.text,
      flex: 1,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    stepperValue: {
      ...typography.body,
      fontWeight: '600',
      color: theme.text,
      minWidth: 60,
      textAlign: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginHorizontal: spacing.md,
    },
  });
