import type { SQLiteDatabase } from 'expo-sqlite';

import { mondayWeekdayIndex, parseISODate, toISODate } from '@/lib/dates';
import {
  deleteFutureScheduledEvents,
  getActiveSeason,
  insertScheduledEvents,
  listEventsBetween,
  listScheduleRules,
  listScheduleSkipKeys,
} from '@/lib/db/queries';

export async function generateScheduleEvents(
  db: SQLiteDatabase,
  options?: { includePast?: boolean; fromDate?: string; toDate?: string; ruleId?: string }
): Promise<number> {
  const season = await getActiveSeason(db);
  if (!season) return 0;

  const rules = (await listScheduleRules(db)).filter((rule) => {
    if (!rule.enabled || rule.weekdays.length === 0) return false;
    if (options?.ruleId) return rule.id === options.ruleId;
    return true;
  });
  if (rules.length === 0) return 0;

  const today = toISODate(new Date());
  const start =
    options?.fromDate ??
    (options?.includePast ? season.startDate : today > season.startDate ? today : season.startDate);
  const end = options?.toDate ?? season.endDate;
  const rangeStart = start < season.startDate ? season.startDate : start;
  const rangeEnd = end > season.endDate ? season.endDate : end;
  if (rangeEnd < rangeStart) return 0;

  const existing = await listEventsBetween(db, rangeStart, rangeEnd);
  const keys = new Set(existing.map((event) => `${event.date}|${event.type}|${event.startTime}`));
  const skips = await listScheduleSkipKeys(db);

  const drafts = [];
  const cursor = parseISODate(rangeStart);
  const last = parseISODate(rangeEnd);

  while (cursor.getTime() <= last.getTime()) {
    const date = toISODate(cursor);
    const weekday = mondayWeekdayIndex(cursor);
    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue;
      if (skips.has(`${rule.id}|${date}`)) continue;
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
  options?: { includePast?: boolean; fromDate?: string; toDate?: string }
): Promise<void> {
  const season = await getActiveSeason(db);
  const today = toISODate(new Date());
  const fromDate =
    options?.fromDate ?? (options?.includePast && season ? season.startDate : today);
  const toDate = options?.toDate ?? season?.endDate;
  await deleteFutureScheduledEvents(db, ruleId, fromDate, toDate);
  await generateScheduleEvents(db, { ...options, fromDate, toDate, ruleId });
}
