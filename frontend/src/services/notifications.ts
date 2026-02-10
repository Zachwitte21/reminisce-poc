import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { ScheduleSession } from '../types/api';

// Web-specific: track scheduled timeouts so we can cancel them
const webTimeoutIds = new Set<number>();

// Web-specific: track metadata about scheduled notifications
interface WebScheduledNotification {
  timeoutId: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
}
const webScheduledMeta: WebScheduledNotification[] = [];

/**
 * Calculate ms until the next occurrence of a given weekday + time.
 * dayOfWeek: 0=Sunday..6=Saturday (JS Date convention)
 */
function msUntilNext(dayOfWeek: number, hour: number, minute: number): number {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  // Days until target weekday
  let daysAhead = dayOfWeek - now.getDay();
  if (daysAhead < 0) daysAhead += 7;
  target.setDate(now.getDate() + daysAhead);

  // If same day but time already passed, push to next week
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }

  return target.getTime() - now.getTime();
}

function scheduleWebNotification(
  dayOfWeek: number,
  hour: number,
  minute: number,
  title: string,
  body: string,
) {
  const delay = msUntilNext(dayOfWeek, hour, minute);

  const fire = () => {
    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      router.push('/(caregiver)');
    };

    // Reschedule for next week
    const nextId = window.setTimeout(fire, 7 * 24 * 60 * 60 * 1000);
    webTimeoutIds.delete(id);
    webTimeoutIds.add(nextId);

    // Update metadata
    const idx = webScheduledMeta.findIndex((m) => m.timeoutId === id);
    if (idx !== -1) {
      webScheduledMeta[idx].timeoutId = nextId;
    }
  };

  const id = window.setTimeout(fire, delay);
  webTimeoutIds.add(id);
  webScheduledMeta.push({ timeoutId: id, dayOfWeek, hour, minute, title, body });
}

export async function initializeNotifications() {
  if (Platform.OS === 'web') return; // No-op: browser doesn't need a handler

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('therapy-reminders', {
      name: 'Therapy Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeeklyReminders(
  sessions: ScheduleSession[],
  patientName: string,
  minutesBefore: number = 15,
) {
  const granted = await requestPermissions();
  if (!granted) return;

  await cancelAllReminders();

  const enabledSessions = sessions.filter((s) => s.enabled);

  for (const session of enabledSessions) {
    const [hourStr, minuteStr] = session.time_of_day.split(':');
    const sessionHour = parseInt(hourStr, 10);
    const sessionMinute = parseInt(minuteStr, 10);

    // Subtract reminder minutes
    let reminderMinute = sessionMinute - minutesBefore;
    let reminderHour = sessionHour;
    if (reminderMinute < 0) {
      reminderMinute += 60;
      reminderHour -= 1;
      if (reminderHour < 0) reminderHour += 24;
    }

    if (Platform.OS === 'web') {
      // DB day_of_week: 0=Sunday..6=Saturday (matches JS Date)
      scheduleWebNotification(
        session.day_of_week,
        reminderHour,
        reminderMinute,
        'Therapy Time',
        `It's almost time for ${patientName}'s reminiscence session`,
      );
    } else {
      // expo-notifications weekday: 1=Sunday..7=Saturday
      // DB day_of_week: 0=Sunday..6=Saturday
      const weekday = session.day_of_week + 1;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Therapy Time',
          body: `It's almost time for ${patientName}'s reminiscence session`,
          data: { type: 'therapy_reminder' },
          ...(Platform.OS === 'android' && { channelId: 'therapy-reminders' }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: reminderHour,
          minute: reminderMinute,
        },
      });
    }
  }
}

export async function cancelAllReminders() {
  if (Platform.OS === 'web') {
    for (const id of webTimeoutIds) {
      clearTimeout(id);
    }
    webTimeoutIds.clear();
    webScheduledMeta.length = 0;
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  if (Platform.OS === 'web') {
    return webScheduledMeta.map((m) => ({
      identifier: String(m.timeoutId),
      content: { title: m.title, body: m.body },
      trigger: { dayOfWeek: m.dayOfWeek, hour: m.hour, minute: m.minute },
    }));
  }
  return Notifications.getAllScheduledNotificationsAsync();
}
