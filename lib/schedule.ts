import type { SQLiteDatabase } from 'expo-sqlite';

import { mondayWeekdayIndex, parseISODate, toISODate } from '@/lib/dates';
import {
  createEvent,
  deleteFutureScheduledEvents,
  getActiveSeason,
  listEventsBetween,
  listScheduleRules,
} from '@/lib/db/queries';

export async function generateScheduleEvents(db: SQLiteDatabase): Promise<number> {
  const season = await getActiveSeason(db);
  if (!season) return 0;

  const rules = (await listScheduleRules(db)).filter((rule) => rule.enabled && rule.weekdays.length > 0);
  if (rules.length === 0) return 0;

  const today = toISODate(new Date());
  const start = today > season.startDate ? today : season.startDate;
  if (season.endDate < start) return 0;

  const existing = await listEventsBetween(db, start, season.endDate);
  const keys = new Set(existing.map((event) => `${event.date}|${event.type}|${event.startTime}`));

  let created = 0;
  const cursor = parseISODate(start);
  const last = parseISODate(season.endDate);

  while (cursor.getTime() <= last.getTime()) {
    const date = toISODate(cursor);
    const weekday = mondayWeekdayIndex(cursor);
    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue;
      const key = `${date}|${rule.type}|${rule.startTime}`;
      if (keys.has(key)) continue;
      await createEvent(db, {
        seasonId: season.id,
        date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        type: rule.type,
        destinationId: rule.destinationId,
        notes: null,
        source: 'schedule',
        scheduleRuleId: rule.id,
      });
      keys.add(key);
      created += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return created;
}

export async function rebuildScheduleRuleEvents(db: SQLiteDatabase, ruleId: string): Promise<void> {
  await deleteFutureScheduledEvents(db, ruleId, toISODate(new Date()));
  await generateScheduleEvents(db);
}
