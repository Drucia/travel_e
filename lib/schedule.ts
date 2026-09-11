import { mondayWeekdayIndex, parseISODate, toISODate } from '@/lib/dates';
import {
  deleteFutureScheduledEvents,
  getActiveSeason,
  insertScheduledEvents,
  listCloudEvents,
  listScheduleRules,
} from '@/lib/cloud/queries';

export async function generateScheduleEvents(groupId: string): Promise<number> {
  const season = await getActiveSeason(groupId);
  if (!season) return 0;

  const rules = (await listScheduleRules(groupId)).filter((rule) => rule.enabled && rule.weekdays.length > 0);
  if (rules.length === 0) return 0;

  const today = toISODate(new Date());
  const start = today > season.startDate ? today : season.startDate;
  if (season.endDate < start) return 0;

  const existing = await listCloudEvents(groupId, start, season.endDate);
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
        notes: null,
        source: 'schedule' as const,
        scheduleRuleId: rule.id,
      });
      keys.add(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  await insertScheduledEvents(groupId, drafts);
  return drafts.length;
}

export async function rebuildScheduleRuleEvents(groupId: string, ruleId: string): Promise<void> {
  await deleteFutureScheduledEvents(ruleId, toISODate(new Date()));
  await generateScheduleEvents(groupId);
}
