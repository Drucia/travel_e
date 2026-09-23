import type { SQLiteDatabase } from 'expo-sqlite';

import { mondayWeekdayIndex, parseISODate, toISODate } from '@/lib/dates';
import {
  deleteFutureScheduledEvents,
  getActiveSeason,
  insertScheduledEvents,
  listEventsBetween,
  listScheduleRules,
} from '@/lib/db/queries';

export async function generateScheduleEvents(
  db: SQLiteDatabase,
  options?: { includePast?: boolean }
): Promise<number> {
  const season = await getActiveSeason(db);
  if (!season) return 0;

  const rules = (await listScheduleRules(db)).filter((rule) => rule.enabled && rule.weekdays.length > 0);
  if (rules.length === 0) return 0;

  const today = toISODate(new Date());
  const start = options?.includePast ? season.startDate : today > season.startDate ? today : season.startDate;
  if (season.endDate < start) return 0;

  const existing = await listEventsBetween(db, start, season.endDate);
  const keys = new Set(existing.map((event) => `${event.date}|${event.type}|${event.startTime}`));

  const drafts = [];
  const cursor = parseISODate(start);
  const last = parseISODate(season.endDate);

  while (cursor.getTime() <= last.getTime()) {
    const date = toISODate(cursor);
    const weekday = mondayWeekdayIndex(cursor);
    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue;
      const key = `${date}|${rule.type}|${rule.startTime}`;
      if (keys.has(key)) continue;
      drafts.push({
        seasonId: season.id,
        date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        type: rule.type,
        destinationId: rule.destinationId,
        notes: rule.notes,
        source: 'schedule' as const,
        scheduleRuleId: rule.id,
      });
      keys.add(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  await insertScheduledEvents(db, drafts);
  return drafts.length;
}

export async function rebuildScheduleRuleEvents(
  db: SQLiteDatabase,
  ruleId: string,
  options?: { includePast?: boolean }
): Promise<void> {
  const season = await getActiveSeason(db);
  const fromDate =
    options?.includePast && season ? season.startDate : toISODate(new Date());
  await deleteFutureScheduledEvents(db, ruleId, fromDate);
  await generateScheduleEvents(db, options);
}
