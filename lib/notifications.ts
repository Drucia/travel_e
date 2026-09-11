import { addMinutes } from 'date-fns';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { combineDateTime } from '@/lib/dates';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL } from '@/lib/format';
import {
  getEvent,
  getSettings,
  listIncompleteEvents,
  setEventNotificationId,
} from '@/lib/db/queries';
import type { EventRecord, Settings } from '@/lib/db/types';
import type { SQLiteDatabase } from 'expo-sqlite';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const CHANNEL_ID = 'reminders';

export function reminderIdentifier(eventId: string): string {
  return `event-${eventId}`;
}

export function getEventEnd(event: EventRecord, defaultDurationMinutes: number): Date {
  if (event.endTime) {
    return combineDateTime(event.date, event.endTime);
  }
  return addMinutes(combineDateTime(event.date, event.startTime), defaultDurationMinutes);
}

export function getReminderAt(event: EventRecord, settings: Settings): Date {
  const end = getEventEnd(event, settings.defaultDurationMinutes);
  return addMinutes(end, settings.reminderOffsetMinutes ?? 0);
}

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Przypomnienia o uzupełnieniu',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 80, 180],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(eventId));
  } catch {
    // already cancelled or never scheduled
  }
}

export async function scheduleEventReminder(
  db: SQLiteDatabase,
  event: EventRecord,
  settings?: Settings
): Promise<void> {
  const resolved = settings ?? (await getSettings(db));
  await cancelEventReminder(event.id);

  if (!resolved.reminderEnabled || event.completed || Platform.OS === 'web') {
    await setEventNotificationId(db, event.id, null);
    return;
  }

  const allowed = await ensureNotificationSetup();
  if (!allowed) {
    await setEventNotificationId(db, event.id, null);
    return;
  }

  const fireAt = getReminderAt(event, resolved);
  if (fireAt.getTime() <= Date.now()) {
    await setEventNotificationId(db, event.id, null);
    return;
  }

  const identifier = reminderIdentifier(event.id);
  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: fireAt,
    ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
  };

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${EVENT_TYPE_EMOJI[event.type]} ${EVENT_TYPE_LABEL[event.type]} już za Tobą?`,
      body: 'Uzupełnij informacje o wyjeździe.',
      data: { eventId: event.id },
    },
    trigger,
  });

  await setEventNotificationId(db, event.id, identifier);
}

export async function syncEventReminder(db: SQLiteDatabase, eventId: string): Promise<void> {
  const event = await getEvent(db, eventId);
  if (!event) return;
  if (event.completed) {
    await cancelEventReminder(event.id);
    await setEventNotificationId(db, event.id, null);
    return;
  }
  await scheduleEventReminder(db, event);
}

export async function rescheduleAllReminders(db: SQLiteDatabase): Promise<void> {
  const settings = await getSettings(db);
  const events = await listIncompleteEvents(db);
  const upcoming = events
    .map((event) => ({ event, fireAt: getReminderAt(event, settings) }))
    .filter((item) => item.fireAt.getTime() > Date.now())
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, 40);

  const upcomingIds = new Set(upcoming.map((item) => item.event.id));
  for (const event of events) {
    if (!upcomingIds.has(event.id)) {
      await cancelEventReminder(event.id);
      await setEventNotificationId(db, event.id, null);
    }
  }
  for (const item of upcoming) {
    await scheduleEventReminder(db, item.event, settings);
  }
}

export function eventIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const eventId = (data as { eventId?: unknown }).eventId;
  return typeof eventId === 'string' ? eventId : null;
}
