import { addMinutes } from 'date-fns';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { combineDateTime } from '@/lib/dates';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL } from '@/lib/format';
import type { EventRecord, Settings } from '@/lib/db/types';
import {
  eventReminderUrl,
  reminderMessage,
  syncTelegramReminders,
  type TelegramReminderItem,
} from '@/lib/telegram';

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
  if (Platform.OS === 'web') return true;

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

export async function scheduleEventReminder(event: EventRecord, settings: Settings): Promise<void> {
  await cancelEventReminder(event.id);

  if (!settings.reminderEnabled || event.completed || Platform.OS === 'web') {
    return;
  }

  const allowed = await ensureNotificationSetup();
  if (!allowed) return;

  const fireAt = getReminderAt(event, settings);
  if (fireAt.getTime() <= Date.now()) return;

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
}

export async function syncEventReminder(event: EventRecord, settings: Settings): Promise<void> {
  if (event.completed) {
    await cancelEventReminder(event.id);
    return;
  }
  await scheduleEventReminder(event, settings);
}

export async function rescheduleAllReminders(settings: Settings, events: EventRecord[]): Promise<void> {
  const upcoming = events
    .filter((event) => !event.completed)
    .map((event) => ({ event, fireAt: getReminderAt(event, settings) }))
    .filter((item) => item.fireAt.getTime() > Date.now() - 3 * 60 * 60 * 1000)
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());

  const nativeUpcoming = upcoming.filter((item) => item.fireAt.getTime() > Date.now()).slice(0, 40);
  const nativeIds = new Set(nativeUpcoming.map((item) => item.event.id));
  if (Platform.OS !== 'web') {
    for (const event of events) {
      if (!nativeIds.has(event.id)) {
        await cancelEventReminder(event.id);
      }
    }
    for (const item of nativeUpcoming) {
      await scheduleEventReminder(item.event, settings);
    }
  }

  const telegramItems: TelegramReminderItem[] = upcoming.slice(0, 40).map((item) => {
    const url = eventReminderUrl(item.event.id);
    const message = reminderMessage(item.event, url);
    return {
      id: item.event.id,
      fireAt: item.fireAt.toISOString(),
      title: message.title,
      body: message.body,
      url,
    };
  });
  try {
    await syncTelegramReminders(settings, telegramItems);
  } catch (error) {
    console.warn('Nie udało się zsynchronizować przypomnień Telegram', error);
  }
}

export function eventIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const eventId = (data as { eventId?: unknown }).eventId;
  return typeof eventId === 'string' ? eventId : null;
}
